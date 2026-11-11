# Qualitour Astro modernization — staging acceptance

Accepted source: `940c8a80bf5a21485ee8f48b193823210e2e4551`.
Published staging: <https://qualitour.ca/staging/>.
GitHub: <https://github.com/sslnyx/qualitour-astro/actions/runs/42984258410> (success).

The user authorized SEO/build repairs, sequential Astro upgrades and staging publication. No WordPress production write or root migration was performed. The original checkout's unrelated homepage review/featured edits remain outside this release.

## Result

- Astro5→6→7.4.10, matching React integration7.1.7, Tailwind4.3.5; Node24.19.0/npm11.17.0 pinned.
- Complete initial HTML for192 English and63 Chinese tours, with255 unique titles/descriptions, clean canonicals, validated alternate-language pairs and factual structured data. Primary text no longer waits for a browser API request.
- Consistent cPanel static default for development/build/preview. Public WordPress full-detail snapshots use bounded concurrency and fail closed on incomplete data. Content refreshes on each build; only images have a cross-run cache.
- Staging indexing headers/meta, canonical301 redirects and cache rules are confined to staging. Production build-only output has a separate sitemap/indexing contract and cannot pass the staging deployment guard.
- GitHub performs tests, source checks, full build and generated-output checks before backups and checksum publication. Assets precede HTML, Apache settings follow, manifest is last. Publication failures restore affected files. A later public smoke failure is a separate failure and is not an automatic rollback.

## Measured release

| Measurement | Observed |
|---|---:|
| GitHub job |4m46s, including setup/post-job work|
| Dependency installation |6s|
| Build step, including refresh/finalization |67s|
| Astro's own build timer |65s|
| Tour detail snapshot, English |7.71s /192 tours|
| Tour detail snapshot, Chinese |4.05s /63 tours|
| Page rendering |43.82s /358 pages|
| Backup/publication |166.75s /604 uploads,21 unchanged files skipped|
| Local final build |42.162s|

This first upgraded release uploads many changed files and new image outputs. It is not a warm incremental/no-change deployment benchmark. Previous62s no-change runs are not comparable with this full-content release. No speedup percentage or token/cost saving is claimed.

## Verification actually performed

- 43 automated regressions passed; source check reports0 errors and0 warnings (existing informational hints remain).
- Full358-page build at Astro5,6 and7; final6→7 URL/title/description/alternate/schema inventory unchanged.
- Production **build only**:358 pages,338 indexable canonical sitemap URLs including all255 tours. Staging uploader rejects this output. No production output was uploaded.
- GitHub public smoke:10 exact HTML hashes, noindex/cache headers,3 explicit canonical301 redirects preserving a query string, and immutable asset cache headers.
- After publication, all358 clean public HTML URLs match the release manifest and staging indexing expectations. Two transient local DNS failures passed individual retries. This is a raw HTML/header check, not a browser visit to every page.
- Chrome desktop1280×900: English tour H1/metadata/hero, overview/photos tabs and loaded gallery images; catalogue Yellowknife filter yields4 matching tours and correct URL.
- Chrome viewport emulation390×844: Chinese itinerary tab/day expansion and blank inquiry modal; document width375≤390. This is viewport emulation, not physical-device testing.
- Actual JavaScript-disabled Chrome against published Chinese tour: H1 and all seven itinerary day bodies available; itinerary2121px, first day205px. JavaScript restored afterwards.
- No inquiry/newsletter/booking/payment submitted. No live delivery test. No measured Core Web Vitals, Search Console or ranking validation. Console errors observed were browser-extension module failures; no application hydration error was observed.
- Production homepage title/canonical/status and root robots.txt, sitemap_index.xml and tour-sitemap.xml match the pre-release read-only baseline (the three static responses match SHA256). No root staging-noindex rule was added.

## Recovery and handoff

Local artifact directory:
`/Users/ning/Local Sites/qualitour/backups/github-staging-42984258410/staging-release-42984258410/`

- `dist/qualitour-release.json` identifies the accepted source and published checksums.
- `staging-backup/restore-map.json` records361 existing original files and243 new paths. All361 downloaded old-file hashes verified. The old manifest inside the backup is an original file, not the accepted release manifest.
- Original bytes are beneath `staging-backup/` itself, preserving relative paths (there is no `files/` subdirectory).
- GitHub artifact retention14 days; local copy retained. Backup integrity was checked, but no full hosting restore rehearsal was performed. Automated rollback behavior has fake-FTP regression coverage.

Working source:
`/Users/ning/Local Sites/qualitour/qualitour-astro-modernization`

Use this persistent worktree for follow-up. The older `qualitour-astro` checkout contains unrelated pending user edits; do not reset, sweep, deploy or silently replace them. `npm run deploy:staging` dispatches reviewed GitHub main, never dirty local source. SSH remains unavailable; no SSH/SFTP attempt was made.

An existing Cloudflare Pages Git integration also reported a successful build for this source, with preview URL `https://b87fe19a.qualitour-astro.pages.dev/`. Public requests to it and `https://qualitour.isquarestudio.com/` returned403, so its content/custom-domain behavior was not verified. Its account settings were not modified; the explicit legacy Cloudflare build configuration remains in source. A Pages check is not proof of cPanel publication.

Before any future production migration, separately inventory old WordPress `/tour/.../` URLs and Chinese equivalents, validate redirects and preserve WordPress backend/API routing. The build-only production rules are not authorization or sufficient acceptance for replacing the root site.

Screenshots:
- `/Users/ning/.codex/visualizations/2026/11/11/01a1c8d8-7a7a-74e0-8888-43dcf46f0439/qualitour-astro7-staging-desktop.png`
- `/Users/ning/.codex/visualizations/2026/11/11/01a1c8d8-7a7a-74e0-8888-43dcf46f0439/qualitour-astro7-staging-mobile.png`

The first CI attempt exposed undeclared Node type dependencies hidden by an ancestor local installation; it stopped before publication. Direct `@types/node` and explicit compiler types fixed the clean-environment failure; the accepted clean CI passed all checks.
