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

The build refreshes public WordPress data, snapshots complete tour content with at most four detail requests at a time, renders initial HTML, and validates metadata/alternate URLs. It retains only Astro's image cache between builds. No WordPress admin credential is required. Staging pages carry `noindex, follow`; their URLs and meta data still receive the full SEO validation.

## Staging publication

Push reviewed code to GitHub `main`, or use Actions → Deploy to cPanel Staging → Run workflow. `npm run deploy:staging` dispatches that workflow; it does not upload uncommitted local edits. The workflow pins Node/npm, runs tests and typechecking, builds current content, checks all tour paths/SEO, backs up changed files, then publishes verified changed assets, HTML and Apache settings. The release manifest is written last. Failed upload attempts restore affected files; recovery artifacts are kept for14 days. See `docs/github-staging-build.md` for recovery details.

Existing FTP secrets are available only to the publication step. Destination is fixed to `public_html/staging`; the uploader rejects a non-staging manifest. Public checks verify content hashes, indexing and cache headers. Old immutable assets are retained for cached pages; manifest-owned withdrawn HTML is backed up and removed.

## Environment separation

`DEPLOY_TARGET=production npm run build` is **build-only future-root validation**. It generates root canonicals, an indexable sitemap and a separate Apache ruleset. It does not authorize or perform a production deployment. A production build cannot pass the staging release guard. The live WordPress `/tour/.../` URL inventory and redirects must be reviewed before any future root launch.

The previous Cloudflare target is explicit: `build:cloudflare`, `deploy:cloudflare` and `deploy:cloudflare-staging`. These commands are not part of the cPanel release, and no Cloudflare deployment is implied by this modernization. Its webhook route is registered only by `astro.config.cloudflare.mjs` from `src/server/`.

Only `PUBLIC_*` environment variables may enter browser code. Default public API: `https://qualitour.ca/wp-json/qualitour/v1`; Chinese content comes from the separate `/zh/wp-json/qualitour/v1` endpoint. Keep credentials outside source and public output.

## SEO contract

- Every tour has server-rendered H1, overview and textual tab content; JavaScript is required for interactive controls, not primary content discovery.
- Unique tour titles/descriptions, extensionless canonicals, matching sharing URLs and truthful structured data are validated from generated HTML.
- Alternate language links exist only for known paired pages or published reciprocal tour translations. Missing translations fall back to the target-language catalogue.
- Staging and root settings remain separate. Do not change live WordPress, its root robots or its old URLs during a staging release.

See `docs/astro-modernization-audit-2026-11-10.md` and `docs/superpowers/plans/2026-11-11-astro-modernization.md` for the approved design and verification record.
