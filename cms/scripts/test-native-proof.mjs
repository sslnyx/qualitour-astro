import assert from 'node:assert/strict';
import test from 'node:test';

import { contentHash } from '../../src/lib/cms/legacy-adapter.mjs';
import {
  DEFAULT_NATIVE_TOUR_ID,
  PROOF_FIXTURE_IDS,
  assertPublicProofRequest,
  createNativeProofCatalogue,
  createNativeProofTour,
  imageTransformUrl,
  mediaFilePath,
  nativeProofTourHref,
} from '../src/lib/cms/native-proof.mjs';

const CUSTOMER_ID = DEFAULT_NATIVE_TOUR_ID;

function portableText(value) {
  return [{ _type: 'block', style: 'normal', children: [{ _type: 'span', text: value, marks: [] }], markDefs: [] }];
}

function makeFixture() {
  const fields = {
    title: '長江七號',
    summary: '保留原網站完整內容的測試行程',
    price: '9988',
    currency: 'CAD',
    duration: '16日',
    location: '中國',
    tour_code: 'CQ16',
    overview: portableText('原始完整介紹'),
    itinerary: [],
    itinerary_continued: [],
    additional_info: [],
    faq: [],
    gallery: [{ image: { meta: { storageKey: 'tours/changjiang/gallery-1.jpg' }, width: 1600, height: 1067 }, alt: '長江', caption: '' }],
  };
  const tour = {
    id: 19039,
    slug: 'legacy-changjiang',
    status: 'publish',
    date: '2026-10-01T00:00:00.000Z',
    title: { rendered: fields.title },
    excerpt: { rendered: fields.summary },
    content: { rendered: '<p>完整舊內容</p><img src="https://qualitour-cms-free-test.qualitour.workers.dev/_emdash/api/media/file/tours/changjiang/inline.jpg" srcset="https://qualitour-cms-free-test.qualitour.workers.dev/_emdash/api/media/file/tours/changjiang/inline.jpg 2x"><img src="https://qualitour.ca/wp-content/uploads/old.jpg"><iframe src="/_emdash/api/media/file/tours/changjiang/brochure.pdf#toolbar=0"></iframe><table><tr><td>保留表格</td></tr></table>' },
    featured_media: 10,
    featured_image_url: 'https://qualitour.ca/original.jpg',
    tour_meta: { price: fields.price, currency: fields.currency, duration: fields.duration, location: fields.location, tour_code: fields.tour_code },
    goodlayers_data: { sections: [{ value: { id: 'legacy-section' }, items: [{ type: 'text-box', value: { content: '<strong>完整區塊</strong>' } }] }], tour_gallery: [] },
    tour_terms: { categories: [], tags: [], activities: [], destinations: [], durations: [], types: [] },
  };
  const baseline = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, contentHash(value)]));
  const terms = Object.fromEntries(['categories', 'tags', 'activities', 'destinations', 'durations', 'types'].map(key => [key, []]));
  const compatibility = { locales: { zh: { tours: { 'wp-zh-19039': { date: tour.date, baseline, tour } }, terms } } };
  const entry = {
    id: 'zh/legacy-changjiang',
    data: {
      id: CUSTOMER_ID,
      status: 'published',
      locale: 'zh',
      publishedAt: new Date('2026-11-01T00:00:00.000Z'),
      source_key: 'wp-zh-19039',
      ...fields,
      hero: { meta: { storageKey: 'tours/changjiang/hero.jpg' }, width: 1920, height: 1080 },
      brochure: { meta: { storageKey: 'tours/changjiang/brochure.pdf' }, filename: 'brochure.pdf' },
    },
  };
  return { compatibility, entry };
}

test('public proof rejects preview, edit mode, drafts, and wrong locale', () => {
  assert.doesNotThrow(() => assertPublicProofRequest(new URL('https://example.test/native-proof/zh'), undefined));
  assert.throws(() => assertPublicProofRequest(new URL('https://example.test/native-proof/zh?_preview=token'), undefined), /preview/i);
  assert.throws(() => assertPublicProofRequest(new URL('https://example.test/native-proof/zh'), { editMode: true }), /preview/i);
  assert.throws(() => assertPublicProofRequest(new URL('https://example.test/native-proof/zh'), { preview: { collection: 'tours', id: CUSTOMER_ID } }), /preview/i);

  const { compatibility, entry } = makeFixture();
  assert.throws(() => createNativeProofCatalogue([{ ...entry, data: { ...entry.data, status: 'draft' } }], { compatibility }), /published/i);
  assert.throws(() => createNativeProofCatalogue([{ ...entry, data: { ...entry.data, locale: 'en' } }], { compatibility }), /locale/i);
});

