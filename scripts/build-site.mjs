#!/usr/bin/env node
// Assemble the static assets of the frontend Worker `qualitour-site`.
//
// Every public HTML page is taken from the CMS Worker's own rendering (what visitors get today), so the static
// site is identical to the live one by construction and always has exactly the published pages. The crawl starts at
// the home/list pages, follows internal links that the router knows (nativeSiteRoute) and also requests every
// published tour from the CMS snapshot. Anything that fails the gates below stops the build and leaves the
// previous release untouched:
//   - every response must be 200 HTML rendered by the CMS (the static-fallback safety net counts as a failure);
//   - every tour in the snapshot must have its page in both locales;
//   - the asset limits of the Workers Free plan hold (20,000 files, 25 MiB per file).
//
// Usage: node scripts/build-site.mjs   (needs .astro/worker-release/assets from `npm run build:worker`
//        and .astro/cms-content/public-catalogue.json)
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { dirname, join, resolve } from 'node:path';
import { nativeSiteRoute } from '../cms/src/lib/cms/native-site-policy.mjs';

const cmsOrigin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const baseAssets = resolve(process.env.SITE_BASE_ASSETS || '.astro/worker-release/assets');
const outDir = resolve(process.env.SITE_OUT_DIR || '.astro/site-release/assets');
const concurrency = Number(process.env.SITE_CRAWL_CONCURRENCY || 6);
// Pages the CMS does not render: the transactional booking shell stays the prerendered static page.
const keepFromBase = new Set(['404.html', '500.html', 'book.html', 'zh/book.html']);

const snapshot = JSON.parse(await readFile('.astro/cms-content/public-catalogue.json', 'utf8'));
if (snapshot.origin !== cmsOrigin) throw new Error(`Snapshot origin ${snapshot.origin} differs from ${cmsOrigin}`);

const seeds = ['/', '/zh', '/tours', '/zh/tours', '/tours/featured', '/zh/tours/featured'];
for (const page of ['about-us', 'contact', 'faq', 'privacy-policy', 'terms', 'visa', 'reviews', 'private-transfers']) seeds.push('/' + page, '/zh/' + page);
const requiredTours = [];
for (const locale of ['en', 'zh']) for (const tour of snapshot.locales[locale].tours) {
  const path = (locale === 'zh' ? '/zh' : '') + '/tours/' + tour.slug;
  requiredTours.push(path); seeds.push(path);
}

const pages = new Map(); // canonical pathname -> html
const failures = [];
const queue = [];
const queued = new Set();
function enqueue(raw) {
  let path;
  try { path = new URL(raw, cmsOrigin).pathname; } catch { return; }
  const route = nativeSiteRoute(path);
  if (!route || queued.has(route.pathname)) return;
  queued.add(route.pathname); queue.push(route.pathname);
}
seeds.forEach(enqueue);

