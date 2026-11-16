import assert from 'node:assert/strict';
import test from 'node:test';
import { createSqlTourSource } from '../src/lib/cms/native-site-data.mjs';
import { REVIEW_COLUMNS, readPublishedReviewRows, relativeTimeDescription, reviewRowToLegacy, CARD_COLUMNS, OMITTED_COLUMNS, buildVocabulary, readAssignments, readPublishedPage, readVocabularyRows, rowToEntry, termsForEntry } from '../src/lib/cms/native-site-sql.mjs';
import { buildCatalogue } from '../../src/lib/cms/legacy-adapter.mjs';

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

test('rows become the entries the live loader returns: JSON parsed, SQL nulls kept as null, system columns left out', () => {
  const entry = rowToEntry(row('a', { brochure: '' }), 'en', { destinations: [{ slug: 'x' }] });
  assert.equal(entry.id, 'a');
  assert.equal(entry.data.hero.meta.storageKey, 'k.jpg');
  assert.deepEqual(entry.data.overview, [{ _type: 'block' }]);
  for (const unset of ['tour_code', 'itinerary_continued', 'gallery', 'additional_info', 'source_key', 'source_status'])
    assert.equal(entry.data[unset], null, `${unset} is null, not absent`);
  assert.equal(entry.data.brochure, '', 'an empty string is not null');
  for (const system of ['author_id', 'created_at', 'deleted_at', 'version', 'live_revision_id']) assert.equal(Object.hasOwn(entry.data, system), false);
  assert.equal(entry.data.publishedAt instanceof Date, true);
  assert.equal(entry.data.translationGroup, 'g-a');
  assert.deepEqual(entry.data.terms, { destinations: [{ slug: 'x' }] });
  assert.equal(rowToEntry(row('b', { source_key: 'wp-en-1', source_status: 'publish' }), 'en').data.source_key, 'wp-en-1');
  assert.equal(rowToEntry(row('c', { hero: '{broken' }), 'en').data.hero, '{broken', 'unparseable JSON-looking text is kept as text');
});

test('local media references are normalised the way the loader does', () => {
  const bare = rowToEntry(row('m', { hero: '{"provider":"local","src":"abc.jpg"}' }), 'en').data.hero;
  assert.deepEqual(bare, { provider: 'local', src: '/_emdash/api/media/file/abc.jpg', id: 'abc.jpg' });
  const prefixed = rowToEntry(row('p', { hero: '{"provider":"local","src":"/_emdash/api/media/file/xyz.jpg"}' }), 'en').data.hero;
  assert.deepEqual(prefixed, { provider: 'local', src: '/_emdash/api/media/file/xyz.jpg', id: 'xyz.jpg' });
  const nested = rowToEntry(row('g', { gallery: '[{"image":{"provider":"local","src":"g.jpg","id":"keep"}}]' }), 'en').data.gallery;
  assert.deepEqual(nested, [{ image: { provider: 'local', src: '/_emdash/api/media/file/g.jpg', id: 'keep' } }]);
  const stored = rowToEntry(row('s'), 'en').data.hero;
  assert.deepEqual(stored, { id: 'h', meta: { storageKey: 'k.jpg' }, width: 10, height: 5 }, 'already-complete references are untouched');
});

test('page reads are published, not deleted, one locale, newest first with a stable tie-break', async () => {
  const { db, calls } = fakeDb({ ec_tours: () => [row('a')] });
  assert.equal((await readPublishedPage(db, 'zh', { limit: 32, offset: 64 })).length, 1);
  const steps = calls[0].steps.map(step => step.join(' '));
  assert.deepEqual(steps, [`select ${CARD_COLUMNS.join(',')}`, 'where status = published', 'where deleted_at is ', 'where locale = zh', 'orderBy published_at desc', 'orderBy id asc', 'limit 32', 'offset 64']);
});

