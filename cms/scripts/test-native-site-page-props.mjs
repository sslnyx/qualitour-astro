import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNativePageProps } from '../src/lib/cms/native-site-page-props.mjs';

const enTour = { id: 1, slug: 'rockies', title: { rendered: 'Rockies' }, translations: { zh: { id: 2, slug: 'luo-ji-shan' } } };
const zhTour = { id: 2, slug: 'luo-ji-shan', title: { rendered: '洛磯山' }, translations: { en: { id: 1, slug: 'rockies' } } };
const activity = { id: 10, slug: 'hiking', name: 'Hiking' };
const destination = { id: 20, slug: 'banff', name: 'Banff' };
const zhDestination = { id: 21, slug: 'banff-zh', name: '班夫', translations: { en: 'banff' } };
const duration = { id: 30, slug: '7-days', name: '7 days' };
const type = { id: 40, slug: 'group', name: 'Group' };
const catalogues = {
  en: { tours: [enTour, { id: 3, slug: 'same-title', title: { rendered: 'Rockies' } }], terms: { activities: [activity], destinations: [destination], durations: [duration], types: [type] } },
  zh: { tours: [zhTour], terms: { activities: [], destinations: [zhDestination], durations: [], types: [] } },
};

test('detail props preserve alternate, review, and duplicate-title rules', () => {
  const reviews = [{ related_tours: 1 }, { related_tours: [1, 99] }, { related_tours: 3 }];
  const props = resolveNativePageProps({ pathname: '/tours/rockies', catalogues, reviews, origin: 'https://qualitour.ca', base: '/' });
  assert.equal(props.tour, enTour);
  assert.equal(props.reviews.length, 2);
  assert.equal(props.alternates.length, 3);
  assert.equal(props.duplicateTitle, true);
  const zh = resolveNativePageProps({ pathname: '/zh/tours/luo-ji-shan', catalogues, reviews, origin: 'https://qualitour.ca', base: '/' });
  assert.equal(zh.reviews.length, 2);
  assert.equal(zh.alternates.length, 3);
});

test('taxonomy props retain zh-only English fallbacks and reject missing routes', () => {
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/activity/hiking', catalogues }), { activity });
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/duration/7-days', catalogues }), { duration });
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/type/group', catalogues }), { tourType: type });
  assert.equal(resolveNativePageProps({ pathname: '/fr/tours/rockies', catalogues }), null);
  assert.equal(resolveNativePageProps({ pathname: '/tours/missing', catalogues }), null);
  assert.equal(resolveNativePageProps({ pathname: '/zh/tours/unknown/nope', catalogues }), null);
});

test('destination URLs retain zh translation mapping, aliases, and base handling', () => {
  assert.deepEqual(resolveNativePageProps({ pathname: '/destinations/rockies', catalogues }), { destination });
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/destinations/rockies', catalogues }), { destination: zhDestination });
  assert.deepEqual(resolveNativePageProps({ pathname: '/staging/zh/destinations/banff', base: '/staging', catalogues }), { destination: zhDestination });
  assert.equal(resolveNativePageProps({ pathname: '/zh/destinations/nope', catalogues }), null);
});

test('listing-only routes receive empty props', () => {
  assert.deepEqual(resolveNativePageProps({ pathname: '/tours', catalogues }), {});
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/featured', catalogues }), {});
});
