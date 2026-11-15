#!/usr/bin/env node
// Import the WordPress tours that were never public (draft, pending, private) into the CMS `tours` collection as DRAFTS.
// Source: the frozen local backup of the production tables (read-only). Nothing is published; editors choose what goes live.
// Excluded: trash, and the theme demo/test posts listed in scripts/data/wp-nonpublic-tours-*.json.
// Idempotent: a tour whose `source_key` (wp-<locale>-<WordPress id>) already exists in the CMS is skipped.
// Usage: node scripts/import-nonpublic-tours.mjs [--phase=plan|apply] [--only=wp-en-1,wp-zh-2] [--limit=N] [--backup=DIR]
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { imageSize } from 'image-size';
import { createCmsWriter } from './lib/cms-write.mjs';
import { mapArchivedTour } from '../cms/scripts/lib/archived-tour-mapper.mjs';
import { planMediaFilenames } from '../cms/scripts/lib/emdash-media-filenames.mjs';
import { sourceIdentity } from '../cms/scripts/lib/emdash-import-utils.mjs';

const NONPUBLIC = new Set(['draft', 'pending', 'private']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const jsonFile = async path => JSON.parse(await readFile(path, 'utf8'));
const urlKey = value => { try { const u = new URL(value, 'https://qualitour.ca'); return `${u.hostname.toLowerCase()}${decodeURIComponent(u.pathname)}`; } catch { return ''; } };

export function sniffMime(bytes) {
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 3).toString() === 'GIF') return 'image/gif';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (bytes.subarray(0, 4).toString() === '%PDF') return 'application/pdf';
  if (bytes.subarray(4, 12).toString().includes('ftypavif')) return 'image/avif';
  return null;
}

/** Which source records become drafts: non-public status, not trash, not a theme demo/test post. */
export function selectCandidates(records, locale, demoIds) {
  return records.filter(record => NONPUBLIC.has(record.post.post_status) && !demoIds.has(`${locale}:${record.post.ID}`));
}

