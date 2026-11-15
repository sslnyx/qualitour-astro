#!/usr/bin/env node
// Weekly sync: new Google reviews (SerpApi) → CMS collection `google_reviews`, published. Existing reviews are never
// changed or removed, so anything an editor hid or edited stays that way. Each new review's avatar and photos are copied
// into the CMS media library so they cannot expire. The CMS plugin rebuilds the site when entries are published.
// Env: SERPAPI_KEY (required); EMDASH_WRITE_TOKEN (CI) or a local CMS CLI login. Usage: node scripts/sync-google-reviews.mjs [--dry-run]
import { createCmsWriter } from './lib/cms-write.mjs';
import { mirrorToMedia } from './lib/media-mirror.mjs';
import { fetchNewReviews, identityKeys } from './lib/serp-reviews.mjs';

const GOOGLE = /^https:\/\/lh3\.googleusercontent\.com\//;
const sleep = ms => new Promise(done => setTimeout(done, ms));

async function listReviews(cms) {
  const items = [];
  for (let page = 1; ; page++) {
    const data = await cms.request('GET', `/_emdash/api/content/google_reviews?limit=100&page=${page}`);
    items.push(...data.items);
    if (items.length >= (data.total ?? 0) || !data.items.length) return items;
  }
}

export async function run({ cms, apiKey, fetchImpl, mirror = mirrorToMedia, log = console.log, pause = sleep, dryRun = false }) {
  const existing = await listReviews(cms);
  const known = new Set(existing.flatMap(item => identityKeys(item.data)));
  const { fresh, searches } = await fetchNewReviews({ apiKey, known, fetchImpl });
  const summary = { existing: existing.length, newReviews: fresh.length, searches, created: 0, mirrored: 0, kept: 0, dryRun };
  for (const entry of fresh) {
    const { data } = entry;
    if (!dryRun) {
      const tag = data.source_id.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
      if (GOOGLE.test(data.profile_photo_source)) {
        try { data.profile_photo = await mirror(cms, data.profile_photo_source, `avatar-${tag}.webp`, { maxWidth: 192 }); summary.mirrored++; }
        catch { data.profile_photo = data.profile_photo_source; summary.kept++; }
        await pause(200);
      }
      const images = [];
      for (const [index, url] of data.images.entries()) {
        if (!GOOGLE.test(url)) { images.push(url); continue; }
        try { images.push(await mirror(cms, url, `review-${tag}-${index + 1}.webp`)); summary.mirrored++; }
        catch { images.push(url); summary.kept++; }
        await pause(300);
      }
      data.images = images;
      const item = (await cms.request('POST', '/_emdash/api/content/google_reviews', entry)).item;
      await cms.request('POST', `/_emdash/api/content/google_reviews/${item.id}/publish`, {});
    }
    summary.created++;
    log(`${dryRun ? 'would add' : 'added'}: ${data.author_name} ★${data.rating} ${data.reviewed_at.slice(0, 10)}`);
  }
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cms = await createCmsWriter();
  console.log(JSON.stringify(await run({ cms, apiKey: process.env.SERPAPI_KEY, dryRun: process.argv.includes('--dry-run') })));
}
