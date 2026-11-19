# CMS Worker — `qualitour`

This folder is the **CMS Worker project**: the EmDash CMS, its admin and plugins, the runtime that serves the CMS API and renders the public pages, and the glue to the booking API. It is **not** where public page UI lives. For that, see [../AGENTS.md](../AGENTS.md).

- Wrangler config: [../wrangler.qualitour.jsonc](../wrangler.qualitour.jsonc); Astro config: [../astro.config.worker-cms.mjs](../astro.config.worker-cms.mjs)
- Entry: [src/emdash-free-worker.ts](src/emdash-free-worker.ts)
- Bindings: D1 `DB` (CMS) and `TRANSFER_DB` (booking), R2 `MEDIA`, KV `SESSION`, Durable Object `CMS_RUNTIME`
- URL: `https://qualitour.qualitour.workers.dev` (anonymous requests are redirected to `qualitour-site`; the site build uses a build key)

## What is in here

| Path | Contents |
| --- | --- |
| `src/emdash-free-worker.ts` | Worker entry: routing, durable runtime, site gate, booking API hand-off |
| `src/lib/cms/` | Native-site routing policy (`native-site-policy.mjs`), page data and SEO, cache policy, snapshot KV, media passthrough |
| `src/plugins/tour-editor/` | The admin tour editor |
| `src/plugins/pages-rebuild/` | Triggers the `Release qualitour-site` workflow when a tour is published, unpublished or deleted |
| `src/server/` | Proof and catalog routes (`/native-proof/*`, `/cms-proof/*`), Zaui webhook, image route |
| `scripts/lib/` | Vite/Astro plugins and importers used by the CMS build |
| `scripts/test-*.mjs` | Tests for everything above (run with `node`) |

## Not here

- Public page templates and components: `../src/pages`, `../src/components`, `../src/layouts`. The config injects those routes into this Worker. `src/components`, `src/layouts` and `src/lib` inside this folder are mostly diverged copies for the proof routes. Do not edit them to change the public site.
- Booking API logic: `../src/server/native-booking/`.
- Static site assembly and proxy: `../site/` and `../scripts/build-site.mjs`.

## Build and deploy

From a clean worktree of the commit to release:

```sh
QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev npm run build:worker
npm run deploy:worker
```

Record the previous version id (`/Users/ning/bin/cf-wrangler deployments list`) before deploying; it is the rollback. After a page or content change, the public site still needs the site release.
