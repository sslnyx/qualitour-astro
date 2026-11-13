import assert from 'node:assert/strict';
import test from 'node:test';
import { createSqlTourSource } from '../src/lib/cms/native-site-data.mjs';
import { readAssignments, readPublishedPage, rowToEntry, termsForEntry } from '../src/lib/cms/native-site-sql.mjs';

/** Records the builder calls and answers `execute` from a scripted list of result sets. */
function fakeDb(results) {
  const calls = [];
  const builder = table => {
    const call = { table, steps: [] };
    calls.push(call);
    const chain = new Proxy({}, { get: (_, method) => method === 'execute'
      ? async () => results[table]?.(call) ?? []
      : (...args) => { call.steps.push([method, ...args]); return chain; } });
    return chain;
  };
  return { db: { selectFrom: builder }, calls };
}

const row = (id, extra = {}) => ({
  id, slug: `slug-${id}`, status: 'published', locale: 'en', published_at: '2026-01-02T03:04:05.000Z', translation_group: `g-${id}`,
  title: 'Title', tour_code: null, summary: 'Sum', price: '100', currency: 'CAD', duration: '2 Days', location: 'Here',
  hero: '{"id":"h","meta":{"storageKey":"k.jpg"},"width":10,"height":5}', brochure: null, overview: '[{"_type":"block"}]',
  itinerary: '[]', itinerary_continued: null, gallery: null, additional_info: null, faq: '[]', source_key: null, source_status: null, ...extra,
});

test('rows become the entries EmDash would return: parsed JSON, null structured fields absent, dates as Date', () => {
  const entry = rowToEntry(row('a'), 'en', { destinations: [{ slug: 'x' }] });
  assert.equal(entry.id, 'a');
  assert.equal(entry.data.hero.meta.storageKey, 'k.jpg');
  assert.deepEqual(entry.data.overview, [{ _type: 'block' }]);
  for (const absent of ['brochure', 'gallery', 'additional_info', 'itinerary_continued', 'source_key', 'source_status'])
    assert.equal(Object.hasOwn(entry.data, absent), false, `${absent} is omitted when null`);
  assert.equal(entry.data.tour_code, null, 'plain null columns stay null');
  assert.equal(entry.data.publishedAt instanceof Date, true);
  assert.equal(entry.data.translationGroup, 'g-a');
  assert.deepEqual(entry.data.terms, { destinations: [{ slug: 'x' }] });
  assert.equal(rowToEntry(row('b', { source_key: 'wp-en-1', source_status: 'publish' }), 'en').data.source_key, 'wp-en-1');
  assert.throws(() => rowToEntry(row('c', { hero: '{broken' }), 'en'), /Invalid stored hero for CMS entry c/);
});

test('page reads are published, not deleted, one locale, newest first with a stable tie-break', async () => {
  const { db, calls } = fakeDb({ ec_tours: () => [row('a')] });
  assert.equal((await readPublishedPage(db, 'zh', { limit: 32, offset: 64 })).length, 1);
  const steps = calls[0].steps.map(step => step.join(' '));
  assert.deepEqual(steps, ['selectAll', 'where status = published', 'where deleted_at is ', 'where locale = zh', 'orderBy published_at desc', 'orderBy id asc', 'limit 32', 'offset 64']);
});

test('assignments group translation-group IDs per entry', async () => {
  const { db, calls } = fakeDb({ content_taxonomies: () => [
    { entry_id: 'a', taxonomy_id: 't1' }, { entry_id: 'a', taxonomy_id: 't2' }, { entry_id: 'b', taxonomy_id: 't1' },
  ] });
  const byEntry = await readAssignments(db);
  assert.deepEqual(byEntry.get('a'), ['t1', 't2']);
  assert.deepEqual(byEntry.get('b'), ['t1']);
  assert.deepEqual(calls[0].steps.find(step => step[0] === 'where'), ['where', 'collection', '=', 'tours']);
});

test('terms resolve by translation group and a language without the translation falls back to English', () => {
  const en = { destinations: [{ id: 'd-en', slug: 'geo-ca', label: 'Canada', parentId: null, locale: 'en', translationGroup: 'g1' }, { id: 'd2-en', slug: 'geo-us', label: 'USA', parentId: null, locale: 'en', translationGroup: 'g2' }] };
  const zh = { destinations: [{ id: 'd-zh', slug: 'geo-ca', label: '加拿大', parentId: null, locale: 'zh', translationGroup: 'g1' }] };
  const result = termsForEntry(['g1', 'g2', 'gone'], zh, en);
  assert.deepEqual(result.destinations.map(term => [term.slug, term.label, term.locale]), [['geo-ca', '加拿大', 'zh'], ['geo-us', 'USA', 'en']]);
  assert.deepEqual(termsForEntry(['nothing'], zh, en), {}, 'taxonomies with no assignment are absent');
  assert.deepEqual(termsForEntry(['g1'], en, undefined).destinations.map(term => term.id), ['d-en']);
});

test('the SQL source pages until a short page and attaches terms per locale', async () => {
  const pages = [[row('a'), row('b')], [row('c')]];
  const { db, calls } = fakeDb({
    ec_tours: call => pages[call.steps.find(step => step[0] === 'offset')[1] / 2] ?? [],
    content_taxonomies: () => [{ entry_id: 'a', taxonomy_id: 'g1' }, { entry_id: 'c', taxonomy_id: 'g1' }],
  });
  const vocabulary = { en: { destinations: [{ id: 'd1', slug: 'geo-ca', label: 'Canada', locale: 'en', translationGroup: 'g1' }] }, zh: {} };
  const source = createSqlTourSource({ getDatabase: async () => db, pageSize: 2 });
  const seen = [];
  for await (const page of source('en', vocabulary)) seen.push(page.map(entry => [entry.id, (entry.data.terms.destinations || []).map(term => term.slug)]));
  assert.deepEqual(seen, [[['a', ['geo-ca']], ['b', []]], [['c', ['geo-ca']]]]);
  assert.equal(calls.filter(call => call.table === 'ec_tours').length, 2, 'stops after the short page without an extra query');
});
