# EmDash native content proof — 2026-11-12

## Approved scope and result

Preserve the existing frontend appearance. Verify EmDash's official request-time queries, publication invalidation and R2/IMAGES compression in two isolated page types. Keep the same `qualitour` Worker, administrator accounts, databases, storage and existing optimized static frontend. No DNS cutover, new Worker, GitHub credential, Actions workflow, polling job, paid-plan upgrade or whole-site runtime migration.

| Requirement | Result | Evidence |
| --- | --- | --- |
| Published CMS content updates without build | Verified | Synthetic EN fixture draft → publish → unpublish → republish; native proof changed while Worker deployment/version remained identical. |
| Drafts remain private | Verified | Anonymous homepage retained original summary and cached render marker after draft save. |
| Native route cache invalidation | Verified | Published response MISS with a new render marker; following request HIT with identical marker. Unpublish removed only the synthetic marker while real tours stayed HTTP 200. |
| Compressed images | Verified | Actual decoded WebP responses at 480×360 and 1280×960; byte counts below. No original fallback. |
| Existing appearance | Verified within proof scope | Existing hero, cards and tour detail components; screenshots in `output/native-proof/`. Chrome 1800×944 and 390×844 emulation, no horizontal overflow; visible brand images loaded. |
| Existing visitor routes and SEO unchanged | Verified on homepage/Changjiang | Before/after status 200, title, canonical and robots meta matched. Full server HTML includes tour content through 第16天. |
| Cache isolation | Verified | Auth/Cookie requests DYNAMIC and private/no-store, anonymous cache remained intact. Preview query and missing tour 404/no-store; admin API 401/private/no-store; transfer catalog 200/no-store. |
| Entire public frontend updates automatically | Not enabled | Existing 359 visitor pages remain static. Only the two proof page types use native runtime delivery. |

## Release identity and recovery

- Source: `ee8ce1e8ec1d18470bc4944e9cb3a4443de08136`, branch `codex/emdash-native-proof-20261112`.
- Worktree: `/Users/ning/.codex/worktrees/qualitour-native-proof/qualitour-astro-modernization`.
- Base: deployed `bc80125f134fb5e59f1778b09ae6c98413a63f6a` plus booking UI `d04a247` cherry-picked as `0e2335f`.
- Worker `qualitour`, immutable ID `2e3006ccf9f04193b0b795a6ae7c49f8`, existing account `ca4d347f96116e87e8f5dbd6c62f0b30`.
- Deployed version `d4898633-a94b-4cd0-90b7-4a4cc41b6bed`; deployment `b2feddce-039f-4555-bc48-7558207747a9`.
- Recovery version before this release: `88012664-edad-4a21-9d8d-f78c249300f6`. Provider rollback is the code/config recovery route; do not delete/recreate the Durable Object or databases.
- D1 DB/TRANSFER_DB, R2 MEDIA, KV SESSION, CMS_RUNTIME namespace and historical migration retained. Encrypted `TRANSFER_SANDBOX_KEY` and legacy deploy-hook secret retained; values were never printed. Added only IMAGES binding and named proof cache entrypoint.
- Build: 359 pages, 192 English + 64 Chinese tours, two synthetic fixtures excluded, 3,358 merged assets. Astro static phase 2m 7s; CMS phase ~7.5s. Dry-run and actual provider upload accepted. Worker startup reported 83ms.
- Immediate deployment readback briefly returned the preceding release; subsequent ordinary and cache-busted public manifest reads, plus provider deployment inventory, confirmed the new exact commit. No duplicate deployment was issued.
- Source/private fixture/settings snapshots: ignored `.astro/native-proof/before/`, private files mode 0600, directory mode 0700. The broader prior normal-table SQL backup is in the main worktree `.astro/worker-merge-20261112/before/cms-normal-tables.sql`, 75,239,965 bytes, SHA256 `92e5ba16fe68f14b2219868ec944e81850f2730ff89b3ca6aa2e1fe459c7f33e`; FTS/full export was unsupported. No full R2 backup or restoration rehearsal was performed.

## Public URL coverage

- Native home section: https://qualitour.qualitour.workers.dev/native-proof/zh
- Native Changjiang: https://qualitour.qualitour.workers.dev/native-proof/zh/tours/01M77CFJT9M7H2YPYV1J8GF8PV
- Existing homepage: https://qualitour.qualitour.workers.dev/zh
- Existing tour: https://qualitour.qualitour.workers.dev/zh/tours/2027年長江全新船王-長江七號-三峽川蜀-16-日全景之旅
- Existing booking shell and transfer catalog returned 200; admin auth endpoint returned anonymous 401. Booking API remains Sandbox; no new payment was made by this proof task. Separate booking lead completed public full-page quote CAD 465, mobile modal quote/reserve/cancel, disabled-product rejection, language/deep-ID preservation and 1440/390/350-width checks. Its synthetic reservation was cancelled and stayed Unpaid; no Stripe Checkout was opened. See `booking-ui-design-2026-11-12.md` (docs-only follow-up `1514a73`).
- `/robots.txt` stayed unchanged. `/sitemap-index.xml` was already 404 before this release and remains 404; this is not evidence of a working production sitemap.

