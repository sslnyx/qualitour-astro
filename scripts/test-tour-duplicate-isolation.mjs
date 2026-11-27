// A published copy of an imported tour (the CMS "Duplicate" button copies `source_key` too), or a tour with an
// identity the site does not know, must hide only that tour. The original keeps its content and address.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCatalogue } from '../src/lib/cms/legacy-adapter.mjs';
import { createNativeSiteData } from '../cms/src/lib/cms/native-site-data.mjs';
import { createNativeProofCatalogue } from '../cms/src/lib/cms/native-proof.mjs';

const compat = JSON.parse(readFileSync(new URL('../src/data/cms-legacy-compat.json', import.meta.url), 'utf8'));
// Two imported Chinese tours with the CMS IDs they were imported under.
const ORIGINAL = { id: '01M75ZNPEHVC6NF9M7C8HW092V', key: 'wp-zh-6712' };
const OTHER = { id: '01M764NHD14WJSPDZF9FDZ7P0G', key: 'wp-zh-6730' };
const COPY_ID = '01M9ZZZZZZZZZZZZZZZZZZZZZ1';
const publicSlug = key => compat.locales.zh.tours[key].tour.slug;
const empty = { overview: null, itinerary: null, itinerary_continued: null, additional_info: null, faq: null, gallery: null };

function imported({ id, key }, { title = `團 ${key}`, slug = `cms-${id.toLowerCase()}`, publishedAt = '2026-11-12T00:00:00Z', data = {} } = {}) {
  return { id, slug, locale: 'zh', status: 'published', publishedAt, data: { title, summary: '', price: '100', currency: '', duration: '', location: '', tour_code: key, source_key: key, source_status: 'publish', ...empty, ...data } };
}
const original = () => imported(ORIGINAL, { title: '原團' });
const other = () => imported(OTHER, { title: '另一團' });
// As EmDash duplicates: every field copied, "(Copy)" on the title, a new ID and slug, published later.
const copy = (extra = {}) => imported({ id: COPY_ID, key: ORIGINAL.key }, { title: '原團 (Copy)', slug: 'copy', publishedAt: '2026-11-27T00:00:00Z', ...extra });
const native = (id, slug, { publishedAt = '2026-11-27T00:00:00Z', locale = 'zh' } = {}) => ({ id, slug, locale, status: 'published', publishedAt, data: { title: `新團 ${id}`, source_key: null, source_status: null } });

const build = entries => buildCatalogue(entries, compat, 'zh', { allowEmpty: true });
const plain = value => JSON.parse(JSON.stringify(value));
const ids = catalogue => catalogue.tours.map(tour => String(tour.id)).sort();
const rejected = catalogue => (catalogue.rejected || []).map(row => [row.entryId, row.code]).sort();

test('a published copy in the same batch is left out and the original is exactly as before, in either order', () => {
  const before = build([original(), other()]);
  for (const entries of [[copy(), original(), other()], [original(), other(), copy()]]) {
    const after = build(entries);
    assert.deepEqual(plain(after.tours), plain(before.tours));
    assert.deepEqual(plain(after.terms), plain(before.terms));
    assert.deepEqual(rejected(after), [[COPY_ID, 'copy']]);
  }
});

test('a copy never takes over the address of an original that is not published', () => {
  const catalogue = build([copy(), other()]);
  assert.deepEqual(ids(catalogue), ['6730']);
  assert.ok(!catalogue.tours.some(tour => tour.slug === publicSlug(ORIGINAL.key)));
  assert.deepEqual(rejected(catalogue), [[COPY_ID, 'copy']]);
});

test('an unknown or missing source identity hides only that tour', () => {
  const unknown = imported({ id: '01M9ZZZZZZZZZZZZZZZZZZZZZ2', key: 'wp-zh-999999' });
  const blank = imported({ id: '01M9ZZZZZZZZZZZZZZZZZZZZZ3', key: '' });
  const otherLanguage = imported({ id: '01M9ZZZZZZZZZZZZZZZZZZZZZ4', key: 'wp-en-7033' });
  const catalogue = build([unknown, original(), blank, otherLanguage, other()]);
  assert.deepEqual(ids(catalogue), ['6712', '6730']);
  assert.deepEqual(rejected(catalogue), [[unknown.id, 'unknown-source-key'], [blank.id, 'missing-source-key'], [otherLanguage.id, 'unknown-source-key']]);
});

test('a broken copy cannot break the catalogue', () => {
  const broken = copy({ data: { title: '', price: { not: 'text' }, hero: 'unresolved' } });
  delete broken.publishedAt;
  assert.deepEqual(ids(build([broken, original()])), ['6712']);
});

test('an imported tour keeps its address against a new tour that uses the same slug, in either order', () => {
  const squatter = native('01M9ZZZZZZZZZZZZZZZZZZZZZ5', publicSlug(ORIGINAL.key), { publishedAt: '2020-01-01T00:00:00Z' });
  for (const entries of [[squatter, original()], [original(), squatter]]) {
    const catalogue = build(entries);
    assert.deepEqual(ids(catalogue), ['6712']);
    assert.deepEqual(rejected(catalogue), [[squatter.id, 'url-taken']]);
  }
});

