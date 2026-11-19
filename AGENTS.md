# Qualitour website — agent map

Read this first. This branch (`codex/emdash-native-site-20261112`) is **one git repo that builds two Cloudflare Workers**. Most mistakes come from editing the right code but deploying the wrong Worker, or from editing a stale copy. Know which Worker you are touching before you change anything.

Account: Qualitour (`ca4d347f96116e87e8f5dbd6c62f0b30`). Always run Wrangler through `/Users/ning/bin/cf-wrangler`.

## The two Workers

| | CMS Worker | Site Worker (frontend) |
| --- | --- | --- |
| Name / URL | `qualitour` · `https://qualitour.qualitour.workers.dev` | `qualitour-site` · `https://qualitour-site.qualitour.workers.dev` |
| Role | EmDash CMS and admin, tour editor, content API, booking API (`/api/transfer/*`), and server-side renderer of every public page | What visitors get: static HTML and assets only. Forwards `/api/transfer/*`, `/_image` and `/_emdash/api/media/file/*` to the CMS Worker over a service binding |
| Config | [wrangler.qualitour.jsonc](wrangler.qualitour.jsonc), [astro.config.worker-cms.mjs](astro.config.worker-cms.mjs) | [wrangler.site.jsonc](wrangler.site.jsonc) |
| Entry | [cms/src/emdash-free-worker.ts](cms/src/emdash-free-worker.ts) | [site/worker.mjs](site/worker.mjs) |
| Data | D1 `DB` and `TRANSFER_DB`, R2 `MEDIA`, KV `SESSION`, Durable Object `CMS_RUNTIME` | None. Assets only |
| Built by | `npm run build:worker` | `npm run release:site` (builds, then crawls the CMS Worker's HTML) |
| Deployed by | `npm run deploy:worker` | GitHub workflow `Release qualitour-site` (or `npm run deploy:site` from a workstation) |

**The site is a crawl of the CMS Worker's rendering.** Pushing code changes nothing visitors see until the CMS Worker is redeployed *and then* the site is rebuilt. Order: CMS Worker first, site release second.

## Where to edit

| You want to change | Edit here | Then release |
| --- | --- | --- |
| Public page UI: layout, header/footer, tour list/detail, home, hero, styles, i18n | `src/` (`src/pages/[...lang]/…`, `src/components`, `src/layouts`, `src/styles`, `src/i18n`) | CMS Worker, then site |
| Page routing rules / which URLs exist | [cms/src/lib/cms/native-site-policy.mjs](cms/src/lib/cms/native-site-policy.mjs) | CMS Worker, then site |
| CMS admin, tour editor, pages-rebuild plugin, CMS runtime, caching, site gate | `cms/` (`cms/src/plugins`, `cms/src/lib/cms`, `cms/scripts/lib`) | CMS Worker (site only if pages change) |
| Booking API embedded in the CMS Worker | `src/server/native-booking/` | CMS Worker (site only if pages change) |
| Booking pages `/book`, `/zh/book` | `src/pages/[...lang]/book.astro`, `src/components`, `src/lib/booking` | CMS Worker, then site |
| Site proxy rules (what the site forwards to the CMS) | [site/worker.mjs](site/worker.mjs) and `run_worker_first` in [wrangler.site.jsonc](wrangler.site.jsonc) | Site only (`deploy:site`) |
| Crawl / asset assembly / release gates for the static site | `scripts/build-site.mjs`, `scripts/release-site.mjs`, `scripts/test-site-worker.mjs` | Site |
| CMS combined-Worker build, bindings guard, deploy guard | `scripts/build-worker.mjs`, `scripts/deploy-worker.mjs`, `scripts/lib/worker-release.mjs` | CMS Worker |

## Traps

- **`cms/src` is Astro's `srcDir` for the CMS build, but public pages are not in it.** [astro.config.worker-cms.mjs](astro.config.worker-cms.mjs) injects the public routes from `./src/pages/…`, and those pages import `src/components`, `src/layouts` and `src/lib`. Many files in `cms/src/components`, `cms/src/layouts` and `cms/src/lib` are diverged copies used by the proof routes (`/native-proof/*`, `/cms-proof/*`). **Do not edit them to change what visitors see.** Check which file the page actually imports before editing.
- **Cross-imports are real.** `cms/` imports `src/lib/cms/*`, `src/lib/seo.ts` and `src/data/cms-legacy-compat.json`; `src/` imports `cms/src/lib/cms/native-site-seo.mjs`. Treat `src/lib/cms` and `cms/src/lib/cms` as one shared boundary and run both test sets after changing either.
- **Legacy cPanel/WordPress line.** `astro.config.cpanel.mjs`, `astro.config.pages-static.mjs`, `astro.config.cloudflare.mjs`, `astro.config.mjs`, `wrangler.toml`, `npm run build`, `deploy:staging`, `scripts/staging_release.py` and `src/lib/wordpress` belong to the old `qualitour.ca/staging` flow. [README.md](README.md) describes that flow. Do not use it to deploy the Workers.
- **Local `npm run dev`.** The `getSiteNavData` stub in `src/lib/wordpress/api.ts` returns empty destinations/styles locally, so the destination chips and category pages (`/tours/destination/<slug>`, `/tours/style/<slug>`) only work for real on the CMS Worker. Set `QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev` for the CMS login. Verify category pages live after a release.
- **Never deploy from a stale or dirty tree.** `deploy:worker` checks the build marker against `git rev-parse HEAD`. Build and deploy from a clean checkout of the exact commit.

## Release (public site)

1. Commit on `codex/emdash-native-site-20261112`. Other sessions push here too: fetch and check ahead/behind first.
2. Clean worktree, `npm ci`, then `QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev npm run build:worker && npm run deploy:worker`. Note the previous version id from `cf-wrangler deployments list` as the rollback point.
3. Push the branch.
4. `gh workflow run site-release.yml --repo sslnyx/qualitour-astro --ref main`. The workflow file lives on `main` and builds `SITE_SOURCE_REF` (default: this branch). It needs the CMS build key and read token as repository secrets.
5. Check the live URL: pages return 200, changed pages show the change in both `/` and `/zh`.

Tests: `npm run test:site`, `npm run test:worker`, and the individual `node cms/scripts/test-*.mjs` files that match the area you changed. `.github/workflows/site-release.yml` lists the set the release runs.

## Related repositories and folders

- **Private Transfer / operations app** is a separate repo (`qualitour-ops`, local `Local Sites/qualitour/qualitour-ops`). Its booking API is bundled into the CMS Worker from `src/server/native-booking/`. Its own Workers and staging D1 are deployed from that repo.
- **Local folder `Local Sites/qualitour/qualitour-astro-modernization`** holds the git store for all worktrees of this repo and is checked out on the archived branch `archive/astro-modernization-20261111-branch` (tag `archive/astro-modernization-20261111` on GitHub, 2026-11-19). Do not move it, and do not treat its working tree as the live site. Work in a worktree on this branch (`/Users/ning/.codex/worktrees/qualitour-*`).
- `Local Sites/qualitour/qualitour-astro` is the old cPanel-era `main` checkout.

`archive/` holds files that nothing uses any more (see [archive/README.md](archive/README.md)). Do not build on them.

Per-Worker notes: [cms/README.md](cms/README.md), [site/README.md](site/README.md).
