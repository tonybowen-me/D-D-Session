# Loop Library

Free crochet patterns from independent designers, all in one searchable gallery.

Loop Library reads the public WordPress REST API of about two dozen crochet blogs (Moogly, Repeat Crafter Me, Daisy Farm Crafts, Hooked by Kati, and more). It keeps only the title, thumbnail, a short blurb, and a link. Each pattern is sorted by keyword into a category (amigurumi, blankets, granny squares, hats…), a type (pattern / roundup / stitch tutorial), and a beginner-friendly flag. Every card links to the designer's own page.

- Plain Node (18+). No dependencies, no build step, no database.
- Refreshes every 6 hours and caches to `data/patterns.json`. A server with no cache fills the gallery in progressively on first boot (about 40s).
- Favorites stay in `localStorage`. Filters are kept in the URL so you can share them.

## Run locally

```sh
npm start            # http://localhost:3000
npm run collect      # optional: refresh the cache once and print per-designer counts
```

| Env var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `REFRESH_HOURS` | `6` | How often to re-fetch designers |
| `MAX_PAGES` | `3` | Pages of 100 posts fetched per designer |
| `CACHE_FILE` | `data/patterns.json` | Where the cache is written |

## Add a designer

Add `{ id, name, url }` to `lib/sources.js`. The site needs `https://<site>/wp-json/wp/v2/posts` to be reachable. Category and type rules are in `lib/classify.js`. They're re-applied to the cache on every boot, so changing a rule doesn't require a refetch.

## Deploy on Render

New → **Web Service** → connect this repo, then:

- **Runtime:** Node
- **Build command:** *(leave empty)*
- **Start command:** `node server.js`
- **Health check path:** `/healthz`
- **Instance type:** Free works. The disk is ephemeral, so after each deploy or restart the cache rebuilds in about 40s while the page shows a progress bar.

Or click **New → Blueprint** and use the included `render.yaml`.
