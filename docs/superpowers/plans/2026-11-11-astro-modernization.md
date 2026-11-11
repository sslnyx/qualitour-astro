# Qualitour Astro modernization implementation plan

Goal: repair initial HTML/SEO and default static build, upgrade5→6→7 sequentially, publish only https://qualitour.ca/staging. Production WordPress, root robots/redirects/URLs and records must not be changed. User authorized staging release. Preserve all original pending homepage changes outside this isolated worktree.

Architecture: consistent build-time WordPress full-detail snapshot with bounded4-request concurrency, Astro static tour page and React interactive islands; canonical/alternate/schema helpers and environment-specific output; default cPanel static config with explicit legacy Cloudflare target; existing backed-up/checksummed staging publication.

Spec: docs/astro-modernization-audit-2026-11-10.md.

- [x] SEO helpers and tests, stage/prod indexing separation, unique metadata, validated alternates/schema.
- [x] Full tour HTML from snapshot; preserve visual sections, tabs, inquiry fields/targets, reviews and mobile CTA.
- [x] Unify default dev/build/preview configuration, move legacy API into conditional integration; server credentials stay server-only.
- [x] Standard build preparation/finalization; generate inventory and canonical-only sitemap for production, no submitted staging sitemap; Apache clean redirects/noindex confined to staging.
- [x] Verify Astro5 full build, route parity, HTML/SEO and current18 regression tests, meaningful new tests.
- [x] Upgrade to6 with matching integration and full build; then7 stable, matching dependencies, Node pin and build timings; typecheck and regression tests each step.
- [x] Independent architecture/correctness review, public release backup and GitHub staging release.
- [x] Public raw HTML/headers/redirects, English/Chinese desktop/mobile browser behavior, screenshot, local backup integrity and unchanged production read-only baseline.

Ownership: lead controls integration, route/data/config/dependencies/release; Muse Wonder high owns only seo.ts/helper tests; implementation worker owns only new TourPage.astro; independent review is read-only. No worker deployment. Prefer smallest arrangement; Argon currently absent from local model list. No claimed token/cost savings.

Astro5 proof: full358 pages, 192EN+63ZH complete content,46.9s including snapshot/finalization; no staging sitemap; all canonical/reciprocal alternates validated. Typecheck0 errors/warnings. Native Claude Opus5.5 high design review: no blocking issue; addressed DirectorySlash/UTF8/public-only data/backoff/upload ordering concerns, retains manifest-owned withdrawn HTML deletion. Source version6/7 work remains.

Astro6.4.8 + React integration5.0.7 proved: full358 pages,44.97s total with215 optimized image cache entries;0 check errors/warnings;42 Node/Python regression tests (including8 SEO parser/finalizer tests) passed. All358 URL/title/canonical/index records matched5; reviewer-driven description identity improvements then proved255 unique tour descriptions and titles. Full overview/itinerary/info/FAQ/photos/brochure HTML present; no generic ratings schema. Mobile inquiry now receives minimal props. CLI entry resolved from package bin declaration to support6+ layout.

Astro7.4.10 + React integration7.1.7 + Tailwind4.3.5 proved: full358 stage pages43.77s, same URL/canonical/title/description/alternate/schema inventory as6;0 typecheck errors/warnings. Production BUILD-ONLY:358 pages,338 sitemap URLs including255 indexable tours, no staging URLs, and staging verifier refused production output. Production was not deployed. Final43 regressions pass. Native code review remediations verified (unique descriptions, SSR brochure links, book alternates, mobile props8.16MB→233KB aggregate). Real no-JS Chrome found Tailwind base-layer hidden!important overrode noscript CSS; corrected fallback into same base layer, verified actual itinerary2121px/day205px height without scripts; then restored scripts. Final fresh stage build and publication pending.

Completion: source commit `940c8a80bf5a21485ee8f48b193823210e2e4551` passed GitHub run `42984258410` and published to staging. All358 public HTML responses match the release hashes, including Chinese slugs; staging noindex confirmed. All361 old-file backup hashes verified locally. Public desktop/mobile/no-JS checks passed and production read-only baseline matches. See `docs/astro-modernization-release-2026-11-11.md` for measurements, recovery location and exact coverage limits. Earlier paragraphs preserve intermediate evidence; their pending statements are historical.
