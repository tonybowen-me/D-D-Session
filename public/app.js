(() => {
  const $ = (s) => document.querySelector(s);
  const PAGE = 48;
  const NEW_DAYS = 14;
  const TYPE_LABEL = { pattern: 'Pattern', roundup: 'Roundup', tutorial: 'Tutorial' };
  const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.3 4.5 7 4.5c2.1 0 3.6 1.1 5 2.9 1.4-1.8 2.9-2.9 5-2.9 3.7 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';

  const els = {
    q: $('#q'), cats: $('#cats'), types: $('#types'), easy: $('#easy'), src: $('#src'), sort: $('#sort'),
    savedBtn: $('#savedBtn'), savedCount: $('#savedCount'), grid: $('#grid'), empty: $('#empty'), sentinel: $('#sentinel'),
    status: $('#status'), lede: $('#lede'), sources: $('#sources'), updated: $('#updated'), modal: $('#modal'),
  };

  let data = { patterns: [], sources: [], categories: [] };
  let sourceMap = {};
  let catMap = {};
  let results = [];
  let shown = 0;
  let etag = null;
  let shuffleSeed = Math.random();
  let current = null;

  const saved = new Set(JSON.parse(localStorage.getItem('loop.saved') || '[]'));
  const persistSaved = () => {
    localStorage.setItem('loop.saved', JSON.stringify([...saved]));
    els.savedCount.textContent = saved.size;
  };

  const params = new URLSearchParams(location.search);
  const f = {
    q: params.get('q') || '',
    cat: params.get('cat') || '',
    type: params.get('type') || '',
    src: params.get('src') || '',
    easy: params.get('easy') === '1',
    saved: params.get('saved') === '1',
    sort: params.get('sort') || 'new',
  };

  function syncUrl() {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.cat) p.set('cat', f.cat);
    if (f.type) p.set('type', f.type);
    if (f.src) p.set('src', f.src);
    if (f.easy) p.set('easy', '1');
    if (f.saved) p.set('saved', '1');
    if (f.sort !== 'new') p.set('sort', f.sort);
    const qs = p.toString();
    history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function timeAgo(iso) {
    if (!iso) return '';
    const days = Math.floor((Date.now() - Date.parse(iso)) / 864e5);
    if (days < 1) return 'today';
    if (days < 2) return 'yesterday';
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.floor(days / 30)} mo ago`;
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
  }
  const isNew = (p) => p.date && Date.now() - Date.parse(p.date) < NEW_DAYS * 864e5;

  function hash(str) {
    let h = 2166136261 ^ Math.floor(shuffleSeed * 1e9);
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    return h >>> 0;
  }

  function prepare() {
    sourceMap = Object.fromEntries(data.sources.map((s) => [s.id, s]));
    catMap = Object.fromEntries(data.categories.map((c) => [c.id, c.label]));
    for (const p of data.patterns) {
      const designer = sourceMap[p.source]?.name || '';
      p._designer = designer;
      p._hay = `${p.title} ${p.excerpt} ${designer} ${p.categories.map((c) => catMap[c]).join(' ')}`.toLowerCase();
    }
  }

  function matches(p, ignoreCat) {
    if (f.saved && !saved.has(p.id)) return false;
    if (f.type && p.type !== f.type) return false;
    if (f.src && p.source !== f.src) return false;
    if (f.easy && !p.beginner) return false;
    if (!ignoreCat && f.cat && !p.categories.includes(f.cat)) return false;
    if (f.q) {
      for (const t of f.q.toLowerCase().split(/\s+/).filter(Boolean)) if (!p._hay.includes(t)) return false;
    }
    return true;
  }

  function apply() {
    const base = data.patterns.filter((p) => matches(p, true));
    results = f.cat ? base.filter((p) => p.categories.includes(f.cat)) : base;
    const sorters = {
      new: (a, b) => (b.date || '').localeCompare(a.date || ''),
      old: (a, b) => (a.date || '').localeCompare(b.date || ''),
      az: (a, b) => a.title.localeCompare(b.title),
      shuffle: (a, b) => hash(a.id) - hash(b.id),
    };
    results.sort(sorters[f.sort] || sorters.new);
    renderCats(base);
    els.grid.innerHTML = '';
    shown = 0;
    renderMore();
    els.empty.hidden = results.length > 0 || !data.patterns.length;
    renderStatus();
    syncUrl();
  }

  function renderCats(base) {
    const counts = {};
    for (const p of base) for (const c of p.categories) counts[c] = (counts[c] || 0) + 1;
    const chips = [`<button class="chip ${f.cat ? '' : 'on'}" data-cat="">All <small>${base.length.toLocaleString()}</small></button>`];
    for (const c of data.categories) {
      chips.push(`<button class="chip ${f.cat === c.id ? 'on' : ''} ${counts[c.id] ? '' : 'zero'}" data-cat="${c.id}">${esc(c.label)} <small>${(counts[c.id] || 0).toLocaleString()}</small></button>`);
    }
    els.cats.innerHTML = chips.join('');
  }

  function cardHTML(p) {
    const badge = p.type !== 'pattern'
      ? `<span class="badge ${p.type}">${TYPE_LABEL[p.type]}</span>`
      : isNew(p) ? '<span class="badge new">New</span>' : '';
    const tags = [
      p.beginner ? '<span class="tag easy">Beginner</span>' : '',
      ...p.categories.slice(0, 2).map((c) => `<span class="tag">${esc(catMap[c])}</span>`),
    ].join('');
    const img = p.image
      ? `<img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="${esc(p.image)}" alt="" onload="this.classList.add('ready')" onerror="this.remove();this.parentNode&&this.parentNode.classList.add('noimg')" />`
      : '';
    return `<article class="card" tabindex="0" data-id="${esc(p.id)}" aria-label="${esc(p.title)}">
      <div class="thumb ${p.image ? '' : 'noimg'}">${img}${badge}
        <button class="heart ${saved.has(p.id) ? 'on' : ''}" data-heart="${esc(p.id)}" aria-label="Save pattern" type="button">${HEART}</button>
      </div>
      <div class="card-body">
        <h3>${esc(p.title)}</h3>
        <div class="by">${esc(p._designer)} · ${timeAgo(p.date)}</div>
        <div class="tags">${tags}</div>
      </div>
    </article>`;
  }

  function renderMore() {
    if (shown >= results.length) return;
    const next = results.slice(shown, shown + PAGE);
    els.grid.insertAdjacentHTML('beforeend', next.map(cardHTML).join(''));
    shown += next.length;
  }

  function renderSkeleton() {
    els.grid.innerHTML = Array.from({ length: 12 }, () =>
      '<div class="card skeleton"><div class="thumb"></div><div class="card-body"><div class="line" style="width:85%"></div><div class="line" style="width:50%"></div></div></div>'
    ).join('');
  }

  function renderStatus() {
    const parts = [];
    if (data.patterns.length) {
      parts.push(`<span><b>${results.length.toLocaleString()}</b> ${results.length === 1 ? 'result' : 'results'}</span>`);
      const active = f.q || f.cat || f.type || f.src || f.easy || f.saved;
      if (active) parts.push('<button class="link" data-clear type="button">Clear filters</button>');
    }
    if (data.refreshing) {
      const pct = Math.round((100 * data.progress.done) / Math.max(1, data.progress.total));
      parts.push(`<span class="bar"><i style="width:${pct}%"></i></span><span>Gathering fresh patterns · ${data.progress.done}/${data.progress.total} designers</span>`);
    }
    els.status.innerHTML = parts.join('');
  }

  function renderChrome() {
    const designers = data.sources.filter((s) => s.count);
    els.lede.innerHTML = data.patterns.length
      ? `<b>${data.patterns.length.toLocaleString()}</b> free patterns and tutorials from <b>${designers.length}</b> independent designers, refreshed every few hours.`
      : 'Gathering patterns from independent designers…';
    const sorted = [...data.sources].sort((a, b) => a.name.localeCompare(b.name));
    els.src.innerHTML = '<option value="">All designers</option>' + sorted
      .map((s) => `<option value="${s.id}" ${f.src === s.id ? 'selected' : ''}>${esc(s.name)}${s.count ? ` (${s.count})` : ''}</option>`).join('');
    els.sources.innerHTML = 'Patterns from ' + sorted
      .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(', ') + '.';
    els.updated.textContent = data.updatedAt ? `Last refreshed ${new Date(data.updatedAt).toLocaleString()}.` : '';
  }

  async function load() {
    try {
      const res = await fetch('/api/patterns', { headers: etag ? { 'If-None-Match': etag } : {} });
      if (res.status === 200) {
        etag = res.headers.get('ETag');
        data = await res.json();
        prepare();
        renderChrome();
        if (data.patterns.length) apply();
        else { renderSkeleton(); renderStatus(); }
      }
      if (data.refreshing || !data.patterns.length) setTimeout(load, data.patterns.length ? 8000 : 2500);
    } catch {
      els.status.textContent = 'Could not reach the server. Retrying…';
      setTimeout(load, 5000);
    }
  }

  function openModal(p) {
    current = p;
    const img = $('#mImg');
    img.src = p.image || '/favicon.svg';
    img.style.objectFit = p.image ? 'cover' : 'contain';
    $('#mTitle').textContent = p.title;
    $('#mExcerpt').textContent = p.excerpt || '';
    $('#mMeta').innerHTML = `<span class="badge ${p.type}">${TYPE_LABEL[p.type]}</span><span>${esc(p._designer)}</span><span>·</span><span>${timeAgo(p.date)}</span>`;
    $('#mTags').innerHTML = [p.beginner ? '<span class="tag easy">Beginner-friendly</span>' : '', ...p.categories.map((c) => `<span class="tag">${esc(catMap[c])}</span>`)].join('');
    const open = $('#mOpen');
    open.href = p.url;
    open.textContent = p.type === 'roundup' ? 'See the free patterns →' : p.type === 'tutorial' ? 'Open the tutorial →' : 'Get the free pattern →';
    $('#mMore').textContent = `More from ${p._designer} →`;
    updateModalSave();
    if (!els.modal.open) els.modal.showModal();
  }
  function updateModalSave() {
    if (!current) return;
    $('#mSave').innerHTML = saved.has(current.id) ? 'Saved ♥' : 'Save';
  }

  function toggleSave(id) {
    saved.has(id) ? saved.delete(id) : saved.add(id);
    persistSaved();
    document.querySelectorAll(`[data-heart="${CSS.escape(id)}"]`).forEach((b) => b.classList.toggle('on', saved.has(id)));
    updateModalSave();
    if (f.saved) apply();
  }

  function clearAll() {
    Object.assign(f, { q: '', cat: '', type: '', src: '', easy: false, saved: false });
    els.q.value = '';
    syncControls();
    apply();
  }

  function syncControls() {
    els.q.value = f.q;
    els.easy.checked = f.easy;
    els.sort.value = f.sort;
    els.src.value = f.src;
    els.savedBtn.setAttribute('aria-pressed', String(f.saved));
    els.types.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.type === f.type));
  }

  // Events
  let qTimer;
  els.q.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { f.q = els.q.value.trim(); apply(); }, 120);
  });
  els.cats.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    f.cat = b.dataset.cat;
    apply();
    b.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  });
  els.types.addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]');
    if (!b) return;
    f.type = b.dataset.type;
    syncControls();
    apply();
  });
  els.easy.addEventListener('change', () => { f.easy = els.easy.checked; apply(); });
  els.src.addEventListener('change', () => { f.src = els.src.value; apply(); });
  els.sort.addEventListener('change', () => { f.sort = els.sort.value; shuffleSeed = Math.random(); apply(); });
  els.savedBtn.addEventListener('click', () => { f.saved = !f.saved; syncControls(); apply(); });
  $('#clearAll').addEventListener('click', clearAll);
  els.status.addEventListener('click', (e) => e.target.closest('[data-clear]') && clearAll());

  els.grid.addEventListener('click', (e) => {
    const heart = e.target.closest('[data-heart]');
    if (heart) { e.stopPropagation(); return toggleSave(heart.dataset.heart); }
    const card = e.target.closest('.card[data-id]');
    if (card) openModal(results.find((p) => p.id === card.dataset.id));
  });
  els.grid.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.closest('[data-heart]')) return;
    const card = e.target.closest('.card[data-id]');
    if (card) openModal(results.find((p) => p.id === card.dataset.id));
  });

  $('#surprise').addEventListener('click', () => {
    const pool = results.length ? results : data.patterns;
    if (pool.length) openModal(pool[Math.floor(Math.random() * pool.length)]);
  });
  $('#mClose').addEventListener('click', () => els.modal.close());
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) els.modal.close(); });
  $('#mSave').addEventListener('click', () => current && toggleSave(current.id));
  $('#mMore').addEventListener('click', () => {
    if (!current) return;
    els.modal.close();
    Object.assign(f, { src: current.source, cat: '', q: '', saved: false });
    syncControls();
    apply();
    window.scrollTo({ top: els.cats.offsetTop, behavior: 'smooth' });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== els.q && !els.modal.open) {
      e.preventDefault();
      els.q.focus();
    }
  });

  new IntersectionObserver((entries) => entries[0].isIntersecting && renderMore(), { rootMargin: '800px' }).observe(els.sentinel);

  persistSaved();
  syncControls();
  renderSkeleton();
  load();
})();
