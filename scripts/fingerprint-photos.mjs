#!/usr/bin/env node
// Fingerprint every tour photo so the gallery can hide copies of the same picture.
//
// The media library holds the same picture several times (the cover, an inline figure and a gallery entry are
// separate uploads), so URL comparison cannot tell them apart. For each photo of each published tour (en + zh) this
// downloads the image once, makes a 64-bit difference hash plus its proportions with sharp, and writes
// cms/src/data/photo-fingerprints.json ({ "<url without CMS origin>": { hash, width, height } }). Existing entries are
// kept, so a rerun only fetches new photos. The runtime (native-site-image.mjs, dedupePhotoSources) uses the file;
// a photo missing from it is simply shown, so a failed fetch never hides anything.
//
// Usage: QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/fingerprint-photos.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadWorkerCmsModules } from './lib/worker-release.mjs';
import { collectTourPhotoSources, mapWithConcurrency } from '../src/lib/image-delivery.mjs';

const origin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const manifestPath = resolve('cms/src/data/photo-fingerprints.json');
const { photoFingerprintKey } = await import('../cms/src/lib/cms/native-site-image.mjs');
const known = JSON.parse(await readFile(manifestPath, 'utf8').catch(() => '{}'));

const { createCmsReader, buildCatalogue, retainPublicTranslations } = await loadWorkerCmsModules(origin);
const compatibility = JSON.parse(await readFile('src/data/cms-legacy-compat.json', 'utf8'));
const reader = createCmsReader({ origin });
const locales = {};
for (const locale of ['en', 'zh']) locales[locale] = buildCatalogue(await reader.listPublished(locale), compatibility, locale);
retainPublicTranslations(locales);

const wanted = new Map(); // key -> url to download
for (const locale of ['en', 'zh']) for (const tour of locales[locale].tours) {
  for (const url of collectTourPhotoSources(tour)) {
    const key = photoFingerprintKey(url);
    if (!known[key] && !wanted.has(key)) wanted.set(key, url.startsWith('/') ? origin + url : url);
  }
}
console.log(`[fingerprints] ${wanted.size} new photos to fingerprint (${Object.keys(known).length} already known)`);

/** 9x8 grey thumbnail; each bit says whether a pixel is brighter than its right neighbour. */
async function fingerprint(buffer) {
  const meta = await sharp(buffer).metadata();
  const { data } = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
  const rotated = meta.orientation && meta.orientation >= 5;
  return { hash: bits.toString(16).padStart(16, '0'), width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
}

const failed = [];
let done = 0;
await mapWithConcurrency([...wanted], async ([key, url]) => {
  try {
    const response = await fetch(url, { headers: { 'user-agent': 'qualitour-photo-fingerprint/1.0' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    known[key] = await fingerprint(Buffer.from(await response.arrayBuffer()));
  } catch (error) { failed.push(`${key} ${String(error).slice(0, 80)}`); }
  if (++done % 100 === 0) console.log(`[fingerprints] ${done}/${wanted.size}`);
}, 6);

const sorted = Object.fromEntries(Object.entries(known).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(manifestPath, JSON.stringify(sorted) + '\n');
console.log(JSON.stringify({ fingerprints: Object.keys(sorted).length, failed: failed.length, manifest: manifestPath }));
if (failed.length) console.log('failed (these photos are always shown):\n' + failed.join('\n'));