test('page reads leave out the itinerary, rich text and gallery columns and hand the adapter explicit nulls for them', async () => {
  for (const bulky of ['overview', 'itinerary', 'itinerary_continued', 'additional_info', 'faq', 'gallery']) {
    assert.ok(OMITTED_COLUMNS.includes(bulky), `${bulky} is omitted`);
    assert.equal(CARD_COLUMNS.includes(bulky), false, `${bulky} is not selected`);
  }
  for (const needed of ['id', 'slug', 'status', 'published_at', 'locale', 'translation_group', 'title', 'summary', 'price', 'currency', 'duration', 'location', 'tour_code', 'hero', 'brochure', 'source_key', 'source_status'])
    assert.ok(CARD_COLUMNS.includes(needed), `${needed} is selected`);
  // A fake database that honours the column list, as SQL does.
  const full = row('a', { itinerary: '[{"title":"Day 1"}]', overview: '[{"_type":"block"}]', gallery: '[{"image":{}}]' });
  const { db } = fakeDb({ ec_tours: call => { const columns = call.steps.find(step => step[0] === 'select')[1]; return [Object.fromEntries(Object.entries(full).filter(([key]) => columns.includes(key)))]; } });
  const [page] = await readPublishedPage(db, 'en', { limit: 10, offset: 0 });
  for (const bulky of OMITTED_COLUMNS) assert.equal(page[bulky], null, `${bulky} is an explicit null`);
  assert.equal(page.title, 'Title');
});

test('a catalogue built from the narrowed rows has the same cards as one built from complete rows', () => {
  const compat = { locales: { en: { tours: {}, terms: { categories: [], tags: [], activities: [], destinations: [], durations: [], types: [] } } } };
  const complete = row('native-a', { overview: '[{"_type":"block","children":[{"_type":"span","text":"Hello"}]}]', itinerary: '[{"title":"Day 1","content":[]}]', gallery: '[]', additional_info: '[]', faq: '[{"title":"Q","content":[]}]' });
  const narrowed = { ...complete, ...Object.fromEntries(OMITTED_COLUMNS.map(column => [column, null])) };
  const lite = rows => {
    const entries = rows.map(source => { const entry = rowToEntry(source, 'en'); return { id: entry.id, slug: entry.slug, status: 'published', locale: 'en', publishedAt: entry.data.publishedAt.toISOString(), data: { ...entry.data, id: entry.id, status: 'published', locale: 'en' } }; });
    const catalogue = buildCatalogue(entries, compat, 'en', { allowEmpty: true });
    return JSON.stringify({ terms: catalogue.terms, excluded: catalogue.excluded, tours: catalogue.tours.map(tour => Object.fromEntries(Object.entries(tour).filter(([key]) => key !== 'content' && key !== 'goodlayers_data'))) });
  };
  assert.equal(lite([narrowed]), lite([complete]));
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
  assert.deepEqual(result.destinations.map(term => [term.slug, term.label, term.locale]), [['geo-us', 'USA', 'en'], ['geo-ca', '加拿大', 'zh']]);
  assert.deepEqual(termsForEntry(['nothing'], zh, en), {}, 'taxonomies with no assignment are absent');
  assert.deepEqual(termsForEntry(['g1'], en, undefined).destinations.map(term => term.id), ['d-en']);
});

