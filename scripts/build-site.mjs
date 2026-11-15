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
import { syncCmsSnapshot } from '../src/lib/cms/content-server.mjs';
import { refPattern } from './lib/image-ref-pattern.mjs';
import { findBrokenIslandProps } from './lib/island-props.mjs';

const cmsOrigin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const baseAssets = resolve(process.env.SITE_BASE_ASSETS || '.astro/worker-release/assets');
const outDir = resolve(process.env.SITE_OUT_DIR || '.astro/site-release/assets');
const concurrency = Number(process.env.SITE_CRAWL_CONCURRENCY || 6);
const publicOrigin = process.env.SITE_PUBLIC_ORIGIN || cmsOrigin;

// The published set comes from the CMS itself (EMDASH_TOKEN in CI, the CLI login on a workstation) unless
// SITE_USE_SNAPSHOT=1 reuses the snapshot already on disk.
const snapshot = process.env.SITE_USE_SNAPSHOT
  ? JSON.parse(await readFile('.astro/cms-content/public-catalogue.json', 'utf8'))
  : await syncCmsSnapshot();
if (snapshot.origin !== cmsOrigin) throw new Error(`Snapshot origin ${snapshot.origin} differs from ${cmsOrigin}`);
const decode = path => { try { return decodeURIComponent(path); } catch { return path; } };
const sleep = ms => new Promise(done => setTimeout(done, ms));

const seeds = ['/', '/zh', '/tours', '/zh/tours', '/tours/featured', '/zh/tours/featured'];
for (const page of ['about-us', 'contact', 'faq', 'privacy-policy', 'terms', 'visa', 'reviews', 'private-transfers']) seeds.push('/' + page, '/zh/' + page);
const requiredTours = [];
const publishedSlugs = new Set();
for (const locale of ['en', 'zh']) for (const tour of snapshot.locales[locale].tours) {
  const path = decode((locale === 'zh' ? '/zh' : '') + '/tours/' + tour.slug);
  requiredTours.push(path); seeds.push(path); publishedSlugs.add(decode(tour.slug));
}
// Pages the CMS does not render through the router but serves from its own assets.
const fixedPaths = ['/book', '/zh/book', '/404', '/500'];

