import assert from 'node:assert/strict';
import test from 'node:test';
import { contributorId, fetchNewReviews, identityKeys, mapSerpReview } from './lib/serp-reviews.mjs';
import { run } from './sync-google-reviews.mjs';

const serp = (id, name, extra = {}) => ({
  review_id: id, rating: 5, snippet: 'Great trip ' + id, iso_date: '2026-11-10T12:00:00Z',
  user: { name, link: `https://www.google.com/maps/contrib/${id}0000/reviews?hl=en`, thumbnail: `https://lh3.googleusercontent.com/a/${id}=s40`, local_guide: true, reviews: 4, photos: 2 }, ...extra,
});
const page = (reviews, next) => new Response(JSON.stringify({ reviews, serpapi_pagination: next ? { next_page_token: next } : {} }));
const cmsFake = (items = []) => {
  const calls = [];
  return { calls, request: async (method, path, body) => {
    calls.push([method, path, body]);
    if (method === 'GET') return { items, total: items.length };
    if (path.endsWith('/publish')) return {};
    return { item: { id: 'new-' + calls.length } };
  } };
};

test('contributor id and identity keys', () => {
  assert.equal(contributorId('https://www.google.com/maps/contrib/104264985308334996174/reviews?hl=en'), '104264985308334996174');
  assert.equal(contributorId(''), null);
  assert.ok(identityKeys({ author_url: 'https://x/contrib/12/r', author_name: 'A', rating: 5, text: 't' }).includes('c:12'));
});

test('mapSerpReview maps to the CMS shape and rejects unusable reviews', () => {
  const entry = mapSerpReview(serp('5', 'Ann', { images: ['https://lh3.googleusercontent.com/p/1', { thumbnail: 'https://lh3.googleusercontent.com/p/2' }] }));
  assert.equal(entry.data.source_id, 'serp-5');
  assert.equal(entry.data.reviewed_at, '2026-11-10T12:00:00.000Z');
  assert.equal(entry.data.profile_photo_source, 'https://lh3.googleusercontent.com/a/5=s40');
  assert.equal(entry.data.images.length, 2);
  assert.throws(() => mapSerpReview({ review_id: 'x', rating: 5 }), /valid date/);
  assert.throws(() => mapSerpReview({ iso_date: '2026-01-01T00:00:00Z' }), /review_id/);
});

test('a week with nothing new costs one search and creates nothing', async () => {
  const known = new Set(['c:10000', 'c:20000']);
  let calls = 0;
  const { fresh, searches } = await fetchNewReviews({ apiKey: 'k', known, fetchImpl: async () => { calls++; return page([serp('1', 'A'), serp('2', 'B')], 'next'); } });
  assert.equal(fresh.length, 0); assert.equal(searches, 1); assert.equal(calls, 1);
});

test('new reviews are collected until a page is entirely known, and never duplicated', async () => {
  const known = new Set(['c:30000']);
  const pages = [page([serp('1', 'A'), serp('2', 'B')], 't2'), page([serp('2', 'B'), serp('3', 'C')], 't3')];
  const urls = [];
  const { fresh, searches } = await fetchNewReviews({ apiKey: 'k', known, fetchImpl: async url => { urls.push(String(url)); return pages.shift(); } });
  assert.deepEqual(fresh.map(entry => entry.data.author_name), ['A', 'B']);
  assert.equal(searches, 2);
  assert.match(urls[0], /sort_by=newestFirst/);
  assert.match(urls[1], /next_page_token=t2/);
});

test('an API error never leaks the key', async () => {
  await assert.rejects(fetchNewReviews({ apiKey: 'sekret', known: new Set(), fetchImpl: async () => new Response(JSON.stringify({ error: 'Invalid API key sekret' })) }),
    error => !/sekret/.test(error.message) && /SerpApi/.test(error.message));
  await assert.rejects(fetchNewReviews({ apiKey: 'k', known: new Set(), fetchImpl: async () => new Response('x', { status: 429 }) }), /HTTP 429/);
  await assert.rejects(fetchNewReviews({ apiKey: '', known: new Set() }), /SERPAPI_KEY/);
});

test('run: existing WordPress-era reviews are matched by contributor, new ones are mirrored, created and published', async () => {
  const existing = [{ id: 'e1', data: { source_id: 'google-102894', author_url: 'https://www.google.com/maps/contrib/10000/reviews', author_name: 'A', rating: 5, text: 'old' } }];
  const cms = cmsFake(existing);
  const mirrored = [];
  const summary = await run({
    cms, apiKey: 'k', pause: async () => {},
    fetchImpl: async () => page([serp('4', 'New', { images: ['https://lh3.googleusercontent.com/p/9'] }), serp('1', 'A')]),
    mirror: async (_cms, url, name, options) => { mirrored.push([url, name, options]); return '/_emdash/api/media/file/' + name; },
    log: () => {},
  });
  assert.deepEqual({ ...summary }, { existing: 1, newReviews: 1, searches: 1, created: 1, mirrored: 2, kept: 0, dryRun: false });
  const create = cms.calls.find(([method, path]) => method === 'POST' && path === '/_emdash/api/content/google_reviews');
  assert.match(create[2].data.profile_photo, /avatar-serp-4/);
  assert.match(create[2].data.images[0], /review-serp-4-1/);
  assert.equal(mirrored[0][2].maxWidth, 192);
  assert.ok(cms.calls.some(([, path]) => /\/publish$/.test(path)));
});

test('run: a photo that cannot be copied keeps its Google URL; dry run writes nothing', async () => {
  const cms = cmsFake();
  const summary = await run({ cms, apiKey: 'k', pause: async () => {}, fetchImpl: async () => page([serp('4', 'New')]), mirror: async () => { throw new Error('HTTP 403'); }, log: () => {} });
  assert.equal(summary.kept, 1);
  assert.match(cms.calls.find(([m, p]) => m === 'POST' && !p.endsWith('/publish'))[2].data.profile_photo, /^https:\/\/lh3/);
  const dry = cmsFake();
  const result = await run({ cms: dry, apiKey: 'k', pause: async () => {}, dryRun: true, fetchImpl: async () => page([serp('4', 'New')]), log: () => {} });
  assert.equal(dry.calls.filter(([m]) => m !== 'GET').length, 0);
  assert.equal(result.newReviews, 1);
});

test('an empty first page is a failure, not "nothing new"', async () => {
  await assert.rejects(fetchNewReviews({ apiKey: 'k', known: new Set(), fetchImpl: async () => page([]) }), /no reviews/);
});
