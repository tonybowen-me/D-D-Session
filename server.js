const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { Collector } = require('./lib/collector');
const { CATEGORIES } = require('./lib/classify');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS) || 6;

const collector = new Collector({
  cacheFile: process.env.CACHE_FILE || path.join(__dirname, 'data', 'patterns.json'),
  maxPages: Number(process.env.MAX_PAGES) || 3,
  refreshHours: REFRESH_HOURS,
});
collector.load();

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
};

let payloadCache = { version: -1, gz: null, raw: null };
function payload() {
  if (payloadCache.version !== collector.version) {
    const raw = Buffer.from(JSON.stringify({ ...collector.snapshot(), categories: CATEGORIES }));
    payloadCache = { version: collector.version, raw, gz: zlib.gzipSync(raw) };
  }
  return payloadCache;
}

function sendJSON(req, res) {
  const p = payload();
  const etag = `"v${p.version}-${collector.state.updatedAt || 0}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    return res.end();
  }
  const gzip = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    ETag: etag,
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
  });
  res.end(gzip ? p.gz : p.raw);
}

function sendStatic(req, res, pathname) {
  const file = path.normalize(path.join(PUBLIC, pathname === '/' ? 'index.html' : pathname));
  if (!file.startsWith(PUBLIC + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  if (pathname === '/api/patterns') return sendJSON(req, res);
  if (pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  sendStatic(req, res, decodeURIComponent(pathname));
});

server.listen(PORT, () => {
  console.log(`Loop Library on http://localhost:${PORT} (${collector.state.patterns.length} cached patterns)`);
  if (collector.isStale()) collector.refresh();
  setInterval(() => collector.isStale() && collector.refresh(), 15 * 60e3).unref();
});