async function crawl(path) {
  const response = await fetch(cmsOrigin + path, { headers: { 'user-agent': 'qualitour-site-build/1.0', 'accept': 'text/html' }, redirect: 'manual' });
  if (response.status !== 200) { failures.push(`${response.status} ${path}`); return; }
  if (!(response.headers.get('content-type') || '').includes('text/html')) { failures.push(`not html ${path}`); return; }
  if (response.headers.get('x-qualitour-rendered') === 'static-fallback') { failures.push(`static fallback ${path}`); return; }
  const html = await response.text();
  pages.set(path, html);
  for (const match of html.matchAll(/href="([^"#]+)"/g)) enqueue(match[1].replaceAll('&amp;', '&').split('?')[0]);
}
async function worker() {
  while (queue.length) await crawl(queue.shift());
}
await Promise.all(Array.from({ length: concurrency }, worker));

const missing = requiredTours.filter(path => !pages.has(path));
if (missing.length) failures.push(`${missing.length} published tours missing: ${missing.slice(0, 5).join(', ')}`);
// Linked routes that answer 404 are dead links in the content, not a build failure, unless a published tour is gone.
const deadLinks = failures.filter(item => item.startsWith('404 ') && !requiredTours.includes(item.slice(4)));
const hard = failures.filter(item => !deadLinks.includes(item));
if (hard.length) { console.error('Site build failed:\n' + hard.join('\n')); process.exit(1); }
if (!pages.has('/') || !pages.has('/zh')) { console.error('Site build failed: home pages missing'); process.exit(1); }

// Assemble into a sibling directory and swap, so a failed build never touches the previous release.
const tmp = outDir + '.partial';
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
await cp(baseAssets, tmp, {
  recursive: true,
  filter: source => {
    const rel = source.slice(baseAssets.length + 1);
    if (rel.endsWith('.html')) return keepFromBase.has(rel);
    return !['combined-release.json', 'qualitour-release.json', 'seo-inventory.json'].includes(rel);
  },
});
// Turn every remaining /_image reference into a static derivative so no visitor request needs the Worker:
// the original is read from the base assets (/_astro), the CMS media route or the legacy WordPress uploads,
// resized with sharp (webp, quality 80, like the Worker transform) and stored as /img/s-<hash>-<w>.webp.
// A reference that cannot be produced keeps its /_image URL (slower, still correct) and is reported.
const imageCache = resolve('.astro/site-images');
await mkdir(imageCache, { recursive: true });
const wanted = new Map(); // key -> {href,w,h,q}
const refPattern = /\/_image\?[^"'\s,)<>]+/g;
function parseRef(raw) {
  const params = new URLSearchParams(raw.slice('/_image?'.length).replaceAll('&amp;', '&'));
  const href = params.get('href'), w = Number(params.get('w'));
  if (!href || !Number.isSafeInteger(w) || w < 1 || w > 4096) return null;
  const h = params.get('h') ? Number(params.get('h')) : 0, q = params.get('q') ? Number(params.get('q')) : 80;
  const name = `s-${createHash('sha1').update(href).digest('hex').slice(0, 16)}-${w}${h ? 'x' + h : ''}${q === 80 ? '' : 'q' + q}.webp`;
  return { href, w, h, q, name };
}
for (const html of pages.values()) for (const match of html.matchAll(refPattern)) {
  const ref = parseRef(match[0]);
  if (ref) wanted.set(ref.name, ref);
}
const byOriginal = new Map();
for (const ref of wanted.values()) byOriginal.set(ref.href, [...(byOriginal.get(ref.href) || []), ref]);
const produced = new Set(), imageFailures = [];
async function original(href) {
  if (href.startsWith('/_astro/')) return readFile(join(tmp, decodeURIComponent(href).slice(1)));
  const url = href.startsWith('/') ? cmsOrigin + href : href;
  if (!href.startsWith('/') && !/^https:\/\/(?:www\.)?qualitour\.ca\//.test(href)) throw new Error('foreign host');
  const response = await fetch(url, { headers: { 'user-agent': 'qualitour-site-build/1.0' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}
const originals = [...byOriginal];
async function imageWorker() {
  while (originals.length) {
    const [href, refs] = originals.shift();
    let input;
    for (const ref of refs) {
      const file = join(imageCache, ref.name);
      try {
        let cached = false;
        try { cached = (await stat(file)).size > 0; } catch {}
        if (!cached) {
          input ??= await original(href);
          const resize = ref.h ? { width: ref.w, height: ref.h, fit: 'cover' } : { width: ref.w, withoutEnlargement: true };
          await writeFile(file, await sharp(input).rotate().resize(resize).webp({ quality: ref.q }).toBuffer());
        }
        produced.add(ref.name);
      } catch (error) { imageFailures.push(`${href} w=${ref.w} ${String(error).slice(0, 60)}`); }
    }
  }
}
await Promise.all(Array.from({ length: 4 }, imageWorker));
await mkdir(join(tmp, 'img'), { recursive: true });
for (const name of produced) await cp(join(imageCache, name), join(tmp, 'img', name));
for (const [path, html] of pages) {
  pages.set(path, html.replace(refPattern, raw => { const ref = parseRef(raw); return ref && produced.has(ref.name) ? '/img/' + ref.name : raw; }));
}

const hashes = {};
for (const [path, html] of pages) {
  const file = path === '/' ? 'index.html' : decodeURIComponent(path).slice(1) + '.html';
  await mkdir(dirname(join(tmp, file)), { recursive: true });
  await writeFile(join(tmp, file), html);
  hashes[path] = createHash('sha256').update(html).digest('hex').slice(0, 16);
}

let files = 0, largest = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else { files++; largest = Math.max(largest, (await stat(full)).size); }
  }
}
await walk(tmp);
if (files + 1 > 20000 || largest > 25 * 1024 * 1024) { console.error(`Asset limits exceeded: ${files} files, largest ${largest} bytes`); process.exit(1); }
await writeFile(join(tmp, 'site-release.json'), JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), cmsOrigin, pages: pages.size, tours: requiredTours.length, files: files + 1, deadLinks, images: { derivatives: produced.size, failed: imageFailures.length }, hashes }) + '\n');

const backup = outDir + '.previous';
await rm(backup, { recursive: true, force: true });
await mkdir(dirname(outDir), { recursive: true });
try { await rename(outDir, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
await rename(tmp, outDir);
await rm(backup, { recursive: true, force: true });
if (imageFailures.length) console.log('image fallbacks (kept as /_image):\n' + imageFailures.slice(0, 20).join('\n'));
console.log(JSON.stringify({ derivatives: produced.size, imageFallbacks: imageFailures.length, pages: pages.size, tours: requiredTours.length, files: files + 1, largestBytes: largest, deadLinks, outDir }));
