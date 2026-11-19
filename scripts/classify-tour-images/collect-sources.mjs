#!/usr/bin/env node
// Step 1 of the tour image classification: list every picture the tour galleries use, keyed the way the tour page
// finds it at render time (the CMS media path, or the original address of a picture mirrored into the media library),
// with the name the static site gives it (m-<first 16 hex of sha1(media path)>, as in scripts/build-site.mjs).
// Needs read access to the CMS (CLI login on a workstation, or EMDASH_TOKEN).
//   QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/classify-tour-images/collect-sources.mjs <out.json>
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { syncCmsSnapshot } from '../../src/lib/cms/content-server.mjs';
import { createCmsReader } from '../../src/lib/cms/read-client.mjs';
import { collectTourPhotoSources } from '../../src/lib/image-delivery.mjs';

const MEDIA = /\/_emdash\/api\/media\/file\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif|avif)(?![A-Za-z0-9._-])/;
const remote = JSON.parse(await readFile(new URL('../../src/data/remote-image-map.json', import.meta.url), 'utf8'));
const mirrored = href => remote[href] ?? (() => { try { return remote[new URL(href).href]; } catch { return undefined; } })();

const snapshot = await syncCmsSnapshot({ reader: createCmsReader() });
const refs = {};
for (const locale of ['en', 'zh']) for (const tour of snapshot.locales[locale].tours) for (const raw of collectTourPhotoSources(tour)) {
  const media = raw.match(MEDIA)?.[0];
  const path = media ?? mirrored(raw);
  if (!path) continue;
  const id = 'm-' + createHash('sha1').update(path).digest('hex').slice(0, 16);
  refs[media ?? raw] = id;
  if (!media) { try { refs[new URL(raw).href] = id; } catch {} }
}
await writeFile(process.argv[2], JSON.stringify(refs, null, 0) + '\n');
console.log(`${Object.keys(refs).length} picture references, ${new Set(Object.values(refs)).size} distinct media files`);
