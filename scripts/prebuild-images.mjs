#!/usr/bin/env node
// Prebuild the tour images every visitor page needs, so they are served as static assets instead of being
// transformed by the Worker on each request (/_image).
//
// For each published tour (en + zh) this runs the same presentation code the runtime uses, collects the
// (media, width) pairs it would request (hero ladder + 600 px card thumbnail), downloads each original once,
// resizes it to webp with sharp and writes .astro/prebuilt-images/<id>-<width>.webp. The list of produced
// images is written to cms/src/data/prebuilt-images.json; the runtime serves /img/<id>-<width>.webp for a
// listed pair and falls back to /_image for everything else, so a missing entry only costs speed.
//
// Usage: QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/prebuild-images.mjs
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { loadWorkerCmsModules } from './lib/worker-release.mjs';

const origin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const outDir = resolve('.astro/prebuilt-images');
const manifestPath = resolve('cms/src/data/prebuilt-images.json');
await mkdir(outDir, { recursive: true });

const { createCmsReader, buildCatalogue, retainPublicTranslations } = await loadWorkerCmsModules(origin);
const image = await import('../cms/src/lib/cms/native-site-image.mjs');
image.prebuiltImages.clear(); // discover the raw /_image requests, not a previous release's /img rewrites

const compatibility = JSON.parse(await readFile('src/data/cms-legacy-compat.json', 'utf8'));
const reader = createCmsReader({ origin });
const locales = {};
for (const locale of ['en', 'zh']) locales[locale] = buildCatalogue(await reader.listPublished(locale), compatibility, locale);
retainPublicTranslations(locales);

// Every /_image URL the runtime would emit for a tour: the hero ladder (srcset) and the 600 px card image.
const wanted = new Map(); // "id|width" -> original URL
function collect(url) {
  if (typeof url !== 'string') return;
  for (const match of url.matchAll(/\/_image\?href=([^&\s,]+)&w=(\d+)&f=webp&q=80/g)) {
    const href = decodeURIComponent(match[1]);
    const width = Number(match[2]);
    const id = image.prebuiltImageId(href);
    if (id) wanted.set(`${id}|${width}`, href);
  }
}
for (const locale of ['en', 'zh']) {
  for (const tour of locales[locale].tours) {
    await image.optimizeTourHero(tour);
    collect(tour.optimizedHero?.src);
    collect(tour.optimizedHero?.srcSet);
  }
  for (const tour of await image.optimizeTourImages(locales[locale].tours)) collect(tour.optimizedImageUrl);
}
console.log(`[images] ${wanted.size} derivatives wanted for ${new Set([...wanted.keys()].map(k => k.split('|')[0])).size} originals`);

const originals = new Map(); // href -> Promise<Buffer>
const fetchOriginal = href => {
  if (!originals.has(href)) {
    const url = href.startsWith('/') ? origin + href : href;
    originals.set(href, fetch(url, { headers: { 'user-agent': 'qualitour-image-prebuild/1.0' } }).then(async res => {
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    }));
  }
  return originals.get(href);
};

const produced = [];
const failed = [];
const queue = [...wanted];
async function worker() {
  while (queue.length) {
    const [key, href] = queue.shift();
    const [id, width] = key.split('|');
    const file = join(outDir, `${id}-${width}.webp`);
    try {
      let exists = false;
      try { exists = (await stat(file)).size > 0; } catch {}
      if (!exists) {
        const input = await fetchOriginal(href);
        const webp = await sharp(input).rotate().resize({ width: Number(width), withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        await writeFile(file, webp);
      }
      produced.push(key);
    } catch (error) {
      failed.push(`${key} ${String(error).slice(0, 80)}`);
    }
    // Keep memory flat: an original is only needed while its derivatives are being made.
    if (!queue.some(([, other]) => other === href)) originals.delete(href);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

produced.sort();
await writeFile(manifestPath, JSON.stringify(produced) + '\n');
console.log(JSON.stringify({ produced: produced.length, failed: failed.length, manifest: manifestPath }));
if (failed.length) console.log('failed (these fall back to /_image):\n' + failed.join('\n'));
