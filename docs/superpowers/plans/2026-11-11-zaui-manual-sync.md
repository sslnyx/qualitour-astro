# Zaui Manual Snapshot Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh read-only review before publication.

**Goal:** Manually synchronize Zaui transfer products to validated JSON, share that snapshot between both homepages and both private-transfers pages, and publish staging only.

**Architecture:** A local Node command reads the existing Zaui credential in memory, fetches account currency/timezone plus32 unique configured activities sequentially, projects public product fields and atomically replaces a versioned JSON snapshot only when complete. Astro reads only this committed JSON, and prerenders an identical public JSON endpoint on cPanel. Booking still uses Zaui; indicative cached prices do not promise date-specific availability.

**Tech Stack:** Existing Node24/npm11/Astro7/React19; no new dependency, database, provider or scheduled job.

**Spec:** User-approved description in chat: manual sync first; JSON on existing cPanel; shared homepage/private transfers; preserve last good data on errors; staging only. Runtime decisions below are the lead's implementation choices.

## Global Constraints

- Preserve production WordPress/root files and unrelated original-checkout homepage edits. Use existing clean modernization worktree.
- Preserve all9 configured routes,34 vehicle/direction entries and32 unique activity IDs. Do not infer translations, vehicle prices, currency or availability.
- Only the manual command calls Zaui. Builds require no Zaui secret, filesystem cache, lock waiting or live request.
- Read credentials from the existing ignored local environment file or explicit environment. Do not upload credentials to GitHub or publish raw API responses.
- Snapshot includes source, fetchedAt, priceDate, timezone, currency, validated public route/vehicle details. Details use the source activity ID/name; all32 records required.
- Use a60-second per-request timeout, at most3 attempts for transient failures, server retry delay when provided, and2 seconds between activity requests. All failed syncs leave existing JSON intact.
- Store only allowlisted product fields in public JSON; preserve local previous-good snapshots under ignored `.astro/zaui-sync/history/`. Atomic rename on success; exclusive sync lock prevents competing writes.
- Static `/staging/data/private-transfers.json` and the four page consumers must use identical route data. Header/meta staging noindex remains.
- No automatic schedule/webhook or form/booking submission in scope. Manually synchronize then publish reviewed main through existing backed-up staging workflow.

## Review Focus

- Empty, partial, wrong-ID or method-level error responses must stop replacement; authenticated HTTP200 alone is insufficient.
- Price values are requested for one explicit date; filesystem caches cannot silently reuse another date, and prices must remain labelled indicative.
- Raw response extras or credential values must not reach public snapshot, HTML, JS or logs.
- Atomic persistence and sync lock protect the last good JSON; a fresh build cannot prefer stale `.astro/zaui-cache` over it.
- Currency/timezone come from account settings, not an assumed `$` currency or UTC tomorrow date.

### Task1: Snapshot contract and safe manual sync

Files: `src/lib/zaui/transfer-snapshot.ts`, `scripts/lib/zaui-sync.mjs`, `scripts/sync-zaui.mjs`, `scripts/zaui-route-map.json`, `scripts/test-zaui-sync.mjs`, `package.json`.

- [x] Write/run failing regressions for complete32-ID projection, method errors, missing/mismatched products, public-field allowlist, date/currency validation, retries and preservation on failed sync/competing lock.
- [x] Implement pure validation/projection and API collection with bounded timeout/backoff. Add explicit `npm run sync:zaui -- --env-file PATH [--date YYYY-MM-DD]`.
- [x] Run meaningful regressions and execute the manual command against the authorized existing account. Keep raw product responses local/ignored if needed to diagnose shapes; never persist authentication payloads.

### Task2: Shared deterministic pages and public JSON

Files: `src/lib/zaui/zaui.ts`, `src/data/zaui-transfer-routes.json`, `src/pages/data/private-transfers.json.ts`, affected transfer cards/details copy, `scripts/test-transfer-cache.mjs`, `scripts/staging_release.py` and tests.

- [x] Test committed-snapshot precedence with stale/empty filesystem caches and forbidden fetch; assert all page consumers and public endpoint agree.
- [x] Replace the old live/cache loader with validated snapshot-only reads. Keep existing call signatures/types for consumers; remove unused live API helpers.
- [x] Publish static allowlisted JSON; show a compact reference-price caveat for fresh API prices as well as historical prices; avoid duplicated currency symbols.
- [x] Add release checks tying JSON metadata/routes to both languages and both page types; document the manual-sync/commit/build/publish sequence.

### Task3: Staging acceptance

- [x] Run full regressions, typecheck, fresh build and release verifier; review complete diff independently and resolve material findings.
- [x] Record production read-only baseline; commit/push scoped changes and finish GitHub publication with backup artifact downloaded/hash checked.
- [x] Verify public JSON bytes, both languages/homepages/private-transfers, photos/details/direction/booking target read-only, desktop/mobile screenshots, staging noindex and unchanged production baseline.
- [x] Save exact coverage, timing, backup and manual-command handoff. No scheduled automation or production migration.

Execution ledger: existing isolated worktree confirmed; baseline43 regressions passed. Added15 manual-sync regressions (RED→GREEN), including independent-review remediations for exact returned price date, complete source fields and9/34/32 configuration. Reader regressions and full build await the first validated live snapshot. Existing local credential passed a bounded read-only product probe and system currency lookup; no credential moved or published. Initial collection was intentionally stopped before any JSON replacement after review; lock owner termination confirmed and lock removed. Restarted with all strict checks active. Source check0 errors/0 warnings; independent read-only review reports no remaining material blocker.

Local acceptance: strict live sync completed118.01s;9 routes/34 numeric CAD prices/32 unique products, all descriptions/images present, response dates2026-11-12 checked, account America/Vancouver. Public snapshot42056 bytes. Full61 regressions pass; source0 errors/0 warnings; static build358 HTML pages plus JSON endpoint41.771s; release verifier confirms both languages/homepages/private-transfer routes equal published JSON. Exact credential-value scan441 source/output files:0 matches. Native Node tests exposed an extensionless TypeScript import; corrected to explicit .ts before the full green suite. Final independent review of actual JSON reports no material blocker. Kept old prefetch command as a snapshot-only compatibility reader. GitHub staging publication and public acceptance next.

Completed: GitHub run43056598766 succeeded and published source92576ad to staging. Public JSON is byte-identical to committed snapshot; both language homepages show exactly first3 routes and private-transfer pages all9. Desktop/mobile/direction/details image and booking iframe target verified without submitting. All4 prior visitor-file backup hashes and local historical archive checked. Production homepage title/canonical/status/indexing header plus root robots/sitemaps match before release. Full report: docs/zaui-manual-sync-release-2026-11-11.md. No production write or schedule enabled.
