import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL('../' + path, import.meta.url), 'utf8');

test('tour detail opens with a photo collage and a single banner when there is one photo', async () => {
  const [page, gallery] = await Promise.all([
    source('src/components/TourPage.astro'),
    source('src/components/TourGallery.tsx'),
  ]);
  assert.match(page, /<TourGallery\b[^>]*client:load[^>]*photos=\{galleryPhotos\}/);
  assert.doesNotMatch(page, /tour-hero-cover/);
  // 1 photo: banner (a poster/portrait is shown whole on a blurred backdrop); 2, 3-4 and 5+ photos: collage layouts.
  assert.match(gallery, /photos\.length === 1/);
  assert.match(gallery, /object-contain/);
  assert.match(gallery, /count === 2/);
  assert.match(gallery, /count < 5/);
  assert.match(gallery, /grid-cols-4 grid-rows-2/);
  assert.match(gallery, /snap-x snap-mandatory/);
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
  const [cta, featured, detail, modal, lightbox] = await Promise.all([
    source('src/components/MobileInquiryCTA.tsx'),
    source('src/components/FeaturedToursHero.tsx'),
    source('src/components/TourGallery.tsx'),
    source('src/components/TourInquiryModal.tsx'),
    source('src/components/PhotoLightbox.tsx'),
  ]);
  assert.match(cta, /returnFocusTo=\{triggerRef\.current\}/);
  assert.match(featured, /triggerRef\.current = event\.currentTarget/);
  assert.match(detail, /trigger: event\.currentTarget/);
  assert.match(detail, /returnFocusTo=\{lightbox\.trigger\}/);
  assert.match(modal, /const trigger = returnFocusTo/);
  assert.match(lightbox, /const trigger = returnFocusTo/);
});

test('tour enquiry uses a full-width calendar instead of the browser date input', async () => {
  const form = await source('src/components/forms/TourInquiryForm.tsx');
  assert.doesNotMatch(form, /type="date"|showPicker\(/);
  assert.match(form, /<ServiceCalendar\b[\s\S]*?min=\{today\}/);
  assert.match(form, /type="hidden" name="travelDate" value=\{formData\.travelDate\}/);
  assert.match(form, /aria-expanded=\{calendarOpen\}/);
});