/** The CMS `tours` entry data for a draft; same shape the original import wrote (hero/brochure/gallery are media ids). */
export function buildEntryData(source, refs, media) {
  const { mapped, record, key } = source;
  const data = {
    ...mapped.data,
    itinerary: mapped.data.itinerary.slice(0, 100),
    itinerary_continued: mapped.data.itinerary.slice(100),
    tour_code: record.decoded_meta['tourmaster-tour-code']?.[0] || '',
    source_key: key,
    source_status: record.post.post_status,
    faq: mapped.data.faq.map(item => ({ ...item, _type: 'question' })),
    gallery: refs.gallery.flatMap(item => media(item.asset) ? [{ image: media(item.asset).id, alt: item.alt, caption: item.caption }] : []),
  };
  if (media(refs.hero)) data.hero = media(refs.hero).id;
  if (media(refs.brochure)) data.brochure = media(refs.brochure).id;
  return data;
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const [k, ...v] = arg.replace(/^--/, '').split('='); return [k, v.join('=') || 'true']; }));
  const phase = args.phase || 'plan';
  assert.ok(['plan', 'apply'].includes(phase), 'phase must be plan or apply');
  const backup = await realpath(args.backup || '/Users/ning/Local Sites/qualitour/backups/production-tours-2026-11-11');
  const inventory = await jsonFile(new URL('./data/wp-nonpublic-tours-2026-11-14.json', import.meta.url));
  const demoIds = new Set(inventory.tours.filter(t => t.group === 'theme-demo-or-test').map(t => `${t.locale}:${t.wp_id}`));

  const assets = new Map(), byUrl = new Map(), byAttachment = new Map(), sources = [];
  for (const [language, locale] of [['english', 'en'], ['chinese', 'zh']]) {
    const root = resolve(backup, language);
    const records = await jsonFile(resolve(root, 'data/tours.raw.json'));
    const manifest = await jsonFile(resolve(root, 'media-manifest.json'));
    const attachments = await jsonFile(resolve(root, 'data/attachments.raw.json'));
    for (const asset of manifest) if (asset.ok) { const value = { ...asset, key: `${locale}:${asset.path}`, locale, root }; assets.set(value.key, value); byUrl.set(`${locale}:${urlKey(asset.source_url)}`, value); }
    for (const attachment of attachments) {
      const file = attachment.decoded_meta._wp_attached_file?.[0];
      const prefix = locale === 'zh' ? '/zh/wp-content/uploads/' : '/wp-content/uploads/';
      const asset = typeof file === 'string' ? byUrl.get(`${locale}:${urlKey(prefix + file)}`) : undefined;
      if (asset) byAttachment.set(`${locale}:${attachment.post.ID}`, { asset, alt: attachment.decoded_meta._wp_attachment_image_alt?.[0] || '', caption: attachment.post.post_excerpt || '' });
    }
    for (const record of selectCandidates(records, locale, demoIds)) {
      const key = sourceIdentity(record, locale);
      let snapshot = null;
      try { snapshot = await jsonFile(resolve(root, `data/public-api/${record.post.ID}.json`)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const mapped = mapArchivedTour(record, snapshot, locale);
      assert.ok(mapped.data.itinerary.length <= 200, `Itinerary exceeds the two 100-block sections: ${key}`);
      sources.push({ key, locale, record, snapshot, mapped });
    }
  }
  const only = args.only ? new Set(args.only.split(',')) : null;
  if (only) for (const key of only) assert.ok(sources.some(s => s.key === key), `Unknown or excluded source: ${key}`);

  const assetForUrl = (locale, url) => byUrl.get(`${locale}:${urlKey(url)}`);
  function refsFor(source) {
    const m = source.mapped.media, gallery = [], seen = new Set(), missing = [];
    const hero = byAttachment.get(`${source.locale}:${m.heroId}`)?.asset || assetForUrl(source.locale, m.heroUrl);
    const brochure = assetForUrl(source.locale, m.brochureUrl);
    if ((m.heroId || m.heroUrl) && !hero) missing.push('hero');
    if (m.brochureUrl && !brochure) missing.push('brochure');
    for (const id of m.galleryIds) { const item = byAttachment.get(`${source.locale}:${id}`); if (item && !seen.has(item.asset.key)) { seen.add(item.asset.key); gallery.push(item); } else if (!item) missing.push('gallery:' + id); }
    for (const url of m.galleryUrls) { const asset = assetForUrl(source.locale, url); if (asset && !seen.has(asset.key)) { seen.add(asset.key); gallery.push({ asset, alt: '', caption: '' }); } else if (!asset) missing.push('gallery:' + url); }
    return { hero, brochure, gallery, missing };
  }

  const cms = await createCmsWriter();
  const existing = new Set();
  for (const locale of ['en', 'zh']) for (let page = 1; ; page++) {
    const data = await cms.request('GET', `/_emdash/api/content/tours?locale=${locale}&limit=50&page=${page}`);
    for (const item of data.items) if (item.data?.source_key) existing.add(item.data.source_key);
    if (page * 50 >= data.total || !data.items.length) break;
  }
  let targets = sources.filter(s => !existing.has(s.key) && (!only || only.has(s.key)));
  if (args.limit) targets = targets.slice(0, Number(args.limit));

  const needed = new Map();
  for (const source of targets) { const r = refsFor(source); for (const a of [r.hero, r.brochure, ...r.gallery.map(x => x.asset)]) if (a) needed.set(a.key, a); }
  const summary = {
    candidates: sources.length, alreadyInCms: sources.filter(s => existing.has(s.key)).length, toImport: targets.length,
    byLocale: Object.fromEntries(['en', 'zh'].map(l => [l, targets.filter(s => s.locale === l).length])),
    uniqueMedia: needed.size, mediaBytes: [...needed.values()].reduce((n, a) => n + a.bytes, 0),
    withMissingMedia: targets.filter(s => refsFor(s).missing.length).length, warnings: targets.filter(s => s.mapped.warnings.length).length,
    noTitle: targets.filter(s => /^\(Untitled/.test(s.mapped.data.title)).length,
  };
  if (phase === 'plan') { console.log(JSON.stringify(summary)); return; }

  // ----- apply -----
  const repairs = planMediaFilenames([...assets.values()], targets.flatMap(source => { const r = refsFor(source); return [r.hero, r.brochure, ...r.gallery.map(x => x.asset)].filter(Boolean).map(asset => ({ asset, title: source.mapped.data.title, sourceKey: source.key })); }));
  const uploaded = new Map(); // asset sha256 -> { id }
  const unsupported = [];
  async function ensureMedia(asset) {
    if (!asset) return null;
    if (uploaded.has(asset.sha256)) return uploaded.get(asset.sha256);
    const path = await realpath(resolve(asset.root, asset.path));
    assert.ok(!relative(asset.root, path).startsWith('..'), 'Asset escaped backup root');
    const bytes = await readFile(path);
    assert.ok(bytes.length === asset.bytes && sha256(bytes) === asset.sha256, `Media integrity failed: ${asset.key}`);
    const type = sniffMime(bytes);
    if (!type) { unsupported.push(asset.key); uploaded.set(asset.sha256, null); return null; }
    let filename; try { filename = decodeURIComponent(new URL(asset.source_url).pathname.split('/').at(-1)); } catch { filename = basename(asset.path); }
    filename = repairs.get(asset.sha256)?.filename || filename;
    let dimensions = {};
    if (type.startsWith('image/')) try { const info = imageSize(bytes); const rotated = [5, 6, 7, 8].includes(info.orientation); if (info.width > 0 && info.height > 0) dimensions = { width: rotated ? info.height : info.width, height: rotated ? info.width : info.height }; } catch { /* optional metadata */ }
    const contentHash = bytes.length <= 8 * 1024 * 1024 ? `sha1:${createHash('sha1').update(bytes).digest('hex')}` : undefined;
    const pending = await cms.request('POST', '/_emdash/api/media/upload-url', { filename, contentType: type, size: bytes.length, contentHash, deduplicate: true });
    let item;
    if (pending.existing) item = (await cms.request('GET', `/_emdash/api/media/${pending.mediaId}`)).item;
    else {
      const url = new URL(pending.uploadUrl, cms.origin);
      assert.equal(url.origin, new URL(cms.origin).origin, 'Upload URL escaped the CMS origin');
      await cms.request('PUT', url.pathname + url.search, bytes, { contentType: type });
      item = (await cms.request('POST', `/_emdash/api/media/${pending.mediaId}/confirm`, { size: bytes.length, ...dimensions })).item;
    }
    assert.ok(item?.id, 'Media upload returned no identity');
    const record = { id: item.id };
    uploaded.set(asset.sha256, record);
    return record;
  }

  let created = 0, failed = [];
  for (const source of targets) {
    try {
      const refs = refsFor(source);
      for (const asset of [refs.hero, refs.brochure, ...refs.gallery.map(x => x.asset)]) await ensureMedia(asset);
      const data = buildEntryData(source, refs, asset => asset ? uploaded.get(asset.sha256) : null);
      const entry = (await cms.request('POST', '/_emdash/api/content/tours', { locale: source.locale, slug: source.key, data })).item;
      assert.ok(entry?.id && entry.status !== 'published', 'Created entry must be an unpublished draft');
      created++;
      if (created % 10 === 0) console.log(JSON.stringify({ created, of: targets.length, media: uploaded.size }));
    } catch (error) {
      failed.push(`${source.key}: ${String(error.message).slice(0, 160)}`);
    }
  }
  console.log(JSON.stringify({ ...summary, created, failed: failed.length, unsupportedMedia: unsupported.length }));
  if (failed.length) { console.log('failed:\n' + failed.join('\n')); process.exitCode = 1; }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