## Publication observation

Only synthetic fixture `01M75S22W89VBB2VD299MVP3TK` was edited. Original business data and published state were restored; original/final canonical-data SHA256 matched. Its revision/version history advanced from 80 to 86, as expected from the test. No customer tour was edited.

- Warm response: HIT, 17–27ms at the observed YVR edge, stable render marker.
- Draft save: still HIT/old summary/same marker.
- Publish request start to visible new content: **6,389ms**, including CMS publication request.
- First read after completed publication: **822ms**, MISS/new marker.
- Following read: **20ms**, HIT/same new marker.
- Restore: MISS, 735ms; unpublish: MISS, 682ms, fixture absent with real catalogue still 200; republish: MISS, 503ms.
- Initial first-ever native homepage request took 5,108ms; tour request 2,387ms. Subsequent invalidation misses were faster. These are local observations, not a global latency guarantee.
- Cache TTL is 300 seconds without stale-while-revalidate. A later EXPIRED response after the five-minute window was expected; a fresh warm → Cookie bypass → anonymous HIT sequence separately verified that private traffic does not replace anonymous cache.
- Provider inventory before and after the full publication sequence showed the same deployed version and deployment. No rebuild plugin was registered, and compiled server scans found no old deploy-hook notifier path.

Private raw evidence: `.astro/native-proof/publication-results.json`, `image-results.json`, `boundary-results.json`, `private-cache-separation.json`, `baseline/`, `final/`, `after/` and deployment snapshots. Do not publish private operation snapshots.

## Image evidence

| Variant | Format | Decoded dimensions | Bytes | Reduction |
| --- | --- | --- | ---: | ---: |
| Stored original | PNG | 1448×1086 | 2,503,325 | — |
| Mobile | WebP | 480×360 | 53,746 | 97.9% |
| Desktop | WebP | 1280×960 | 235,886 | 90.6% |

Official `/_image` endpoint reads MEDIA directly and transforms through IMAGES. HTML scan: 17 home images and 7 detail images, zero WordPress/retired-CMS `src` or `srcset`, zero nested image transformations. Downloads/PDFs remain original links. Mobile browser selected the 480-width hero candidate. This was a bounded transform sample, not a review of every source image/PDF or available monthly Images quota.

## Implementation and review

EmDash `getEmDashCollection`/`getEmDashEntry` query published content at request time; the compatibility adapter retains existing tour identities and content. Official route cache headers/tags are used with a narrow purge bridge because CMS computation runs in the pre-existing Durable Object. Only the named `NativeProofCache` entrypoint is cached; default entrypoint remains uncached. Publish invalidation executes inside that same named entrypoint via loopback RPC, which was demonstrated by real MISS → HIT transitions.

Read-only explorer verified current Cloudflare contracts. Independent reviewer found that auth/cookies needed bypass before cache lookup; fixed in `dcd79cb`, regression observed red then green, reviewer recheck resolved the finding. Existing image components were also changed to retain official runtime derivatives instead of wrapping them again (`ee8ce1e`), with red/green coverage. Final targeted suites: 32 runtime/cache/proof/release/booking checks; 12 image checks; 16 SEO checks; 6 asset merge checks; 20 Python static finalizer checks — all passed. Static finalizer verified all 359 generated pages.

Subagents: `/root/worker_frontend_target` owned seven new proof helper/page/layout/component/test files; `/root/hosting_code_evidence` researched cache namespace semantics; `/root/unified_worker_release_review` reviewed and rechecked cache isolation. Lead owned integration, configuration, publication experiment, image decoding, deployment and final acceptance. No token/cost savings measured. Native Claude did not independently review this proof; do not claim a two-lead review.

## SEO and remaining limits

Proof pages are server-rendered full HTML with canonical/title/language metadata, `noindex` meta and `X-Robots-Tag: noindex, nofollow`. They are not linked from the existing public homepage or added to a sitemap. Existing workers.dev pages retain their prior noindex setting. The production WordPress domain/DNS was untouched. No Search Console/indexing/ranking outcome was tested; eventual production cutover still needs production origin, indexability, sitemap and redirect verification.

This proves the bounded native path, not a finished whole-site migration. Proof inquiries/forms are disabled; runtime footer/navigation use frozen public compatibility text. The existing Changjiang artwork says 17 days while CMS text has 16; this pre-existing content mismatch was retained. Arbitrary external image fallbacks are not admitted by the proof helper. Other tours, content shapes and multilingual native routes need their own coverage before expanding native delivery. The bundled booking UI has separate public Sandbox acceptance as noted above.

Official references: [EmDash Astro integration](https://docs.emdashcms.com/coming-from/astro/), [route caching](https://docs.emdashcms.com/deployment/route-caching/), [image transformation](https://docs.emdashcms.com/deployment/cloudflare/#image-transformation), [Cloudflare per-entrypoint cache](https://developers.cloudflare.com/workers/cache/configuration/), [purge scope](https://developers.cloudflare.com/workers/cache/purge/).
