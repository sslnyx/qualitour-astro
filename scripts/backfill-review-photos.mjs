#!/usr/bin/env node
// Move Google-hosted review photos into the CMS media library (R2) so they cannot expire, and point the reviews at them.
// Idempotent: a review whose photos are already CMS media is skipped. A photo that cannot be fetched keeps its Google
// URL and is reported (the site build still hosts it as a fallback while the URL works). Usage:
//   node scripts/backfill-review-photos.mjs [--dry-run]
import { createCmsWriter } from './lib/cms-write.mjs';
import { mirrorToMedia } from './lib/media-mirror.mjs';
export { mirrorToMedia };

const dryRun = process.argv.includes('--dry-run');
const GOOGLE = /^https:\/\/lh3\.googleusercontent\.com\//;
const sleep = ms => new Promise(done => setTimeout(done, ms));
const cms = await createCmsWriter();

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = [];
  for (let page = 1; ; page++) { const d = await cms.request('GET', `/_emdash/api/content/google_reviews?limit=50&page=${page}`); items.push(...d.items); if (items.length >= d.total || !d.items.length) break; }
  const pending = items.filter(i => Array.isArray(i.data.images) && i.data.images.some(u => GOOGLE.test(u)));
  console.log(JSON.stringify({ reviews: items.length, withGooglePhotos: pending.length, photos: pending.reduce((n, i) => n + i.data.images.filter(u => GOOGLE.test(u)).length, 0), dryRun }));
  let moved = 0, kept = 0; const failures = [];
  for (const item of pending) {
    const next = [];
    for (const [index, url] of item.data.images.entries()) {
      if (!GOOGLE.test(url)) { next.push(url); continue; }
      if (dryRun) { next.push(url); continue; }
      try { next.push(await mirrorToMedia(cms, url, `review-${item.data.source_id}-${index + 1}.webp`)); moved++; }
      catch (error) { next.push(url); kept++; failures.push(`${item.data.source_id} #${index + 1} ${String(error).slice(0, 60)}`); }
      await sleep(300); // polite to Google
    }
    if (!dryRun && next.some((u, i) => u !== item.data.images[i])) {
      await cms.request('PUT', `/_emdash/api/content/google_reviews/${item.id}`, { data: { ...item.data, images: next } });
      await cms.request('POST', `/_emdash/api/content/google_reviews/${item.id}/publish`, {});
    }
  }
  console.log(JSON.stringify({ moved, keptAsGoogleUrl: kept }));
  if (failures.length) console.log('could not move (kept as Google URLs):\n' + failures.join('\n'));
}