test('of two new tours with one address the one published first keeps it', () => {
  const first = native('01M9ZZZZZZZZZZZZZZZZZZZZZ7', 'same-address', { publishedAt: '2026-01-01T00:00:00Z' });
  const second = native('01M9ZZZZZZZZZZZZZZZZZZZZZ6', 'Same-Address', { publishedAt: '2026-11-27T00:00:00Z' });
  for (const entries of [[second, first], [first, second]]) {
    const catalogue = build(entries);
    assert.deepEqual(ids(catalogue), [first.id]);
    assert.deepEqual(rejected(catalogue), [[second.id, 'url-taken']]);
  }
});

// The live loader: rows arrive newest first in pages, with their CMS categories attached.
const destination = { id: 'term-zh', name: 'destinations', slug: 'geo-banff', label: '班夫', parentId: null, locale: 'zh', translationGroup: 'term-pair' };
const row = (entry, terms = {}) => ({ id: entry.id, slug: entry.slug, data: { translationGroup: entry.id, ...entry.data, id: entry.id, status: entry.status, locale: entry.locale, publishedAt: entry.publishedAt, terms } });
const categorised = entry => row(entry, { destinations: [destination] });
const english = (id, extra = {}) => { const value = row(native(id, `english-${id.toLowerCase()}`, { locale: 'en' })); Object.assign(value.data, extra); return value; };

function site(zhPages, enRows = [english('01M9ZZZZZZZZZZZZZZZZZZZZE1')]) {
  const all = [...zhPages.flat(), ...enRows];
  const api = createNativeSiteData({
    compatibility: compat,
    getContext: () => undefined,
    snapshotStore: { version: async () => null, get: async () => null, put: async () => {} },
    readTourPages: async function* (locale) { if (locale === 'en') yield enRows; else yield* zhPages; },
    readVocabulary: async () => ({ vocabulary: { en: {}, zh: { destinations: [destination] } }, hints: [] }),
    lookupMediaStorageKeys: async () => new Map(),
    presentTours: async tours => tours,
    readReviews: async () => null,
    readEntry: async id => all.find(item => item.id === id) || null,
  });
  return api;
}

const layouts = {
  'copy and original on one page, copy first': () => [[row(copy()), categorised(original()), categorised(other())]],
  'copy and original on one page, original first': () => [[categorised(original()), row(copy()), categorised(other())]],
  'copy on an earlier page than the original': () => [[row(copy())], [categorised(original()), categorised(other())]],
  'copy on a later page than the original': () => [[categorised(original()), categorised(other())], [row(copy())]],
};
for (const [name, pages] of Object.entries(layouts)) {
  test(`site catalogue: ${name}`, async () => {
    const before = (await site([[categorised(original()), categorised(other())]]).getNativeSiteCatalogues()).zh;
    const api = site(pages());
    const after = (await api.getNativeSiteCatalogues()).zh;
    assert.deepEqual(plain(after.tours), plain(before.tours));
    assert.deepEqual(plain(after.terms), plain(before.terms));
    const tour = after.tours.find(item => item.id === 6712);
    assert.equal(tour.entryId, ORIGINAL.id);
    assert.deepEqual(tour.tour_terms.destinationScope, ['geo-banff']);
    assert.equal((await api.getNativeTourDetail('zh', tour)).title.rendered, '原團');
  });
}

test('site catalogue: a translation added to a copy is not linked to the original', async () => {
  const translated = english('01M9ZZZZZZZZZZZZZZZZZZZZE2', { translationGroup: COPY_ID });
  const { en, zh } = await site([[row(copy())], [categorised(original())]], [translated]).getNativeSiteCatalogues();
  assert.equal(zh.tours.length, 1);
  assert.equal(zh.tours[0].translations?.en?.id === translated.id, false);
  assert.equal(en.tours[0].translations, undefined);
});

test('site catalogue: unknown identities and a taken address on separate pages hide only those tours', async () => {
  const unknown = imported({ id: '01M9ZZZZZZZZZZZZZZZZZZZZZ2', key: 'wp-zh-999999' });
  const squatter = native('01M9ZZZZZZZZZZZZZZZZZZZZZ5', publicSlug(ORIGINAL.key));
  const { zh } = await site([[row(squatter)], [row(unknown)], [categorised(original())]]).getNativeSiteCatalogues();
  assert.deepEqual(ids(zh), ['6712']);
  assert.equal(zh.tours[0].entryId, ORIGINAL.id);
  assert.deepEqual(zh.terms.destinations.map(term => [term.slug, term.count]), [['geo-banff', 1]]);
});

test('the native proof pages take media and links from the original, not from its copy', () => {
  const entries = [original(), copy()].map(entry => row(entry));
  const { cards } = createNativeProofCatalogue(entries, { compatibility: compat });
  assert.deepEqual(cards.map(card => card.slug), [ORIGINAL.id]);
});
