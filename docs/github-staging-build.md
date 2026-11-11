# GitHub staging build redesign

Authorized: run and improve GitHub build/deployment to qualitour.ca/staging, preserve restored transfers, synchronize current tours. No WordPress content changes. Homepage review/featured changes in the original working tree remain excluded.

Historical baseline: run27433934072, 2026-06-12: total110s, job103s, build44s, FTP19s. Earlier run22919036546 took1551s, but expired step data does not identify the bottleneck. Do not attribute historical slowness to one cause without logs.

Plan: use a single explicit cPanel build command; refresh WordPress data each build, cache only image transformations across runs; preserve nine bundled transfer routes; replace redundant prefetch and config swapping; checksum-based incremental publication with assets first, backups and last-written release manifest; serialize deployments; validate all generated EN/ZH tour paths and data against current API; run GitHub and report real timings/public verification.

The first deployment seeds the manifest and may upload more; later builds can skip unchanged files. No deletion of old assets during publication. WP API failures must stop publication rather than cache partial tour lists.

## Verified locally

- Full cPanel build: 358 pages in 32.3 seconds (Mac, warm local image cache).
- Pre-publication verifier: 192 EN /63 ZH tours, all generated detail paths, required JS/CSS assets, nine transfer routes and shared homepage first three routes.
- 4 Node transfer regression tests and 14 Python release tests passed; targeted TypeScript check and workflow YAML parsing passed.
- Failure cleanup restores excluded API source; simulated FTP failure after rename restores previous remote state; delete permission failure cannot silently publish withdrawal. These are automated simulations, not a real-host restore rehearsal.
- Independent read-only review found missing withdrawn-page removal, retries/recovery and FTP-host parsing; fixed and covered by tests. Old immutable assets are deliberately retained for cached pages; only manifest-owned withdrawn HTML is removed.
- Fixed an existing mobile preload pointing to a nonexistent derived image filename; now uses the actual supplied hero URL. No visual layout change.

## Publication and recovery

Existing GitHub FTP credentials and destination are retained. No new hosting access or token was granted. Initial publication creates `qualitour-release.json`; later runs compare SHA-256 hashes. Immutable assets publish before HTML, each file is uploaded to a temporary name and byte-verified before rename. All changed/removed existing files are backed up first. Concurrent deployments are serialized without cancelling an in-progress upload. Retry transient transport failures up to three attempts. On terminal upload failure, restore attempted files from backup; if recovery cannot connect, the run fails and reports manual recovery required.

Recovery artifacts are retained privately on GitHub for 14 days, under `staging-release-<run-id>`. Download it; `staging-backup/restore-map.json` maps exact existing files/hashes and new paths. Restore existing files to the same paths under `public_html/staging`, remove newly introduced files, then restore the old release manifest (or remove it for a first-release rollback). No old untracked remote files are deleted. Backups are byte-preserving; this is not an atomic whole-site directory switch.

First publication includes all current files because no prior manifest exists. Subsequent runs skip files whose content hash matches the prior release manifest; direct manual edits outside this workflow require a full comparison/rebaseline. Cross-run WordPress snapshots are never restored, so every successful build uses current CMS data. Images alone use Astro's built-in image cache.

References: [Astro v5 cacheDir](https://v5.docs.astro.build/en/reference/configuration-reference/#cachedir), [GitHub concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## GitHub evidence

- First optimized run [42973094216](https://github.com/sslnyx/qualitour-astro/actions/runs/42973094216): success, 78s total; build32.2s; backup/publish13.54s; 421 files uploaded, 413 originals backed up. Public exact-hash checks passed for10 URLs.
- Same-version repeat [42973315509](https://github.com/sslnyx/qualitour-astro/actions/runs/42973315509): success, 62s total; build30.6s; publish0.29s; uploaded0, skipped421. This proves incremental uploads on unchanged content, not constant latency for every future change.
- Initial backup also downloaded to `/Users/ning/Local Sites/qualitour/backups/github-staging-42973094216`; all413 original file SHA-256 hashes verified against restore map.
- Browser initially reused old HTML on normal navigation; reload showed63 Chinese tours. Added explicit no-cache/revalidation headers for HTML/JSON in staging only, preserving asset caching. Existing old cache entries may still require a first reload before receiving the new header.
- WordPress automatic webhook dispatch is not configured or proven by these manual/push runs. Existing plugin code/settings require a separate live check before claiming fully automatic CMS synchronization.
