import assert from 'node:assert/strict';
import test from 'node:test';
import { buildEntryData, selectCandidates, sniffMime } from './import-nonpublic-tours.mjs';

const rec = (id, status) => ({ post: { ID: id, post_status: status }, decoded_meta: { 'tourmaster-tour-code': ['T' + id] } });

test('only draft, pending and private tours that are not theme demos are candidates', () => {
  const records = [rec(1, 'publish'), rec(2, 'draft'), rec(3, 'pending'), rec(4, 'private'), rec(5, 'trash'), rec(6, 'auto-draft'), rec(7, 'draft')];
  const picked = selectCandidates(records, 'en', new Set(['en:7'])).map(r => r.post.ID);
  assert.deepEqual(picked, [2, 3, 4]);
  assert.deepEqual(selectCandidates([rec(7, 'draft')], 'zh', new Set(['en:7'])).map(r => r.post.ID), [7]); // demo ids are per locale
});

test('entry data splits long itineraries, keeps source identity, and maps media ids', () => {
  const days = Array.from({ length: 130 }, (_, i) => ({ day: i }));
  const source = { key: 'wp-en-2', record: rec(2, 'draft'), mapped: { data: { title: 'T', itinerary: days, faq: [{ q: 'a' }] } } };
  const asset = { sha256: 'x' };
  const refs = { hero: asset, brochure: null, gallery: [{ asset: { sha256: 'x' }, alt: 'a', caption: 'c' }, { asset: { sha256: 'missing' }, alt: '', caption: '' }] };
  const data = buildEntryData(source, refs, a => a?.sha256 === 'x' ? { id: 'media-1' } : null);
  assert.equal(data.itinerary.length, 100);
  assert.equal(data.itinerary_continued.length, 30);
  assert.equal(data.source_key, 'wp-en-2');
  assert.equal(data.source_status, 'draft');
  assert.equal(data.tour_code, 'T2');
  assert.equal(data.hero, 'media-1');
  assert.equal(data.brochure, undefined);
  assert.deepEqual(data.gallery, [{ image: 'media-1', alt: 'a', caption: 'c' }]);
  assert.equal(data.faq[0]._type, 'question');
});

test('sniffMime recognises safe public media and rejects everything else', () => {
  assert.equal(sniffMime(Buffer.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(sniffMime(Buffer.from('%PDF-1.7 ......')), 'application/pdf');
  assert.equal(sniffMime(Buffer.from('<?php echo 1; ?>....')), null);
});