async function crawlAll() {
  const pages = new Map(); // decoded pathname -> html
  const failures = [];
  const queue = [];
  const queued = new Set();
  const enqueue = raw => {
    let path;
    try { path = new URL(raw, cmsOrigin).pathname; } catch { return; }
    const route = nativeSiteRoute(path);
    if (!route) return;
    const key = decode(route.pathname);
    if (queued.has(key)) return;
    queued.add(key); queue.push(key);
  };
  const fetchHtml = async path => {
    const response = await fetch(new URL(path, cmsOrigin), { headers: { 'user-agent': 'qualitour-site-build/1.0', accept: 'text/html', ...(process.env.SITE_BUILD_KEY ? { 'x-qualitour-site-build': process.env.SITE_BUILD_KEY } : {}) }, redirect: 'manual' });
    if (response.status !== 200) { failures.push(`${response.status} ${path}`); return null; }
    if (!(response.headers.get('content-type') || '').includes('text/html')) { failures.push(`not html ${path}`); return null; }
    if (response.headers.get('x-qualitour-rendered') === 'static-fallback') { failures.push(`static fallback ${path}`); return null; }
    return response.text();
  };
  seeds.forEach(enqueue);
  const worker = async () => {
    while (queue.length) {
      const path = queue.shift();
      const html = await fetchHtml(path);
      if (html === null) continue;
      pages.set(path, html);
      for (const match of html.matchAll(/href="([^"#]+)"/g)) enqueue(match[1].replaceAll('&amp;', '&').split('?')[0]);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  for (const path of fixedPaths) { const html = await fetchHtml(path); if (html !== null) pages.set(path, html); }
  return { pages, failures };
}

// A page of the CMS render can lag behind a publish or an unpublish (cache invalidation). The published set from
// the CMS is the truth: a published tour without a page, or a page of a tour that is no longer published, means the
// render is stale, so wait and crawl again before giving up.
function findProblems({ pages, failures }) {
  const problems = [...failures];
  const missing = requiredTours.filter(path => !pages.has(path));
  if (missing.length) problems.push(`${missing.length} published tours missing: ${missing.slice(0, 5).join(', ')}`);
  const stale = [...pages.keys()].filter(path => nativeSiteRoute(path)?.kind === 'tour' && !publishedSlugs.has(decode(path.split('/').pop())));
  if (stale.length) problems.push(`${stale.length} pages of unpublished tours: ${stale.slice(0, 5).join(', ')}`);
  // Linked routes that answer 404 are dead links in the content, not a build failure, unless a published tour is gone.
  const dead = problems.filter(item => item.startsWith('404 ') && !requiredTours.includes(decode(item.slice(4))));
  return { hard: problems.filter(item => !dead.includes(item)), dead };
}

const attempts = Number(process.env.SITE_CRAWL_ATTEMPTS || 4), staleWaitMs = Number(process.env.SITE_STALE_WAIT_MS || 45000);
let crawled, verdict;
for (let attempt = 1; ; attempt++) {
  crawled = await crawlAll();
  verdict = findProblems(crawled);
  if (!verdict.hard.length || attempt >= attempts) break;
  console.log(`Crawl ${attempt} did not match the published set (${verdict.hard.length} problems); waiting ${staleWaitMs / 1000}s for the render to catch up`);
  await sleep(staleWaitMs);
}
const { pages } = crawled;
const deadLinks = verdict.dead;
if (verdict.hard.length) { console.error('Site build failed:\n' + verdict.hard.join('\n')); process.exit(1); }
if (!pages.has('/') || !pages.has('/zh') || !pages.has('/book')) { console.error('Site build failed: home or booking pages missing'); process.exit(1); }

// Assemble into a sibling directory and swap, so a failed build never touches the previous release.
const tmp = outDir + '.partial';
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
await cp(baseAssets, tmp, {
  recursive: true,
  filter: source => {
    const rel = source.slice(baseAssets.length + 1);
    if (rel.endsWith('.html')) return false; // every page comes from the crawl
    if (['sitemap.xml', 'robots.txt'].includes(rel) || rel.startsWith('sitemap-')) return false;
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
// SSR output also names images the deployed Worker prebuilt (/img/<id>-<w>.webp from prebuilt-images.json). Those
// files do not exist in a CI checkout, so they are regenerated here from the original they were made from.
function parseRef(raw) {
  let href, w, h = 0, q = 80;
  if (raw.startsWith('/img/')) {
    const match = raw.match(/^\/img\/(.+)-(\d+)\.webp$/);
    if (!match) return null;
    const [, id] = match;
    href = id.startsWith('wp-') ? 'https://' + id.slice(3).replaceAll('~', '/') : '/_emdash/api/media/file/' + id.replaceAll('~', '/');
    w = Number(match[2]);
  } else {
    const params = new URLSearchParams(raw.slice('/_image?'.length).replaceAll('&amp;', '&'));
    href = params.get('href'); w = Number(params.get('w'));
    if (params.get('h')) h = Number(params.get('h'));
    if (params.get('q')) q = Number(params.get('q'));
  }
  if (!href || !Number.isSafeInteger(w) || w < 1 || w > 4096) return null;
  const name = `s-${createHash('sha1').update(href).digest('hex').slice(0, 16)}-${w}${h ? 'x' + h : ''}${q === 80 ? '' : 'q' + q}.webp`;
  return { href, w, h, q, name, fallback: raw.startsWith('/img/') ? `/_image?href=${encodeURIComponent(href)}&w=${w}&f=webp&q=80` : raw };
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
  pages.set(path, html.replace(refPattern, raw => { const ref = parseRef(raw); return !ref ? raw : produced.has(ref.name) ? '/img/' + ref.name : ref.fallback; }));
}

// Reviews synced from Google arrive with Google-hosted avatars and photos. Host them ourselves, like the avatars
// imported earlier: avatars (/a/ paths) become 96px webp, review photos 800px wide webp. A file that cannot be
// fetched keeps its Google URL (slower, still correct) and is reported.
const externalPattern = /https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-/=.%]+/g;
const externalSeen = new Map(), externalFailed = [];
for (const html of pages.values()) for (const match of html.matchAll(externalPattern)) externalSeen.set(match[0], null);
await Promise.all([...externalSeen.keys()].map(async url => {
  const avatar = /\/a\//.test(url);
  const name = `ext-${createHash('sha1').update(url).digest('hex').slice(0, 16)}.webp`;
  const file = join(imageCache, name);
  try {
    let cached = false;
    try { cached = (await stat(file)).size > 0; } catch {}
    if (!cached) {
      const source = avatar ? url.replace(/=s\d+[^/]*$/, '=s96-c') : url;
      const response = await fetch(source, { headers: { 'user-agent': 'qualitour-site-build/1.0' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const resize = avatar ? { width: 96, height: 96, fit: 'cover' } : { width: 800, withoutEnlargement: true };
      await writeFile(file, await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize(resize).webp({ quality: 80 }).toBuffer());
    }
    await cp(file, join(tmp, 'img', name));
    externalSeen.set(url, '/img/' + name);
  } catch (error) { externalFailed.push(`${url.slice(0, 70)} ${String(error).slice(0, 50)}`); }
}));
for (const [path, html] of pages) pages.set(path, html.replace(externalPattern, url => externalSeen.get(url) || url));
if (externalSeen.size) console.log(JSON.stringify({ externalImages: externalSeen.size, externalFailed: externalFailed.length }));
if (externalFailed.length) console.log('external images kept as Google URLs:\n' + externalFailed.slice(0, 10).join('\n'));

// Images stored in the CMS media library (review photos) are referenced by their media path. Serve them from the
// static assets too: no Worker request per image view, and the page keeps working if the media route is ever moved.
// Only raster images; PDFs and other files keep their media path. A failed fetch leaves the media path (still served).
const mediaPattern = /\/_emdash\/api\/media\/file\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|gif|avif)(?![A-Za-z0-9._-])/g;
const mediaSeen = new Map(), mediaFailed = [];
for (const html of pages.values()) for (const match of html.matchAll(mediaPattern)) mediaSeen.set(match[0], null);
for (const path of [...mediaSeen.keys()]) {
  const name = `m-${createHash('sha1').update(path).digest('hex').slice(0, 16)}.webp`;
  const file = join(imageCache, name);
  try {
    let cached = false;
    try { cached = (await stat(file)).size > 0; } catch {}
    if (!cached) {
      const response = await fetch(cmsOrigin + path, { headers: { 'user-agent': 'qualitour-site-build/1.0' } });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      await writeFile(file, await sharp(Buffer.from(await response.arrayBuffer())).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer());
    }
    await cp(file, join(tmp, 'img', name));
    mediaSeen.set(path, '/img/' + name);
  } catch (error) { mediaFailed.push(`${path.slice(-40)} ${String(error).slice(0, 50)}`); }
}
for (const [path, html] of pages) pages.set(path, html.replace(mediaPattern, found => mediaSeen.get(found) || found));
if (mediaSeen.size) console.log(JSON.stringify({ cmsMediaImages: mediaSeen.size, cmsMediaFailed: mediaFailed.length }));
if (mediaFailed.length) console.log('CMS media kept as media paths:\n' + mediaFailed.slice(0, 10).join('\n'));

// Gate: no page may carry an island whose props are not valid JSON (the component would never hydrate).
const brokenIslands = [...pages].flatMap(([path, html]) => findBrokenIslandProps(path, html));
if (brokenIslands.length) throw new Error(`${brokenIslands.length} island(s) with invalid props; first: ${brokenIslands.slice(0, 5).join(' | ')}`);

// Pages the CMS serves from its own assets (/book, 404, 500) were built with a different set of hashed files than
// the CMS client build; fetch whatever any page references and the base assets lack, following CSS url() references.
const assetMissing = [];
const assetSeen = new Set();
async function ensureAsset(path) {
  if (assetSeen.has(path)) return;
  assetSeen.add(path);
  const file = join(tmp, path.slice(1));
  try { await stat(file); return; } catch {}
  const response = await fetch(new URL(path.split('/').map(encodeURIComponent).join('/'), cmsOrigin), { headers: { 'user-agent': 'qualitour-site-build/1.0' } });
  if (!response.ok) { assetMissing.push(`${response.status} ${path}`); return; }
  const bytes = Buffer.from(await response.arrayBuffer());
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  if (path.endsWith('.js') || path.endsWith('.mjs')) for (const match of bytes.toString('utf8').matchAll(/["'](\.{1,2}\/[^"'\s]+\.m?js)["']/g))
    await ensureAsset(decode(new URL(match[1], new URL(path, cmsOrigin)).pathname));
  if (path.endsWith('.css')) for (const match of bytes.toString('utf8').matchAll(/url\(\s*["']?([^)"'\s]+)["']?\s*\)/g)) {
    const ref = match[1];
    if (ref.startsWith('data:') || /^[a-z]+:/i.test(ref) || ref.startsWith('//')) continue;
    await ensureAsset(decode(new URL(ref, new URL(path, cmsOrigin)).pathname));
  }
}
for (const html of pages.values()) for (const match of html.matchAll(/["'(](\/(?:_astro|fonts)\/[^"')\s?#]+)/g)) await ensureAsset(decode(match[1]));
if (assetMissing.length) { console.error('Site build failed: referenced assets missing\n' + assetMissing.slice(0, 10).join('\n')); process.exit(1); }

const hashes = {};
for (const [path, html] of pages) {
  const file = path === '/' ? 'index.html' : path.slice(1) + (path.endsWith('.html') ? '' : '.html');
  await mkdir(dirname(join(tmp, file)), { recursive: true });
  await writeFile(join(tmp, file), html);
  hashes[path] = createHash('sha256').update(html).digest('hex').slice(0, 16);
}

// The CMS sitemap lists its own /cms-proof/ routes, so the site publishes one built from the pages it serves.
const routed = [...pages.keys()].filter(path => nativeSiteRoute(path)).sort();
await writeFile(join(tmp, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + routed.map(path => `  <url><loc>${new URL(path === '/' ? '/' : path, publicOrigin).href.replaceAll('&', '&amp;')}</loc></url>`).join('\n') + '\n</urlset>\n');
await writeFile(join(tmp, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${publicOrigin}/sitemap.xml\n`);

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