test('assigned terms are ordered by label like EmDash hydration orders them',() => {
  const vocabulary = { destinations: ['Zeta', 'Alpha', 'Moraine Lake', 'Lake Louise'].map((label, index) => ({ id: `d${index}`, slug: label.toLowerCase().replace(/ /g, '-'), label, locale: 'en', translationGroup: `g${index}` })) };
  const result = termsForEntry(['g0', 'g1', 'g2', 'g3'], vocabulary);
  assert.deepEqual(result.destinations.map(term => term.label), ['Alpha', 'Lake Louise', 'Moraine Lake', 'Zeta']);
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

test('the vocabulary is read flat in EmDash order for the four tour taxonomies',async()=>{
  const { db, calls } = fakeDb({ taxonomies: () => [] });
  await readVocabularyRows(db);
  assert.deepEqual(calls[0].steps.map(step => step.join(' ')).slice(1),
    ['where name in destinations,travel_styles,travel_regions,cruise_types', 'orderBy sort_order asc', 'orderBy label asc']);
});

test('cross-language parents are re-linked by slug so translated terms are not orphaned',() => {
  const rows = [
    { id: 'na-en', name: 'destinations', slug: 'geo-continent-na', label: 'North America', parent_id: null, locale: 'en', translation_group: 'gNA' },
    { id: 'ca-en', name: 'destinations', slug: 'geo-ca', label: 'Canada', parent_id: 'na-en', locale: 'en', translation_group: 'gCA' },
    { id: 'na-zh', name: 'destinations', slug: 'geo-continent-na', label: '北美洲', parent_id: null, locale: 'zh', translation_group: 'gNA' },
    { id: 'ca-zh', name: 'destinations', slug: 'geo-ca', label: '加拿大', parent_id: 'na-en', locale: 'zh', translation_group: 'gCA' },
    { id: 'banff-zh', name: 'destinations', slug: 'geo-banff', label: '班芙', parent_id: 'ab-en', locale: 'zh', translation_group: 'gB' },
    { id: 'ab-en', name: 'destinations', slug: 'geo-ca-ab', label: 'Alberta', parent_id: 'ca-en', locale: 'en', translation_group: 'gAB' },
  ];
  const vocabulary = buildVocabulary(rows);
  const zh = Object.fromEntries(vocabulary.zh.destinations.map(term => [term.slug, term.parentId]));
  assert.equal(zh['geo-ca'], 'na-zh', 'a Chinese country hangs under the Chinese continent, not the English one');
  assert.equal(zh['geo-continent-na'], null);
  assert.equal(zh['geo-banff'], null, 'a parent that has no Chinese term leaves the term a root instead of pointing across languages');
  assert.equal(vocabulary.en.destinations.find(term => term.slug === 'geo-ca').parentId, 'na-en');
  assert.deepEqual(vocabulary.en.travel_styles, [], 'every taxonomy exists even when empty');
  assert.equal(vocabulary.zh.destinations[0].translationGroup, 'gNA');
});

test('a translation shares the assignments saved under its content group, and an own row is not duplicated',async()=>{
  const en = row('en-1', { translation_group: 'en-1' });
  const zh = row('zh-1', { locale: 'zh', translation_group: 'en-1' });
  const own = row('own', { translation_group: 'own-group' });
  const { db } = fakeDb({
    ec_tours: () => [en, zh, own],
    content_taxonomies: () => [{ entry_id: 'en-1', taxonomy_id: 'g1' }, { entry_id: 'own', taxonomy_id: 'g1' }, { entry_id: 'own-group', taxonomy_id: 'g1' }],
  });
  const vocabulary = {
    en: { destinations: [{ id: 'd-en', slug: 'geo-ca', label: 'Canada', locale: 'en', translationGroup: 'g1' }] },
    zh: { destinations: [{ id: 'd-zh', slug: 'geo-ca', label: '加拿大', locale: 'zh', translationGroup: 'g1' }] },
  };
  const slugs = {};
  for (const locale of ['en', 'zh']) for await (const page of createSqlTourSource({ getDatabase: async () => db, pageSize: 10 })(locale, vocabulary)) for (const entry of page) slugs[`${locale}:${entry.id}`] = (entry.data.terms.destinations || []).map(term => term.label);
  assert.deepEqual(slugs['en:en-1'], ['Canada']);
  assert.deepEqual(slugs['zh:zh-1'], ['加拿大'], 'the Chinese translation takes the group rows in its own language');
  assert.deepEqual(slugs['en:own'], ['Canada'], 'an entry and its group both pointing at the same term count once');
});

test('published reviews are read newest first, without deleted rows, from the reviews collection only',async()=>{
  const {db,calls}=fakeDb({ec_google_reviews:()=>[{id:'r1'}]});
  assert.deepEqual(await readPublishedReviewRows(db),[{id:'r1'}]);
  const steps=calls[0].steps;
  assert.equal(calls[0].table,'ec_google_reviews');
  assert.deepEqual(steps.find(s=>s[0]==='select')[1],[...REVIEW_COLUMNS]);
  assert.ok(steps.some(s=>s[0]==='where'&&s[1]==='status'&&s[3]==='published'));
  assert.ok(steps.some(s=>s[0]==='where'&&s[1]==='deleted_at'&&s[2]==='is'&&s[3]===null));
  assert.ok(steps.some(s=>s[0]==='orderBy'&&s[1]==='reviewed_at'&&s[2]==='desc'));
});

test('a review row becomes the legacy review the page components read',()=>{
  const now=Date.parse('2026-11-14T00:00:00Z');
  const row={id:'01X',source_id:'google-102894',author_name:'Jenny Wang',author_url:'https://g.example/u',rating:5,text:'Great',reviewed_at:'2026-10-14T00:00:00.000Z',profile_photo:'/reviews/avatars/102894.webp',profile_photo_source:'https://lh3.googleusercontent.com/a/x',local_guide:1,reviewer_reviews:6,reviewer_photos:4,images:'["https://lh3.example/p.jpg"]',source:'google'};
  const review=reviewRowToLegacy(row,0,now);
  assert.deepEqual(review,{id:102894,author_name:'Jenny Wang',author_url:'https://g.example/u',profile_photo_url:'/reviews/avatars/102894.webp',rating:5,text:'Great',time:String(Math.floor(Date.parse(row.reviewed_at)/1000)),relative_time_description:'a month ago',local_guide:true,reviewer_reviews:6,reviewer_photos:4,images:['https://lh3.example/p.jpg'],source:'google'});
  assert.equal(reviewRowToLegacy({...row,profile_photo:''},0,now).profile_photo_url,'https://lh3.googleusercontent.com/a/x','a self-hosted avatar wins, the remote one is the fallback');
  assert.equal(reviewRowToLegacy({...row,source_id:'abc',images:null,local_guide:0},3,now).id,1000003,'a review without a numeric source id still gets a stable id');
  assert.equal(reviewRowToLegacy({...row,images:null},0,now).images.length,0);
});

test('relative time uses Google wording',()=>{
  const now=Date.parse('2026-11-14T12:00:00Z'),ago=days=>new Date(now-days*86400000).toISOString();
  for(const [days,text] of [[0,'today'],[1,'yesterday'],[3,'3 days ago'],[7,'a week ago'],[15,'2 weeks ago'],[31,'a month ago'],[95,'3 months ago'],[400,'a year ago'],[800,'2 years ago']])
    assert.equal(relativeTimeDescription(ago(days),now),text,String(days));
  assert.equal(relativeTimeDescription('not a date',now),'');
});

test('term public text comes from its own table and never from the editors\' description', async () => {
  const { buildVocabulary, readTermPublicText } = await import('../src/lib/cms/native-site-sql.mjs');
  const rows = [
    { id: 'a', name: 'destinations', slug: 'geo-ca-nt', label: 'NT', parent_id: null, locale: 'en', translation_group: null, data: '{"description":"notes"}' },
    { id: 'b', name: 'destinations', slug: 'geo-ca-nt', label: '西北', parent_id: null, locale: 'zh', translation_group: null },
  ];
  const texts = [{ taxonomy: 'destinations', slug: 'geo-ca-nt', locale: 'en', intro: ' Hello \n\nWorld ', promo: '5% off' }, { taxonomy: 'destinations', slug: 'x', locale: 'en', intro: 'unused' }];
  const vocabulary = buildVocabulary(rows, texts);
  assert.deepEqual([vocabulary.en.destinations[0].intro, vocabulary.en.destinations[0].promo], ['Hello \n\nWorld', '5% off']);
  assert.equal(vocabulary.zh.destinations[0].intro, undefined);
  assert.equal(JSON.stringify(vocabulary).includes('notes'), false);
  assert.equal(buildVocabulary(rows).en.destinations[0].intro, undefined);
  assert.equal(buildVocabulary(rows, [{ ...texts[0], intro: 'x'.repeat(9000) }]).en.destinations[0].intro.length, 4000);
  // A database without the table (or one that fails) reads as no text instead of breaking the catalogue.
  assert.deepEqual(await readTermPublicText({ selectFrom() { throw new Error('no such table: term_public_text'); } }), []);
});
