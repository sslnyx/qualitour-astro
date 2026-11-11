# Zaui manual synchronization — staging release

Scope authorized: manual Zaui product synchronization, saved public JSON, shared home/private-transfer rendering, staging publication only. No production write, scheduled job or new provider. Source commit: `92576ade66e2c6108024d80f2adf4816e174de55`.

GitHub run: <https://github.com/sslnyx/qualitour-astro/actions/runs/43056598766>.
Staging pages: <https://qualitour.ca/staging/>, <https://qualitour.ca/staging/private-transfers>, <https://qualitour.ca/staging/zh>, <https://qualitour.ca/staging/zh/private-transfers>.
Snapshot URL: <https://qualitour.ca/staging/data/private-transfers.json>.

## Local evidence

- Strict live sync completed in118.01 seconds. All32 unique activities validated against their requested IDs and returned price dates. Nine routes/34 direction+vehicle entries; all34 have numeric CAD prices, source descriptions and HTTPS images.
- Zaui account timezone: America/Vancouver. Price reference date:2026-11-12. Completed fetch timestamp:2026-11-11T16:12:31.904Z. These are reference prices; final dated quotes and availability remain on Zaui.
- Normalized public JSON:42056 bytes, SHA256 `14c2da575d9dee6899804d539a9ecb318bce5cff93b93e80822b269a71dd048c`. Only allowlisted fields; no raw API payload or credential in public output.
- Existing local credential consumed in memory from the ignored environment file; no credential uploaded, migrated or rotated. Exact credential-value scan across441 source/output text files:0 matches.
- Full61 regressions:36 Node and25 Python, all pass. Source typecheck0 errors/0 warnings (48 existing informational hints). Local build41.771 seconds:358 HTML pages plus the static JSON endpoint. Release verifier confirms the JSON route data exactly matches both languages' detail pages and homepage first3-route subsets.
- Independent read-only code/data review: no remaining material blocker. Fixed missing/wrong returned date acceptance, incomplete product data acceptance and truncated route configuration acceptance with failing-then-passing regressions. Initial pre-review sync was stopped before replacement; strict rerun supplied the accepted snapshot. Native Node runtime import resolution failure was fixed using the explicit TypeScript extension before the final green suite.

## Storage and future manual use

Authoritative source is `src/data/zaui-transfer-routes.json` in the persistent worktree `/Users/ning/Local Sites/qualitour/qualitour-astro-modernization`. A static byte-identical copy is generated for cPanel. Builds read the committed snapshot directly; they make no Zaui request and ignore the former `.astro/zaui-cache`.

```sh
npm run sync:zaui -- --env-file '/Users/ning/Local Sites/qualitour/qualitour-astro/.env'
```

The existing ignored environment file supplies only the manual command's API configuration. Optional `--date YYYY-MM-DD`; default is tomorrow in the verified account timezone. Keep credentials out of command arguments/output. The command serializes requests, waits2 seconds between product calls, uses60-second timeouts and up to3 transient-error attempts, verifies all9/34/32 mappings, then atomically renames the complete JSON. Failed collection leaves prior JSON unchanged. A lock prevents concurrent sync writes.

Previous local bytes are under `.astro/zaui-sync/history/` (ignored, mode0600). The first archive is the historical fallback format and requires the corresponding old reader if rebuilding it; GitHub's visitor-file backups restore the complete prior published output directly. Backup hash checks are integrity evidence, not a hosting restore rehearsal.

Review/commit synchronized JSON, then use the existing GitHub main staging release. Local synchronization alone does not alter published HTML. The compatibility `scripts/prefetch-zaui.js` validates saved data only; it no longer contacts the API. Booking links and iframes remain Zaui-owned; no checkout or inquiry is submitted during acceptance.

## Public acceptance

Accepted: GitHub run43056598766 succeeded. Job110 seconds; build step66 seconds; checksum publication7.25 seconds. Uploaded6 changed/new files and skipped620 unchanged files. Build logs load the shared snapshot; no live Zaui credentials/request required by CI.

- Public JSON bytes match the source SHA256 exactly. Both homepages contain exactly its first3 routes; both private-transfers pages contain all9, with identical details/prices/metadata. Snapshot is served as application/json, no-cache and staging noindex.
- GitHub smoke validates11 exact response hashes (including JSON), indexing/cache headers,3 canonical301 redirects and immutable assets. Existing SEO validation covers358 generated HTML pages; unchanged pages are retained by checksums.
- Chrome1280×900: all9 prices/dates visible; first route toggles YVR→Whistler CAD465 to reverse CAD435; real reverse activity description and Azure-hosted image load; booking modal iframe targets Zaui activity20. No inquiry/booking/payment submitted. Zaui iframe console emitted its own Facebook Pixel ID and Cart stack messages; an end-to-end checkout is not part of this acceptance, and no application hydration error was observed.
- Chrome390×844 viewport emulation: Chinese private-transfer card/currency/date/buttons fit, document width375≤390. Both homepages show3 shared cards with no horizontal overflow. This is not physical-device testing. Temporary viewport override restored.
- Before/after production reads match homepage title/canonical/status/indexing header and SHA256 of root robots.txt, sitemap_index.xml and tour-sitemap.xml. No production write occurred.
- Downloaded artifact: `/Users/ning/Local Sites/qualitour/backups/github-staging-43056598766/staging-release-43056598766/`. All4 original-file backup hashes verified; restore map records2 newly added paths. Full old visitor output can be recovered from this mapping and retained immutable assets. No hosting restore rehearsal was performed.
- Local prior JSON archive was compared byte-for-byte with the original committed historical file. GitHub recovery artifacts retain14 days; local copy retained.

Screenshots:
- `/Users/ning/.codex/visualizations/2026/11/11/01a1c8d8-7a7a-74e0-8888-43dcf46f0439/zaui-shared-routes-staging-desktop.png`
- `/Users/ning/.codex/visualizations/2026/11/11/01a1c8d8-7a7a-74e0-8888-43dcf46f0439/zaui-shared-routes-staging-mobile.png`

Machine-readable proof: `docs/zaui-manual-sync-validation.json`. Future synchronization remains manual: fetch and validate, review/commit JSON, then rebuild/publish staging. No timer/webhook was newly enabled.
