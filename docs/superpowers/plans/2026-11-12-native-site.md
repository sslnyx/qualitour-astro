# Whole-site native EmDash implementation plan

> **For agentic workers:** Use executing-plans for lead integration and bounded implementation workers for independent projection/route tasks. Preserve all unrelated work.

**Goal:** Extend the verified request-time CMS publication path to all existing visitor page types, preserving their templates, public slugs, SEO and compressed images.

**Architecture:** Reuse the existing root Astro pages by injecting them into the existing CMS server build. A runtime-only data/image module boundary replaces build-file/WordPress tour reads with published native EmDash queries; existing non-CMS reviews/company data is a public support snapshot, and static page copy remains unchanged. The existing cached named Worker entrypoint and scoped invalidator cover visitor HTML only, around the retained CMS Durable Object. Booking/APIs/admin/media/assets keep their current boundaries. No GitHub/polling/DNS/new Worker or storage changes.

**Tech Stack:** Existing Astro7.4.10/EmDash1.4.0/Cloudflare adapter14.4.7/Wrangler4.125.0; npm, no dependency upgrades.

**Spec:** Ning approved the tested native approach and explicitly requested whole-site expansion with unchanged appearance/SEO on2026-11-12. Prior proof report: docs/verification/2026-11-12-emdash-native-content-proof.md.

## Global constraints

- Same qualitour Worker/account/D1/R2/KV/DO migration and Sandbox secrets; no production DNS/indexability cutover.
- Existing imported EN/ZH paths, titles/descriptions/canonicals/hreflang/schema and form behavior must stay intact. Server-render full HTML.
- Reuse existing page templates; no copied redesign or CMS proof footer on real pages.
- Query all published pages of each locale; no100-row truncation or process-global stale content.
- Drafts/preview/auth/Cookie/non200 responses cannot enter shared visitor cache; booking/API/admin never use that cache.
- Stored originals/download PDFs unchanged; display images remain derivatives. Existing raw image fallbacks cannot silently substitute megabyte originals.
- Static frontend is a recovery/assets build, not authoritative content for public visitor routes after cutover.

## Review focus

1. Imported slug/locale/alias/hreflang parity, including empty taxonomy pages and duplicate titles.
2. New CMS-native entries without frozen legacy keys, plus publication/unpublish and translation relations.
3. Beyond100 entries, request-scoped memoization and invalidation from the CMS Durable Object.
4. Auth/Cookie/edit/preview isolation before shared lookup; errors must not resurrect static stale tour HTML.
5. Inline/gallery/hero presentation and unchanged forms/reviews/company details on reused templates.

## Tasks and ownership

- [ ] Lead: snapshot current release and359-page SEO/structure baseline; public representative redirects; retain recovery version.
- [ ] Data worker: new runtime projection/query/API/image modules plus focused tests; imported and native-created published tours, complete EN/ZH pagination, request-only memoization, safe media, reciprocal translations and counts. No root page template changes.
- [ ] Route worker: six root route frontmatter fallbacks, pure native-site-page-props helper and tests; preserve getStaticPaths/template bodies and all current alias/taxonomy/SEO rules.
- [ ] Lead: runtime-only aliases, injected existing pages, route prerender override, middleware with published catalogue and page props, strict visitor route policy/cache and original default/CMS/booking routing. Preserve original support copy via generated public snapshot.
- [ ] Lead: meaningful red/green policy/projection/SEO checks, builds and exact-source release gates, compiled dependency scan (no build credential/file snapshot reader on visitor runtime).
- [ ] Independent reviewer: frozen diff cache/data/privacy/SEO review; resolve material findings before deployment.
- [ ] Lead: deploy SAME Worker, verify full current path inventory and SEO fields, desktop/narrow original templates/interactive filters/forms, decoded image dimensions/bytes; publish synthetic fixture through visitor projection, prove draft privacy/MISS→HIT/no deployment, unpublish404/list removal, restore data. No customer-tour content edits.
- [ ] Lead: final report/handoff with actual coverage, release/recovery versions, native/static scope and limits. Do not claim every hardcoded page became CMS-editable.
