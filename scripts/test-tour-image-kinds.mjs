import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const kinds = JSON.parse(await readFile(new URL('../src/data/tour-image-kinds.json', import.meta.url), 'utf8'));
const id = /^m-[0-9a-f]{16}$/;

test('tour image kinds list only well-formed media ids', () => {
  assert.equal(kinds.version, 2);
  for (const graphic of kinds.graphics) assert.match(graphic, id);
  for (const ident of Object.values(kinds.refs)) assert.match(ident, id);
  for (const [duplicate, canonical] of Object.entries(kinds.canonical)) {
    assert.match(duplicate, id);
    assert.match(canonical, id);
  }
});

test('every duplicate points at a canonical id that is not itself a duplicate', () => {
  for (const canonical of Object.values(kinds.canonical)) assert.equal(canonical in kinds.canonical, false);
});

test('text pictures are canonical ids, so a duplicate of one is filtered too', () => {
  for (const graphic of kinds.graphics) assert.equal(graphic in kinds.canonical, false);
});

test('the tour page builds its gallery from distinct, non-text pictures', async () => {
  const page = await readFile(new URL('../src/components/TourPage.astro', import.meta.url), 'utf8');
  assert.match(page, /tour-image-kinds\.json/);
  assert.match(page, /seenPictures\.has\(picture\)/);
  assert.match(page, /textPictures\.has\(picture\)/);
  assert.match(page, /whole: true/);
});
