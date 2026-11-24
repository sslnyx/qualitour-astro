# Site Worker — `qualitour-site`

This folder is the **frontend Worker project**: the Worker that visitors reach. Every public page is a static asset produced by crawling the CMS Worker's own rendering; the Worker script only forwards the few dynamic paths. For where page UI is edited, see [../AGENTS.md](../AGENTS.md).

- Wrangler config: [../wrangler.site.jsonc](../wrangler.site.jsonc)
- Entry: [worker.mjs](worker.mjs)
- URL: `https://qualitour-site.qualitour.workers.dev` (not yet on `qualitour.ca`)
- Bindings: service binding `CMS` to Worker `qualitour`; static `ASSETS`. No D1, R2 or KV.

## What the Worker does

- Serves static HTML and assets from `.astro/site-release/assets` (generated, not committed).
- Forwards to the CMS Worker, presented under the CMS origin: `/api/transfer/*` (booking API), `/_image`, `/_emdash/api/media/file/*`.
- Serves guest booking pages (`/book/{manage,return,receipt,claim}/<id>`) from its own `/booking-status` asset so the page and scripts come from the same release.
- Does **not** proxy the CMS admin; passkeys are bound to the CMS host.

## How the static site is made

| Step | Command / file |
| --- | --- |
| Build CMS client assets and crawl the CMS rendering | `npm run release:site` → [../scripts/release-site.mjs](../scripts/release-site.mjs), [../scripts/build-site.mjs](../scripts/build-site.mjs) |
| Release gates | Every page must be CMS-rendered 200 HTML; every published tour must exist in both languages; Workers Free asset limits hold. Any failure leaves the previous release untouched |
| Tests | `npm run test:site` ([../scripts/test-site-worker.mjs](../scripts/test-site-worker.mjs)) |
| Deploy | GitHub workflow `Release qualitour-site` (`.github/workflows/site-release.yml`, lives on `main`, builds the branch in `SITE_SOURCE_REF`), or `npm run deploy:site` on a workstation |

## When to change which folder

- Page look or content structure: not here. Edit `../src/…`, deploy the CMS Worker, then run the site release.
- A path must reach the CMS Worker (or stop reaching it): edit [worker.mjs](worker.mjs) and `run_worker_first` in [../wrangler.site.jsonc](../wrangler.site.jsonc), then `npm run deploy:site`.
- The site must not be built before the CMS Worker has the new code, or the crawl will publish the old pages.
