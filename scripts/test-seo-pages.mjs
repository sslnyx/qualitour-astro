import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageAlternates, confirmedTourAlternates, tourStructuredData } from '../src/lib/seo-pages.ts';
import { deploymentConfig } from '../src/lib/site-config.ts';

test('staging and production cannot share indexing/base settings', () => {
    assert.deepEqual([deploymentConfig().base, deploymentConfig().indexable], ['/staging', false]);
    assert.deepEqual([deploymentConfig('production').base, deploymentConfig('production').indexable], ['/', true]);
    assert.throws(() => deploymentConfig('prodution'));
});
test('only known paired pages get alternates; staging base remains once', () => {
    const alternates = pageAlternates('/staging/zh/contact.html', 'https://qualitour.ca', '/staging');
    assert.equal(alternates[0].href, 'https://qualitour.ca/staging/contact');
    assert.equal(alternates[1].href, 'https://qualitour.ca/staging/zh/contact');
    assert.deepEqual(pageAlternates('/staging/tours/english-slug.html', 'https://qualitour.ca', '/staging'), []);
});
test('translation links require published matching IDs/slugs and reciprocal mapping', () => {
    const en = { id: 1, slug: 'one', translations: { zh: { id: 2, slug: '%E4%B8%AD' } } };
    const zh = { id: 2, slug: '中', translations: { en: { id: 1, slug: 'one' } } };
    assert.equal(confirmedTourAlternates(en, 'en', { en: [en], zh: [zh] }, 'https://qualitour.ca', '/staging').length, 3);
    assert.deepEqual(confirmedTourAlternates(en, 'en', { en: [en], zh: [{ ...zh, translations: {} }] }, 'https://qualitour.ca', '/staging'), []);
    assert.deepEqual(confirmedTourAlternates(en, 'en', { en: [en], zh: [] }, 'https://qualitour.ca', '/staging'), []);
});
test('trip schema never invents ratings, prices or offers', () => {
    const schema = tourStructuredData({ slug: 'one', title: { rendered: 'One &amp; Two' } }, 'https://qualitour.ca', '/', 'en');
    assert.equal(schema[0].name, 'One & Two');
    assert.equal(schema[0].url, 'https://qualitour.ca/tours/one');
    assert.equal(schema[1].itemListElement.length, 3);
    assert.equal('aggregateRating' in schema[0], false);
    assert.equal('offers' in schema[0], false);
});

test('home alternate uses canonical trailing slash only for the staging root', () => {
    assert.equal(pageAlternates('/staging/index.html', 'https://qualitour.ca', '/staging')[0].href, 'https://qualitour.ca/staging/');
    assert.equal(pageAlternates('/index.html', 'https://qualitour.ca', '/')[0].href, 'https://qualitour.ca/');
});
