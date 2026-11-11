# Qualitour Astro frontend

WordPress supplies public content; Astro pre-renders HTML for cPanel. React islands handle search, tour tabs/photos and inquiry forms. GitHub publishes **only** `https://qualitour.ca/staging/`; the live WordPress site at the domain root is separate.

## Local development

Use Node from `.node-version` and the npm version declared in `packageManager`:

```sh
npm ci
npm run dev
```

The default development URL includes `/staging`. `npm run build` and `npm run preview` use the same static hosting/base/site settings. `build:cpanel` is a compatibility alias. No API source files are moved during builds.

```sh
npm run test:staging
npm run check
npm run build
python3 scripts/staging_release.py verify
npm run preview
```

The build refreshes public WordPress data, snapshots complete tour content with at most four detail requests at a time, renders initial HTML, and validates metadata/alternate URLs. It retains only Astro's image cache between builds. No WordPress admin credential is required. Zaui transfer data comes from a committed manual snapshot, never a live build request or temporary cache. Staging pages carry `noindex, follow`; their URLs and meta data still receive the full SEO validation.

## Manual Zaui transfer synchronization

Use an existing local environment file containing `ZAUI_API_TOKEN`, `ZAUI_ACCOUNT_ID`, `ZAUI_USER_ID` and optionally `ZAUI_API_URL`. Credentials stay in that ignored file/process memory and are never sent to GitHub. From this worktree:

```sh
npm run sync:zaui -- --env-file '/Users/ning/Local Sites/qualitour/qualitour-astro/.env'
# Optional explicit price date:
npm run sync:zaui -- --env-file /path/to/existing.env --date 2026-11-12
```

Environment variables can supply the same settings without `--env-file`. Do not put token values in command arguments. The command reads the account's currency/timezone and32 configured products sequentially (2 seconds between product requests,60-second request timeout, up to3 transient-error attempts). Without `--date`, it requests tomorrow in the Zaui account's timezone. This is a reference price for that date, not an availability or final booking quote.

Only a complete validated result replaces `src/data/zaui-transfer-routes.json`, using an atomic rename and an exclusive sync lock. Previous bytes are backed up under ignored `.astro/zaui-sync/history/`; raw authentication/API responses are not published. On failure the previous JSON remains intact. A leftover `src/data/zaui-transfer-routes.json.lock` after a killed process must be inspected and removed only after confirming no sync process is running.

Review/commit the resulting JSON and code, then use the normal GitHub staging release. Both languages' homepages use its first3 routes; both private-transfers pages use all9. An identical static copy is published at `/staging/data/private-transfers.json`. Updating local JSON alone does not update published HTML: the build/publication step is still necessary. No schedule or webhook is enabled by this command, and an ordinary build requires no Zaui secret or API request.

Product/vehicle mapping lives in `scripts/zaui-route-map.json`. A missing, unpublished or wrong-ID product stops synchronization instead of silently removing a route or accepting partial data. Review intentional catalogue removals before updating the map. Booking links/iframes remain on Zaui.

## Staging publication

Push reviewed code to GitHub `main`, or use Actions → Deploy to cPanel Staging → Run workflow. `npm run deploy:staging` dispatches that workflow; it does not upload uncommitted local edits. The workflow pins Node/npm, runs tests and typechecking, builds current content, checks all tour paths/SEO, backs up changed files, then publishes verified changed assets, HTML and Apache settings. The release manifest is written last. Failed upload attempts restore affected files; recovery artifacts are kept for14 days. See `docs/github-staging-build.md` for recovery details.

Existing FTP secrets are available only to the publication step. Destination is fixed to `public_html/staging`; the uploader rejects a non-staging manifest. Public checks verify content hashes, indexing and cache headers. Old immutable assets are retained for cached pages; manifest-owned withdrawn HTML is backed up and removed.

## Environment separation

`DEPLOY_TARGET=production npm run build` is **build-only future-root validation**. It generates root canonicals, an indexable sitemap and a separate Apache ruleset. It does not authorize or perform a production deployment. A production build cannot pass the staging release guard. The live WordPress `/tour/.../` URL inventory and redirects must be reviewed before any future root launch.

The previous Cloudflare target is explicit: `build:cloudflare`, `deploy:cloudflare` and `deploy:cloudflare-staging`. These commands are not part of the cPanel release. The repository also has an existing Cloudflare Pages Git integration, which can independently start a Pages build on a push; its project settings have not been changed in this release. The legacy webhook route is registered only by `astro.config.cloudflare.mjs` from `src/server/`. See the release report for the observed check and verification limits.

Only `PUBLIC_*` environment variables may enter browser code. Default public API: `https://qualitour.ca/wp-json/qualitour/v1`; Chinese content comes from the separate `/zh/wp-json/qualitour/v1` endpoint. Keep credentials outside source and public output.

## SEO contract

- Every tour has server-rendered H1, overview and textual tab content; JavaScript is required for interactive controls, not primary content discovery.
- Unique tour titles/descriptions, extensionless canonicals, matching sharing URLs and truthful structured data are validated from generated HTML.
- Alternate language links exist only for known paired pages or published reciprocal tour translations. Missing translations fall back to the target-language catalogue.
- Staging and root settings remain separate. Do not change live WordPress, its root robots or its old URLs during a staging release.

See `docs/astro-modernization-audit-2026-11-10.md` and `docs/superpowers/plans/2026-11-11-astro-modernization.md` for the approved design and verification record.
