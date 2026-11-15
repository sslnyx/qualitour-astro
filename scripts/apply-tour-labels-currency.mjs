#!/usr/bin/env node
// Backfill the card label (ribbon), the currency and the current price on tours that were imported before those
// fields existed or were mapped wrongly. Idempotent: a field already holding the wanted value is left alone.
//   ribbon   drafts: WordPress promo-text; published: the frozen public label (so the CMS field matches the baseline)
//   currency "USD" where the title or text says USD (scripts/data/tour-currency-evidence-*.json), otherwise unlabelled;
//            a CAD on a draft is cleared (the site never writes CAD)
//   price    drafts with an active WordPress discount: the current price (tourmaster-tour-price), not the original
// Usage: node scripts/apply-tour-labels-currency.mjs [--apply] [--only=drafts|published] [--limit=N]
import { readFile } from 'node:fs/promises';
import { createCmsWriter } from './lib/cms-write.mjs';

const apply = process.argv.includes('--apply');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').slice(7);
const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '').slice(8)) || Infinity;
const BACKUP = '/Users/ning/Local Sites/qualitour/backups/production-tours-2026-11-11';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const first = (meta, key) => {
  let v = meta?.[key]; if (Array.isArray(v)) v = v[0];
  if (typeof v === 'string' && /^[[{]/.test(v)) try { v = JSON.parse(v); } catch { /* keep the string */ }
  return v;
};
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const evidence = await json(new URL('./data/tour-currency-evidence-2026-11-15.json', import.meta.url));
const usd = new Set(evidence.tours.filter(t => t.proposal === 'USD').map(t => `wp-${t.locale}-${t.wp_id}`));
const compat = await json(new URL('../src/data/cms-legacy-compat.json', import.meta.url));
const wp = new Map();
for (const [dir, locale] of [['english', 'en'], ['chinese', 'zh']])
  for (const r of await json(`${BACKUP}/${dir}/data/tours.raw.json`)) {
    const settings = obj(first(r.decoded_meta, 'tourmaster-tour-settings')), option = obj(first(r.decoded_meta, 'tourmaster-tour-option'));
    wp.set(`wp-${locale}-${r.post.ID}`, {
      ribbon: String(settings['promo-text'] || option['promo-text'] || first(r.decoded_meta, 'qualitour-ribbon-text') || first(r.decoded_meta, 'gdlr-tour-label') || ''),
      discount: String(first(r.decoded_meta, 'tourmaster-tour-discount')) === 'true',
      current: String(first(r.decoded_meta, 'tourmaster-tour-price') ?? '').trim(),
    });
  }

const cms = await createCmsWriter();
const rows = [];
for (const locale of ['en', 'zh']) for (let page = 1; ; page++) {
  const d = await cms.request('GET', `/_emdash/api/content/tours?locale=${locale}&limit=50&page=${page}`);
  rows.push(...d.items.map(item => ({ ...item, locale })));
  if (page * 50 >= d.total || !d.items.length) break;
}

const plans = [];
for (const item of rows) {
  const key = item.data.source_key; if (typeof key !== 'string') continue;
  const published = item.status === 'published', patch = {};
  const src = wp.get(key); if (!src) continue;
  if (published) {
    const frozen = compat.locales[item.locale]?.tours?.[key]?.tour?.tour_meta?.ribbon ?? '';
    if (frozen && !item.data.ribbon) patch.ribbon = frozen;
  } else {
    if (src.ribbon && item.data.ribbon !== src.ribbon) patch.ribbon = src.ribbon;
    if (src.discount && src.current && /^[\d.,]+$/.test(src.current) && String(item.data.price) !== src.current) patch.price = src.current;
  }
  const wantUsd = usd.has(key);
  if (wantUsd && item.data.currency !== 'USD') patch.currency = 'USD';
  if (!wantUsd && !published && item.data.currency && !/^usd$/i.test(item.data.currency)) patch.currency = '';
  if (Object.keys(patch).length) plans.push({ id: item.id, locale: item.locale, key, published, patch });
}
const selected = plans.filter(p => !only || (only === 'published') === p.published).slice(0, limit);
const count = field => selected.filter(p => field in p.patch).length;
console.log(JSON.stringify({ tours: rows.length, planned: plans.length, selected: selected.length, ribbon: count('ribbon'), currency: count('currency'), price: count('price'), published: selected.filter(p => p.published).length, apply }));
if (!apply) { for (const p of selected.slice(0, 5)) console.log(p.key, p.published ? 'published' : 'draft', JSON.stringify(p.patch)); process.exit(0); }

let done = 0; const failed = [];
for (const p of selected) {
  try {
    const url = `/_emdash/api/content/tours/${p.id}?locale=${p.locale}`;
    const current = await cms.request('GET', url);
    await cms.request('PUT', url, { data: p.patch, _rev: current._rev });
    if (p.published) {
      const latest = await cms.request('GET', url);
      await cms.request('POST', `/_emdash/api/content/tours/${p.id}/publish?locale=${p.locale}`, { _rev: latest._rev });
    }
    done++;
    if (done % 25 === 0) console.log(JSON.stringify({ done, of: selected.length }));
  } catch (error) { failed.push(`${p.key}: ${String(error.message).slice(0, 120)}`); }
}
console.log(JSON.stringify({ done, failed: failed.length }));
if (failed.length) { console.log(failed.join('\n')); process.exitCode = 1; }
