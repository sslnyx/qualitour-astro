import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildCatalogue, claimsImport, contentHash, currencyLabel } from '../src/lib/cms/legacy-adapter.mjs';

const compat = JSON.parse(await readFile(new URL('../src/data/cms-legacy-compat.json', import.meta.url), 'utf8'));
const published = '2026-11-15T10:00:00.000Z';
const nativeEntry = (data, extra = {}) => ({ id: '01NATIVE', slug: 'native-tour', status: 'published', locale: 'en', publishedAt: published, data: { title: 'Native tour', summary: '', price: '145', currency: '', duration: '1 Day', location: 'Vancouver', tour_code: '', ...data }, ...extra });
const emptyCompat = { locales: { en: { tours: {}, terms: {} }, zh: { tours: {}, terms: {} } } };
const meta = tour => tour.tour_meta;

test('currency is shown only for USD', () => {
  assert.equal(currencyLabel('USD'), 'USD');
  assert.equal(currencyLabel(' usd '), 'USD');
  for (const value of ['', null, undefined, 'CAD', 'cad', 'EUR', 'USDX']) assert.equal(currencyLabel(value), '');
});

test('never-public WordPress tours are native once published; public imports keep their identity', () => {
  for (const status of ['draft', 'pending', 'private']) assert.equal(claimsImport({ source_key: 'wp-en-1', source_status: status }), false);
  assert.equal(claimsImport({ source_key: 'wp-en-1', source_status: 'publish' }), true);
  assert.equal(claimsImport({ source_key: null, source_status: null }), false);
});

test('a published native tour carries its label and only a USD currency', () => {
  const { tours } = buildCatalogue([nativeEntry({ ribbon: 'Best Seller', currency: 'USD' })], emptyCompat, 'en');
  assert.equal(meta(tours[0]).ribbon, 'Best Seller');
  assert.equal(meta(tours[0])['tourmaster-tour-currency'], 'USD');
  const cad = buildCatalogue([nativeEntry({ ribbon: '', currency: 'CAD' })], emptyCompat, 'en').tours[0];
  assert.equal(meta(cad).ribbon, '');
  assert.equal(meta(cad)['tourmaster-tour-currency'], '');
});

test('a draft that was never public on WordPress publishes without a compatibility snapshot', () => {
  const entry = nativeEntry({ source_key: 'wp-en-99999', source_status: 'draft', ribbon: '2026 Summer' });
  const { tours } = buildCatalogue([entry], emptyCompat, 'en');
  assert.equal(tours.length, 1);
  assert.equal(tours[0].id, '01NATIVE');
  assert.equal(meta(tours[0]).ribbon, '2026 Summer');
});

function importedEntry(key, overrides = {}) {
  const original = compat.locales.en.tours[key];
  const data = { title: 'x', summary: '', price: '', currency: '', duration: '', location: '', tour_code: '', overview: [], itinerary: [], itinerary_continued: [], additional_info: [], faq: [], gallery: [], source_key: key, source_status: 'publish', ribbon: original.tour.tour_meta.ribbon ?? '' };
  return { id: 'imp-' + key, slug: original.tour.slug, status: 'published', locale: 'en', publishedAt: published, data: { ...data, ...overrides } };
}
const sourceOf = key => {
  const original = compat.locales.en.tours[key], baseline = original.baseline;
  // Build the CMS fields exactly like the frozen baseline so nothing counts as an edit, except what a test overrides.
  return { key, original, baseline };
};
function catalogueFor(key, overrides) {
  const { original } = sourceOf(key);
  const slim = { locales: { en: { tours: { [key]: original }, terms: compat.locales.en.terms }, zh: compat.locales.zh } };
  return buildCatalogue([importedEntry(key, overrides)], slim, 'en', { allowEmpty: true });
}

test('every frozen compat tour has a ribbon baseline that matches its own label', () => {
  for (const loc of Object.values(compat.locales)) for (const [key, entry] of Object.entries(loc.tours))
    assert.equal(entry.baseline.ribbon, contentHash(entry.tour.tour_meta?.ribbon ?? ''), key);
});

test('an imported public tour keeps its frozen label until an editor changes it, and can clear it', () => {
  const key = Object.entries(compat.locales.en.tours).find(([, e]) => e.tour.tour_meta?.ribbon)?.[0];
  assert.ok(key, 'a compat tour with a label');
  const frozen = compat.locales.en.tours[key].tour.tour_meta.ribbon;
  // The other fields differ from the baseline here, which only overrides those fields; the label is judged on its own.
  const same = catalogueFor(key, {}).tours[0];
  assert.equal(meta(same).ribbon, frozen);
  assert.equal(meta(catalogueFor(key, { ribbon: 'Sold out' }).tours[0]).ribbon, 'Sold out');
  assert.equal(meta(catalogueFor(key, { ribbon: '' }).tours[0]).ribbon, '');
});

test('a frozen CAD label is hidden and an edited USD currency is shown', () => {
  const key = Object.entries(compat.locales.en.tours).find(([, e]) => /^cad$/i.test(e.tour.tour_meta?.['tourmaster-tour-currency'] ?? ''))?.[0];
  assert.ok(key, 'a compat tour priced with a CAD label');
  assert.equal(meta(catalogueFor(key, { currency: 'CAD' }).tours[0])['tourmaster-tour-currency'], '');
  assert.equal(meta(catalogueFor(key, { currency: 'USD' }).tours[0])['tourmaster-tour-currency'], 'USD');
});
