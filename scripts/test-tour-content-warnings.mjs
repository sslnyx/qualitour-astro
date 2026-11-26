import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildCatalogue, contentHash } from '../src/lib/cms/legacy-adapter.mjs';
import { hideFlaggedContent, tourWarnings } from '../src/lib/cms/tour-content-warnings.mjs';

const rules = [{ id: 'wrong-picture', tours: ['wp-zh-2'], hide: ['/uploads/2026/06/簽證表', 'MEDIA-KEY-1'], title: '已隱藏', message: '放錯團', action: '請刪除' }];
const encoded = `https://qualitour.ca/zh/wp-content/uploads/2026/06/${encodeURIComponent('簽證表')}.jpg`;
const sample = () => ({
  featured_image_url: 'https://cms.test/_emdash/api/media/file/MEDIA-KEY-1.jpg',
  content: { rendered: `<p>留下<img src="${encoded}" alt=""><img src="https://qualitour.ca/other.jpg"></p>` },
  goodlayers_data: {
    sections: [{ value: { id: 'itinerary' }, items: [{ type: 'text-box', value: { content: '<p>【出行證件須知】護照</p>' } }, { type: 'column', items: [{ type: 'image', value: { url: encoded } }, { type: 'image', value: { url: 'https://qualitour.ca/keep.jpg' } }] }] }],
    tour_gallery: [{ url: 'https://cms.test/_emdash/api/media/file/MEDIA-KEY-1.avif' }, { url: 'https://cms.test/_emdash/api/media/file/MEDIA-KEY-2.jpg' }],
  },
});

test('a flagged picture disappears from widgets, rich text, the gallery and the cover of the listed tour only', () => {
  const tour = hideFlaggedContent(sample(), 'wp-zh-2', rules);
  const everything = JSON.stringify(tour);
  assert.equal(everything.includes('MEDIA-KEY-1'), false);
  assert.equal(everything.includes(encodeURIComponent('簽證表')), false);
  assert.equal(tour.featured_image_url, '');
  assert.deepEqual(tour.goodlayers_data.tour_gallery.map(item => item.url.split('/').at(-1)), ['MEDIA-KEY-2.jpg']);
  assert.deepEqual(tour.goodlayers_data.sections[0].items[1].items.map(item => item.value.url), ['https://qualitour.ca/keep.jpg']);
  assert.match(tour.goodlayers_data.sections[0].items[0].value.content, /出行證件須知/);
  assert.equal(tour.content.rendered, '<p>留下<img src="https://qualitour.ca/other.jpg"></p>');
});

test('other tours are returned untouched and the input is never changed', () => {
  const original = sample(), copy = structuredClone(original);
  assert.equal(hideFlaggedContent(original, 'wp-zh-1', rules), original);
  assert.equal(hideFlaggedContent(original, undefined, rules), original);
  hideFlaggedContent(original, 'wp-zh-2', rules);
  assert.deepEqual(original, copy);
});

test('the editor warning counts the flagged pictures still stored in the CMS gallery', () => {
  const data = { source_key: 'wp-zh-2', gallery: [{ image: { id: 'a', meta: { storageKey: 'MEDIA-KEY-1.avif' } } }, { image: { id: 'b', meta: { storageKey: 'MEDIA-KEY-2.jpg' } } }] };
  assert.deepEqual(tourWarnings(data, rules).map(({ id, inGallery }) => [id, inGallery]), [['wrong-picture', 1]]);
  assert.deepEqual(tourWarnings({ ...data, gallery: [] }, rules).map(item => item.inGallery), [0]);
  assert.deepEqual(tourWarnings({ source_key: 'wp-zh-1', gallery: data.gallery }, rules), []);
});

// A whole JSON document can hold stray percent signs, so only well-formed escape runs are decoded.
const readable = text => text.replace(/(?:%[0-9a-f]{2})+/gi, run => { try { return decodeURIComponent(run); } catch { return run; } });

test('the published rule hides the cruise visa table from the three Tibet tours and keeps it on the cruise tour', () => {
  // The bundled import data is what the itinerary notes render from.
  const compat = JSON.parse(readFileSync(new URL('../src/data/cms-legacy-compat.json', import.meta.url), 'utf8'));
  const before = contentHash(compat.locales.zh.tours);
  const shows = key => readable(JSON.stringify(hideFlaggedContent(compat.locales.zh.tours[key].tour, key).goodlayers_data)).includes('/uploads/2026/06/出行證件須知');
  assert.deepEqual(['wp-zh-18823', 'wp-zh-18908', 'wp-zh-18962', 'wp-zh-18971'].map(shows), [true, false, false, false]);
  assert.equal(contentHash(compat.locales.zh.tours), before);
});

test('the catalogue used by every public page applies the rule', () => {
  const source = readFileSync(new URL('../src/lib/cms/legacy-adapter.mjs', import.meta.url), 'utf8');
  assert.equal(typeof buildCatalogue, 'function');
  const compat = { locales: { zh: { tours: {}, terms: {} } } };
  const media = key => ({ image: { id: key, meta: { storageKey: key } } });
  const native = id => ({ id, slug: id, status: 'published', locale: 'zh', publishedAt: '2026-01-01T00:00:00Z', data: { title: id, source_key: 'wp-zh-18908', source_status: 'draft', gallery: [media('01M765HE51FTTRERJP7SH5DTHA.01M765HEG01W6G793YYQFA3EMA.avif'), media('KEEP.jpg')] } });
  const [tour] = buildCatalogue([native('only')], compat, 'zh').tours;
  assert.deepEqual(tour.goodlayers_data.tour_gallery.map(item => item.url.split('/').at(-1)), ['KEEP.jpg']);
  assert.match(source, /hideFlaggedContent\(tour, key\)|hideFlaggedContent\(tour,key\)/);
});
