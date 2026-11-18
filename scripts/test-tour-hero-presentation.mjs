import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('featured and detail heroes contain artwork without a cropped derivative', async () => {
  const [detail, featured, css] = await Promise.all([
    source('src/components/TourPage.astro'),
    source('src/components/FeaturedToursHero.tsx'),
    source('src/styles/global.css'),
  ]);
  for (const hero of [detail, featured]) {
    assert.match(hero, /tour-hero-cover/);
    assert.doesNotMatch(hero, /\bobject-cover\b/);
    assert.doesNotMatch(hero, /width:\s*1920,\s*height:\s*1080/);
  }
  assert.doesNotMatch(featured, /tour\.optimizedImageUrl/);
  assert.match(css, /\.tour-hero-cover\s*\{[^}]*object-fit:\s*contain/);
});

test('the detail hero displays the cover without a separate image action', async () => {
  const detail = await source('src/components/TourPage.astro');
  const cover = detail.match(/<figure\b[^>]*>[\s\S]*?<\/figure>/)?.[0];
  assert.ok(cover?.includes('tour-hero-cover'));
  assert.equal(/<(?:a|button|figcaption)\b/.test(cover), false);
  assert.equal(/查看原圖|View full cover image/.test(detail), false);
});

test('tour enquiry opens a named native dialog and synchronizes native dismissal', async () => {
  const modal = await source('src/components/TourInquiryModal.tsx');
  assert.ok(/<dialog\b[\s\S]*?aria-labelledby=\{titleId\}/.test(modal));
  assert.ok(modal.includes('dialog.showModal()'));
  assert.ok(modal.includes('onCancel='));
  assert.ok(modal.includes('trigger?.focus'));
});
