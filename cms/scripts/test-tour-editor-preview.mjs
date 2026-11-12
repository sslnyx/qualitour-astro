import assert from 'node:assert/strict';
import test from 'node:test';
import { previewRevision, previewDayRefs, parsePreviewRequest, matchesPreviewAck } from '../src/lib/cms/preview-focus.ts';

const request = { type: 'qualitour:preview-focus', requestId: 'request-2', entryId: 'tour-a', locale: 'zh', revision: 'draft-2', section: 'itinerary', day: { field: 'itinerary_continued', key: 'same' } };
test('preview revision identifies the saved draft rather than the live revision', () => {
  assert.equal(previewRevision({ draftRevisionId: 'draft-2', liveRevisionId: 'live-1' }), 'draft-2');
  assert.equal(previewRevision({ draftRevisionId: null, liveRevisionId: 'live-1' }), 'live-1');
  assert.equal(previewRevision({}), null);
});
test('preview focus preserves separate identities for the same day key across both arrays', () => {
  assert.deepEqual(previewDayRefs({ itinerary: [{ _key: 'same' }], itinerary_continued: [{ _key: 'same' }] }), [{ field: 'itinerary', key: 'same' }, { field: 'itinerary_continued', key: 'same' }]);
  assert.deepEqual(previewDayRefs({ itinerary: [{ title: 'invalid' }, { _key: 'valid' }] }), [null, { field: 'itinerary', key: 'valid' }]);
});
test('focus messages require a valid identity, locale, section and day reference', () => {
  assert.deepEqual(parsePreviewRequest(request), request);
  for (const patch of [{ locale: 'fr' }, { section: 'admin' }, { requestId: '' }, { entryId: null }, { revision: '' }, { day: { field: '__proto__', key: 'same' } }]) assert.equal(parsePreviewRequest({ ...request, ...patch }), null);
  assert.equal(parsePreviewRequest(null), null);
});
test('only the acknowledged latest saved revision and exact selected day count as a current preview', () => {
  const ack = { ...request, type: 'qualitour:preview-ready', isPreview: true, dayFound: true };
  assert.equal(matchesPreviewAck(ack, request), true);
  for (const patch of [{ requestId: 'request-1' }, { revision: 'draft-1' }, { entryId: 'tour-b' }, { locale: 'en' }, { isPreview: false }, { dayFound: false }, { day: { field: 'itinerary', key: 'same' } }]) assert.equal(matchesPreviewAck({ ...ack, ...patch }, request), false);
  assert.equal(matchesPreviewAck({ ...ack, section: 'overview' }, request), false);
});
test('basic information preview can target the shared hero instead of hiding title and price',()=>{
 const hero={...request,section:'hero'};delete hero.day;
 assert.deepEqual(parsePreviewRequest(hero),hero);
 assert.equal(matchesPreviewAck({...hero,type:'qualitour:preview-ready',isPreview:true},hero),true);
});
