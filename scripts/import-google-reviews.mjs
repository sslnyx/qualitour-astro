#!/usr/bin/env node
// Import Google reviews into the CMS collection `google_reviews` (published = shown on the site, draft/unpublished = hidden).
// Idempotent: a review is identified by `source_id` and is never duplicated; existing entries are left alone unless --update.
// Usage: node scripts/import-google-reviews.mjs [--dry-run] [--update] [--from file|wp]
//   --from file  cms/src/data/native-site-support.json (default)      --from wp  https://qualitour.ca/wp-json/qualitour/v1/google-reviews
import { readFile } from 'node:fs/promises';
import { createCmsWriter } from './lib/cms-write.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run'), update = args.includes('--update');
const from = args.includes('--from') ? args[args.indexOf('--from') + 1] : 'file';

export function toEntry(review) {
  const when = new Date(Number(review.time) * 1000);
  if (!Number.isFinite(when.getTime())) throw new Error('Review ' + review.id + ' has no valid time');
  const sourceId = String(review.source || 'google') === 'google' && review.id != null ? `google-${review.id}` : String(review.id);
  return {
    slug: `review-${review.id}`,
    data: {
      author_name: String(review.author_name || 'Anonymous'),
      source_id: sourceId,
      rating: Number(review.rating),
      text: String(review.text || ''),
      reviewed_at: when.toISOString(),
      author_url: String(review.author_url || ''),
      profile_photo: String(review.profile_photo_url || ''),
      profile_photo_source: String(review.profile_photo_source || ''),
      local_guide: Boolean(review.local_guide),
      reviewer_reviews: Number(review.reviewer_reviews || 0),
      reviewer_photos: Number(review.reviewer_photos || 0),
      images: Array.isArray(review.images) ? review.images : [],
      source: String(review.source || 'google'),
    },
  };
}

async function load() {
  if (from === 'wp') { const r = await fetch('https://qualitour.ca/wp-json/qualitour/v1/google-reviews'); if (!r.ok) throw new Error('WordPress reviews HTTP ' + r.status); return r.json(); }
  return JSON.parse(await readFile('cms/src/data/native-site-support.json', 'utf8')).reviews;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const reviews = await load();
  const entries = reviews.map(toEntry);
  const ids = new Set(entries.map(e => e.data.source_id));
  if (ids.size !== entries.length) throw new Error('Duplicate source ids in the input');
  const cms = dryRun ? null : await createCmsWriter();
  const existing = new Map();
  if (cms) for (let page = 1; ; page++) {
    const data = await cms.request('GET', `/_emdash/api/content/google_reviews?limit=100&page=${page}`);
    for (const item of data.items) existing.set(item.data.source_id, item);
    if (existing.size >= (data.total ?? 0) || !data.items.length) break;
  }
  let created = 0, updated = 0, skipped = 0;
  for (const entry of entries) {
    const found = existing.get(entry.data.source_id);
    if (found && !update) { skipped++; continue; }
    if (dryRun) { created++; continue; }
    if (found) { await cms.request('PUT', `/_emdash/api/content/google_reviews/${found.id}`, { data: entry.data }); await cms.request('POST', `/_emdash/api/content/google_reviews/${found.id}/publish`, {}); updated++; continue; }
    const item = (await cms.request('POST', '/_emdash/api/content/google_reviews', entry)).item;
    await cms.request('POST', `/_emdash/api/content/google_reviews/${item.id}/publish`, {});
    created++;
  }
  console.log(JSON.stringify({ input: entries.length, created, updated, skipped, dryRun }));
}
