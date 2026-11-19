import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('tour detail opens with a plain white title section and no hero image', async () => {
  const [detail, css] = await Promise.all([
    source('src/components/TourPage.astro'),
    source('src/styles/global.css'),
  ]);
  const header = detail.match(/<header\b[\s\S]*?<\/header>/)?.[0];
  assert.ok(header, 'title section is a <header>');
  assert.match(header, /bg-white/);
  assert.match(header, /<h1\b/);
  assert.doesNotMatch(header, /<(?:img|figure)\b|bg-gradient|from-gray-950/);
  assert.doesNotMatch(detail, /page-hero|tour-hero-cover|optimizedHero/);
  assert.doesNotMatch(css, /tour-hero-cover/);
});

test('the homepage renders separate full-bleed backgrounds over the shared hero height', async () => {
  const [home, featured, pageHero, css] = await Promise.all([
    source('src/pages/[...lang]/index.astro'),
    source('src/components/FeaturedToursHero.tsx'),
    source('src/components/PageHero.astro'),
    source('src/styles/global.css'),
  ]);
  assert.match(home, /home-hero-backgrounds\.json/);
  assert.match(home, /heroImage=\{heroTours\[0\]\?\.homeHeroBackground\?\.src\}/);
  assert.match(featured, /src=\{background\.src\}[\s\S]*?object-cover/);
  assert.doesNotMatch(featured, /tour\.optimizedHero|featured_image_url|tour-hero-cover/);
  assert.match(pageHero, /class="page-hero /);
  assert.match(css, /--site-hero-min-height:\s*60vh/);
});

test('the homepage carousel starts automatically and honors reduced motion', async () => {
  const hero = await source('src/components/FeaturedToursHero.tsx');
  assert.match(hero, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(hero, /setIsPlaying\(!motion\.matches\)/);
  assert.match(hero, /!isPlaying \|\| isModalOpen \|\| isPointerOver/);
});

test('the homepage uses the same cover card as the tour categories', async () => {
  const [home, category, card] = await Promise.all([
    source('src/components/HomeTourGroups.astro'),
    source('src/components/TourCategoryPage.astro'),
    source('src/components/TourCardOptimized.astro'),
  ]);
  assert.match(home, /<TourCardOptimized tour=\{tour\} lang=\{lang\} headingTag="h4"\s*\/>/);
  assert.match(category, /<TourCardOptimized tour=\{tour\} lang=\{lang\}\s*\/>/);
  assert.match(card, /object-cover/);
  assert.doesNotMatch(card, /object-contain/);
});

test('tour enquiry opens a named native dialog and synchronizes native dismissal', async () => {
  const modal = await source('src/components/TourInquiryModal.tsx');
  assert.ok(/<dialog\b[\s\S]*?aria-labelledby=\{titleId\}/.test(modal));
  assert.ok(modal.includes('dialog.showModal()'));
  assert.ok(modal.includes('onCancel='));
  assert.ok(modal.includes('trigger?.focus'));
});

test('mobile enquiry already links to the in-page form before the dialog can hydrate', async () => {
  const [cta, sidebar] = await Promise.all([
    source('src/components/MobileInquiryCTA.tsx'),
    source('src/components/TourSidebarForm.tsx'),
  ]);
  assert.match(cta, /<a\b[^>]*href="#tour-enquiry"/);
  assert.match(sidebar, /<h3\b[^>]*id="tour-enquiry"[^>]*tabIndex=\{-1\}/);
});

test('tour dialogs retain the opener even when clicking does not focus it', async () => {
  const [cta, featured, detail, modal, gallery] = await Promise.all([
    source('src/components/MobileInquiryCTA.tsx'),
    source('src/components/FeaturedToursHero.tsx'),
    source('src/components/TourDetail.tsx'),
    source('src/components/TourInquiryModal.tsx'),
    source('src/components/PhotoLightbox.tsx'),
  ]);
  assert.match(cta, /returnFocusTo=\{triggerRef\.current\}/);
  assert.match(featured, /triggerRef\.current = event\.currentTarget/);
  assert.match(detail, /trigger: event\.currentTarget/);
  assert.match(detail, /returnFocusTo=\{lightbox\.trigger\}/);
  assert.match(modal, /const trigger = returnFocusTo/);
  assert.match(gallery, /const trigger = returnFocusTo/);
});

test('tour enquiry uses a full-width calendar instead of the browser date input', async () => {
  const form = await source('src/components/forms/TourInquiryForm.tsx');
  assert.doesNotMatch(form, /type="date"|showPicker\(/);
  assert.match(form, /<ServiceCalendar\b[\s\S]*?min=\{today\}/);
  assert.match(form, /type="hidden" name="travelDate" value=\{formData\.travelDate\}/);
  assert.match(form, /aria-expanded=\{calendarOpen\}/);
});
