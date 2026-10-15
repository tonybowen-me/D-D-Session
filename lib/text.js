const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', trade: '™', reg: '®', copy: '©',
};

function decodeEntities(s) {
  return String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

function stripTags(html) {
  return String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function cleanExcerpt(html, max = 200) {
  let t = decodeEntities(stripTags(html)).replace(/\s+/g, ' ').trim();
  t = t
    .replace(/\s*The post .* appeared first on .*$/i, '')
    .replace(/\s*\b(Read More|Continue reading|Read more)\b.*$/i, '')
    .replace(/\s*\[(…|\.\.\.)\]\s*$/, '…');
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

module.exports = { decodeEntities, stripTags, cleanExcerpt };