test('catalogue preserves compatibility content and gives cards intentional proof links', () => {
  const { compatibility, entry } = makeFixture();
  const original = structuredClone(compatibility);
  const synthetic = {
    id: `zh/${PROOF_FIXTURE_IDS[0]}`,
    data: {
      id: PROOF_FIXTURE_IDS[0], status: 'published', locale: 'en', publishedAt: '2026-11-02T00:00:00.000Z',
      title: '原生發佈驗證', summary: '只顯示有限驗證標記',
    },
  };

  const result = createNativeProofCatalogue([entry], { compatibility, proofEntries: [synthetic] });
  assert.equal(result.catalogue.tours[0].id, 19039);
  assert.equal(result.catalogue.tours[0].date, '2026-11-01T00:00:00.000Z');
  assert.equal(result.catalogue.tours[0].slug, 'legacy-changjiang');
  assert.match(result.catalogue.tours[0].content.rendered, /保留表格/);
  assert.match(JSON.stringify(result.catalogue.tours[0].goodlayers_data), /完整區塊/);
  assert.equal(result.cards[0].slug, CUSTOMER_ID);
  assert.equal(nativeProofTourHref(CUSTOMER_ID), `/native-proof/zh/tours/${CUSTOMER_ID}`);
  assert.deepEqual(result.proofMarkers, [{ id: PROOF_FIXTURE_IDS[0], title: '原生發佈驗證', summary: '只顯示有限驗證標記' }]);
  assert.deepEqual(compatibility, original, 'compatibility source must remain frozen by convention');
});

test('detail keeps the real legacy identity while deriving only optimized safe media', () => {
  const { compatibility, entry } = makeFixture();
  const originalEntry = structuredClone(entry);
  const tour = createNativeProofTour(entry, { compatibility });

  assert.equal(tour.id, 19039);
  assert.equal(tour.slug, 'legacy-changjiang');
  assert.equal(tour.featured_image_url, '/_emdash/api/media/file/tours/changjiang/hero.jpg');
  assert.match(tour.optimizedHero.src, /^\/_image\?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Ftours%2Fchangjiang%2Fhero\.jpg&w=1920&f=webp&q=80$/);
  assert.ok(tour.optimizedHero.srcSet.split(', ').every(item => item.startsWith('/_image?href=')));
  const gallery = tour.goodlayers_data.tour_gallery;
  assert.equal(gallery[0].url, '/_emdash/api/media/file/tours/changjiang/gallery-1.jpg');
  assert.match(tour.optimizedPhotos[gallery[0].url].thumbnail, /^\/_image\?/);
  assert.equal(tour.tour_meta.brochure.url, '/_emdash/api/media/file/tours/changjiang/brochure.pdf');
  assert.match(tour.content.rendered, /src="\/_image\?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Ftours%2Fchangjiang%2Finline\.jpg&amp;w=960&amp;f=webp&amp;q=80"/);
  assert.doesNotMatch(tour.content.rendered, /srcset=|qualitour-cms-free-test|wp-content\/uploads/);
  assert.match(tour.content.rendered, /<iframe src="\/_emdash\/api\/media\/file\/tours\/changjiang\/brochure\.pdf#toolbar=0"><\/iframe>/);
  assert.deepEqual(entry, originalEntry, 'native entry must not be mutated');
});

test('media helpers accept only safe storage keys and never trust an arbitrary URL', () => {
  const safe = { meta: { storageKey: 'tour-images/hero 1.jpg' } };
  assert.equal(mediaFilePath({ meta: { storageKey: 'tour-images/hero-1.jpg' } }), '/_emdash/api/media/file/tour-images/hero-1.jpg');
  assert.equal(mediaFilePath(safe), undefined);
  assert.equal(mediaFilePath({ meta: { storageKey: '../secret.jpg' } }), undefined);
  assert.equal(mediaFilePath({ url: 'https://attacker.example/image.jpg' }), undefined);
  assert.equal(imageTransformUrl({ meta: { storageKey: 'tour-images/hero-1.jpg' } }, 960), '/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Ftour-images%2Fhero-1.jpg&w=960&f=webp&q=80');
  assert.equal(imageTransformUrl({ meta: { storageKey: 'tour-images/hero-1.jpg' } }, 0), undefined);
});
