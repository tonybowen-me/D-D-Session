const fs = require('fs');
const path = require('path');
const SOURCES = require('./sources');
const { decodeEntities, cleanExcerpt } = require('./text');
const { classify } = require('./classify');

const UA = 'LoopLibrary/1.0 (free crochet pattern index; every result links back to the designer)';
const FIELDS = 'id,link,title,date_gmt,excerpt,featured_media,yoast_head_json.og_image';

async function getJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { data: await res.json(), totalPages: Number(res.headers.get('x-wp-totalpages')) || 1 };
}

async function fetchMedia(base, ids) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const { data } = await getJSON(
        `${base}/wp-json/wp/v2/media?include=${chunk.join(',')}&per_page=100&_fields=id,source_url,media_details.sizes`
      );
      for (const m of data) {
        const s = (m.media_details && m.media_details.sizes) || {};
        const pick = s.medium_large || s.large || s['post-thumbnail'] || s.medium;
        out.set(m.id, (pick && pick.source_url) || m.source_url);
      }
    } catch {
      // Images are optional; the card falls back to a placeholder.
    }
  }
  return out;
}

function toPattern(post, source, media) {
  const title = decodeEntities(post.title && post.title.rendered).trim();
  const excerpt = cleanExcerpt(post.excerpt && post.excerpt.rendered);
  if (!title || !post.link) return null;
  const c = classify(title, excerpt, post.link);
  if (!c) return null;
  const og = post.yoast_head_json && post.yoast_head_json.og_image;
  return {
    id: `${source.id}-${post.id}`,
    title,
    url: post.link,
    image: (og && og[0] && og[0].url) || media.get(post.featured_media) || null,
    excerpt,
    date: post.date_gmt ? `${post.date_gmt}Z` : null,
    source: source.id,
    ...c,
  };
}

async function fetchSource(source, maxPages) {
  const posts = [];
  let total = 1;
  for (let page = 1; page <= Math.min(total, maxPages); page++) {
    const { data, totalPages } = await getJSON(
      `${source.url}/wp-json/wp/v2/posts?per_page=100&page=${page}&_fields=${FIELDS}`
    );
    total = totalPages;
    posts.push(...data);
  }
  const missing = posts
    .filter((p) => !(p.yoast_head_json && p.yoast_head_json.og_image && p.yoast_head_json.og_image.length) && p.featured_media)
    .map((p) => p.featured_media);
  const media = missing.length ? await fetchMedia(source.url, missing) : new Map();
  return posts.map((p) => toPattern(p, source, media)).filter(Boolean);
}

async function mapLimit(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

class Collector {
  constructor({ cacheFile, maxPages = 3, refreshHours = 6, concurrency = 4 }) {
    this.cacheFile = cacheFile;
    this.maxPages = maxPages;
    this.refreshHours = refreshHours;
    this.concurrency = concurrency;
    this.state = { updatedAt: null, patterns: [], sources: {} };
    this.refreshing = false;
    this.progress = { done: 0, total: SOURCES.length };
    this.version = 0;
  }

  load() {
    try {
      this.state = JSON.parse(fs.readFileSync(this.cacheFile, 'utf8'));
      // Re-run the classifier so rule changes apply without refetching.
      this.state.patterns = this.state.patterns
        .map((p) => {
          const c = classify(p.title, p.excerpt, p.url);
          return c && { ...p, ...c };
        })
        .filter(Boolean);
      this.version++;
    } catch {
      // No cache yet.
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.cacheFile), { recursive: true });
    const tmp = `${this.cacheFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state));
    fs.renameSync(tmp, this.cacheFile);
  }

  isStale() {
    return !this.state.updatedAt || Date.now() - Date.parse(this.state.updatedAt) > this.refreshHours * 3600e3;
  }

  replaceSource(id, items) {
    const seen = new Set();
    this.state.patterns = this.state.patterns
      .filter((p) => p.source !== id)
      .concat(items)
      .filter((p) => (seen.has(p.url) ? false : seen.add(p.url)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    this.version++;
  }

  async refresh() {
    if (this.refreshing) return;
    this.refreshing = true;
    this.progress = { done: 0, total: SOURCES.length };
    this.version++;
    const started = Date.now();
    await mapLimit(SOURCES, this.concurrency, async (s) => {
      const prev = this.state.sources[s.id] || {};
      try {
        const items = await fetchSource(s, this.maxPages);
        this.replaceSource(s.id, items);
        this.state.sources[s.id] = { ok: true, count: items.length, fetchedAt: new Date().toISOString() };
      } catch (e) {
        this.state.sources[s.id] = { ...prev, ok: false, error: e.message };
        console.warn(`[collector] ${s.name}: ${e.message}`);
      }
      this.progress.done++;
      this.version++;
    });
    this.state.updatedAt = new Date().toISOString();
    this.refreshing = false;
    this.version++;
    this.save();
    console.log(`[collector] ${this.state.patterns.length} patterns from ${SOURCES.length} designers in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  snapshot() {
    return {
      updatedAt: this.state.updatedAt,
      refreshing: this.refreshing,
      progress: this.progress,
      sources: SOURCES.map((s) => ({ id: s.id, name: s.name, url: s.url, ...(this.state.sources[s.id] || {}) })),
      patterns: this.state.patterns,
    };
  }
}

module.exports = { Collector, fetchSource };
