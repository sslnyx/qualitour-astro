# GitHub staging build redesign

Authorized: run and improve GitHub build/deployment to qualitour.ca/staging, preserve restored transfers, synchronize current tours. No WordPress content changes. Homepage review/featured changes in the original working tree remain excluded.

Historical baseline: run27433934072, 2026-06-12: total110s, job103s, build44s, FTP19s. Earlier run22919036546 took1551s, but expired step data does not identify the bottleneck. Do not attribute historical slowness to one cause without logs.

Plan: use a single explicit cPanel build command; refresh WordPress data each build, cache only image transformations across runs; preserve nine bundled transfer routes; replace redundant prefetch and config swapping; checksum-based incremental publication with assets first, backups and last-written release manifest; serialize deployments; validate all generated EN/ZH tour paths and data against current API; run GitHub and report real timings/public verification.

The first deployment seeds the manifest and may upload more; later builds can skip unchanged files. No deletion of old assets during publication. WP API failures must stop publication rather than cache partial tour lists.
