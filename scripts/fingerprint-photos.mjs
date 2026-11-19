#!/usr/bin/env node
// Fingerprint every tour photo so the gallery can hide copies of the same picture.
//
// The media library holds the same picture several times (the cover, an inline figure and a gallery entry are
// separate uploads), so URL comparison cannot tell them apart. For each photo of each published tour (en + zh) this
// downloads the image once, makes a 64-bit difference hash plus its proportions with sharp, and writes
// cms/src/data/photo-fingerprints.json ({ "<url without CMS origin>": { hash, width, height } }). Existing entries are
// kept, so a rerun only fetches new photos. A flat picture (too little structure for the hash) also gets a tiny colour
// thumbnail so copies of it can still be recognised. The runtime (native-site-image.mjs, dedupePhotoSources) uses the file;
// a photo missing from it is simply shown, so a failed fetch never hides anything.
//
// It also writes a report of the copies still stored in the CMS (default .astro/photo-duplicates-report.md, or the path
// after --report), for editors who want to delete them at the source.
//
// Usage: QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/fingerprint-photos.mjs [--report path.md]
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadWorkerCmsModules } from './lib/worker-release.mjs';

import { analyzePhotoSources, collectTourPhotoSources, hashDistance, isInformativeHash, mapWithConcurrency } from '../src/lib/image-delivery.mjs';

const origin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const manifestPath = resolve('cms/src/data/photo-fingerprints.json');
const { photoFingerprintKey, isCmsHostedPhoto } = await import('../cms/src/lib/cms/native-site-image.mjs');
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
    const have = known[key];
    if ((!have || (!isInformativeHash(have.hash) && !have.thumb)) && !wanted.has(key)) wanted.set(key, url.startsWith('/') ? origin + url : url);
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
  const hash = bits.toString(16).padStart(16, '0');
  const print = { hash, width: rotated ? meta.height : meta.width, height: rotated ? meta.width : meta.height };
  if (!isInformativeHash(hash)) {
    const thumb = await sharp(buffer).rotate().flatten({ background: '#ffffff' }).removeAlpha().resize(8, 8, { fit: 'fill' }).raw().toBuffer();
    print.thumb = thumb.toString('base64');
  }
  return print;
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

// ---- Report of the copies that still exist in the CMS ----
const reportPath = resolve(process.argv.includes('--report') ? process.argv[process.argv.indexOf('--report') + 1] : '.astro/photo-duplicates-report.md');
const lines = [];
let copies = 0, toursWithCopies = 0, nearPairs = 0;
const nearLines = [];
const label = (key, source) => `${source}${known[key] ? ` (${known[key].width}x${known[key].height})` : ''}`;
for (const locale of ['zh', 'en']) for (const tour of locales[locale].tours) {
  const sources = collectTourPhotoSources(tour);
  const { kept, groups } = analyzePhotoSources(sources, known, { key: photoFingerprintKey, prefer: isCmsHostedPhoto });
  const title = String(tour.title?.rendered ?? tour.slug).replace(/\s+/g, ' ').trim();
  if (groups.length) {
    toursWithCopies++; copies += groups.reduce((sum, group) => sum + group.copies.length, 0);
    lines.push(`### ${title} (${locale}, id ${tour.id})`, '');
    for (const group of groups) {
      lines.push(`- Keep: ${label(photoFingerprintKey(group.keep), group.keep)}`);
      for (const copy of group.copies) lines.push(`  - Redundant: ${label(photoFingerprintKey(copy), copy)}`);
    }
    lines.push('');
  }
  for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) {
    const a = known[photoFingerprintKey(kept[i])], b = known[photoFingerprintKey(kept[j])];
    if (a && b && isInformativeHash(a.hash) && isInformativeHash(b.hash) && hashDistance(a.hash, b.hash) <= 12) {
      nearPairs++; nearLines.push(`- ${title} (${locale}, id ${tour.id}): ${kept[i]} (${a.width}x${a.height}) and ${kept[j]} (${b.width}x${b.height})`);
    }
  }
}
const header = [
  '# Tour photo copies still stored in the CMS',
  '',
  `Generated ${new Date().toISOString().slice(0, 10)} by scripts/fingerprint-photos.mjs. The Photos tab already hides these copies; deleting the redundant files from each tour's gallery or content in the CMS removes them at the source.`,
  '',
  `${copies} redundant copies in ${toursWithCopies} tours (${Object.keys(known).length} photo files fingerprinted).`,
  '',
];
const near = nearLines.length ? ['## Similar but not identical (review by eye)', '', 'Same-looking scenes with different crops or edits; the Photos tab shows both.', '', ...nearLines, ''] : [];
await writeFile(reportPath, [...header, '## Copies', '', ...lines, ...near].join('\n'));
console.log(`[fingerprints] ${copies} copies in ${toursWithCopies} tours are hidden from the gallery; ${nearPairs} similar pairs to review; report: ${reportPath}`);
