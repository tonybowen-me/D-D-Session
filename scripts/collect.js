// One-off: refresh the pattern cache and print a per-designer summary.
const path = require('path');
const { Collector } = require('../lib/collector');

(async () => {
  const c = new Collector({ cacheFile: path.join(__dirname, '..', 'data', 'patterns.json'), maxPages: Number(process.env.MAX_PAGES) || 3 });
  await c.refresh();
  for (const s of c.snapshot().sources) console.log(`${s.ok ? 'ok ' : 'ERR'} ${String(s.count ?? 0).padStart(4)}  ${s.name}${s.error ? `  (${s.error})` : ''}`);
  const types = {};
  for (const p of c.state.patterns) types[p.type] = (types[p.type] || 0) + 1;
  console.log(types);
})();
