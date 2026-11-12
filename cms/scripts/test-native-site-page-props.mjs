import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveNativePageProps } from '../src/lib/cms/native-site-page-props.mjs';

const enTour = { id: 1, slug: 'rockies', title: { rendered: 'Rockies' }, translations: { zh: { id: 2, slug: 'luo-ji-shan' } } };
const zhTour = { id: 2, slug: 'luo-ji-shan', title: { rendered: '洛磯山' }, translations: { en: { id: 1, slug: 'rockies' } } };
const style = { id: 's1', slug: 'cruises', name: 'Cruises', count: 2 };
const emptyStyle = { id: 's2', slug: 'rail-journeys', name: 'Rail', count: 0 };
const destination = { id: 'ca', slug: 'geo-ca', name: 'Canada', count: 3 };
const zhDestination = { id: 'ca-zh', slug: 'geo-ca', name: '加拿大', count: 1 };
const catalogues = {
  en: { tours: [enTour, { id: 3, slug: 'same-title', title: { rendered: 'Rockies' } }], terms: { styles: [style, emptyStyle], destinations: [destination] } },
  zh: { tours: [zhTour], terms: { styles: [], destinations: [zhDestination] } },
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

test('category props require a used term and carry reciprocal alternates only when both locales have it', () => {
  const origin = 'https://qualitour.ca';
  assert.deepEqual(resolveNativePageProps({ pathname: '/tours/destination/geo-ca', catalogues, origin }), {
    destination,
    alternates: [
      { lang: 'en', href: 'https://qualitour.ca/tours/destination/geo-ca' },
      { lang: 'zh', href: 'https://qualitour.ca/zh/tours/destination/geo-ca' },
      { lang: 'x-default', href: 'https://qualitour.ca/tours/destination/geo-ca' },
    ],
  });
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/destination/geo-ca', catalogues, origin }).destination, zhDestination);
  assert.deepEqual(resolveNativePageProps({ pathname: '/tours/style/cruises', catalogues, origin }), { style, alternates: [] });
  assert.equal(resolveNativePageProps({ pathname: '/tours/style/rail-journeys', catalogues }), null, 'a term without published tours is a 404, not a thin page');
  assert.equal(resolveNativePageProps({ pathname: '/zh/tours/style/cruises', catalogues }), null, 'no English fallback for a Chinese page');
  assert.equal(resolveNativePageProps({ pathname: '/staging/zh/tours/destination/geo-ca', base: '/staging', catalogues }).destination, zhDestination);
});

test('removed legacy category routes and unknown or foreign locales resolve to nothing', () => {
  for (const pathname of ['/tours/type/group', '/tours/activity/hiking', '/tours/duration/7-days', '/destinations/rockies', '/zh/tours/unknown/nope', '/fr/tours/rockies', '/tours/missing'])
    assert.equal(resolveNativePageProps({ pathname, catalogues }), null, pathname);
});

test('listing-only routes receive empty props', () => {
  assert.deepEqual(resolveNativePageProps({ pathname: '/tours', catalogues }), {});
  assert.deepEqual(resolveNativePageProps({ pathname: '/zh/tours/featured', catalogues }), {});
});
