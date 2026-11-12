import assert from 'node:assert/strict';
import test from 'node:test';
import { projectNativeSiteTaxonomy } from '../src/lib/cms/native-site-taxonomy.mjs';

const legacyTerms = {
  destinations: [
    { id: 10, slug: 'asia', name: 'Asia', parent: 0 },
    { id: 11, slug: 'canada', name: 'Canada', parent: 0 },
    { id: 12, slug: 'banff', name: 'Banff', parent: 11 },
  ],
  types: [],
};
const taxonomyNames = ['destinations', 'travel_styles', 'travel_regions', 'cruise_types'];
const baseline = {
  schema: 1,
  taxonomies: taxonomyNames,
  entries: {
    'wp-en-12': {
      destinations: [{ group: 'country-cn', slug: 'geo-cn' }],
      travel_styles: [],
      travel_regions: [],
      cruise_types: [],
    },
  },
  terms: [
    { id: 'continent-as-row', name: 'destinations', slug: 'geo-continent-as', label: 'Asia', parent_id: null, locale: 'en', translation_group: 'continent-as' },
    { id: 'country-cn-row', name: 'destinations', slug: 'geo-cn', label: 'China', parent_id: 'continent-as', locale: 'en', translation_group: 'country-cn' },
    { id: 'rockies-row', name: 'travel_regions', slug: 'area-canadian-rockies', label: 'Canadian Rockies', parent_id: null, locale: 'en', translation_group: 'region-rockies' },
  ],
};
const cmsTerm = (name, slug, label, group, parentId) => ({
  id: `${group}-row`, name, slug, label, parentId, locale: 'en', translationGroup: group, children: [],
});
const imported = terms => ({
  id: 'cms-12', locale: 'en', status: 'published',
  data: { source_key: 'wp-en-12', terms },
});
const native = terms => ({
  id: 'native-1', locale: 'en', status: 'published', data: { terms },
});
const project = (entries, options = {}) => projectNativeSiteTaxonomy({
  entries,
  locale: 'en',
  source: { terms: legacyTerms },
  baseline,
  taxonomyTerms: Object.fromEntries(taxonomyNames.map(name => [name, []])),
  ...options,
});

test('unchanged imported CMS assignments preserve every frozen legacy facet', () => {
  const result = project([imported({
    destinations: [cmsTerm('destinations', 'geo-cn', 'China', 'country-cn', 'continent-as')],
  })]);

  assert.equal(result.overrides.has('cms-12'), false);
  assert.deepEqual(result.taxonomyTerms, { destinations: [], types: [] });
});

test('an imported assignment changed to empty explicitly clears its visitor bucket', () => {
  const result = project([imported({})]);

  assert.deepEqual(result.overrides.get('cms-12'), { destinations: [] });
});

test('a changed imported China assignment walks its stable ancestor to frozen Asia', () => {
  const changedBaseline = structuredClone(baseline);
  changedBaseline.entries['wp-en-12'].destinations = [];
  const result = project([imported({
    destinations: [cmsTerm('destinations', 'geo-cn', 'China', 'country-cn', 'continent-as')],
  })], { baseline: changedBaseline });

  assert.deepEqual(result.overrides.get('cms-12'), {
    destinations: [{ id: 10, slug: 'asia', name: 'Asia' }],
  });
  assert.deepEqual(result.taxonomyTerms.destinations, []);
});

test('Canadian Rockies is the only approved region alias for frozen Banff', () => {
  const result = project([imported({
    destinations: [cmsTerm('destinations', 'geo-cn', 'China', 'country-cn', 'continent-as')],
    travel_regions: [cmsTerm('travel_regions', 'area-canadian-rockies', 'Canadian Rockies', 'region-rockies')],
  })]);

  assert.deepEqual(result.overrides.get('cms-12'), {
    destinations: [{ id: 10, slug: 'asia', name: 'Asia' }, { id: 12, slug: 'banff', name: 'Banff' }],
  });
});

test('native tours project only assigned terms and keep safe unknown selectors literal', () => {
  const newPlace = cmsTerm('destinations', 'geo-new-place', 'New Place', 'new-place', null);
  const unused = cmsTerm('destinations', 'geo-unused', 'Unused', 'unused', null);
  const style = cmsTerm('travel_styles', 'rail-journeys', 'Rail Journeys', 'style-rail', null);
  const result = project([native({ destinations: [newPlace], travel_styles: [style] })], {
    taxonomyTerms: {
      destinations: [newPlace, unused], travel_styles: [style], travel_regions: [], cruise_types: [],
    },
  });

  assert.deepEqual(result.overrides.get('native-1'), {
    destinations: [{ id: 'new-place-row', slug: 'geo-new-place', name: 'New Place' }],
    types: [{ id: 'style-rail-row', slug: 'rail-journeys', name: 'Rail Journeys' }],
  });
  assert.deepEqual(result.taxonomyTerms.destinations, [{ id: 'new-place-row', slug: 'geo-new-place', name: 'New Place' }]);
  assert.equal(result.taxonomyTerms.destinations.some(term => term.slug === 'geo-unused'), false);
});

test('imported entries missing the immutable assignment baseline fail closed', () => {
  const missing = structuredClone(baseline);
  delete missing.entries['wp-en-12'];
  assert.throws(() => project([imported({})], { baseline: missing }), /taxonomy baseline.*wp-en-12/i);
});

test('malformed baselines cannot turn a missing query result into an explicit clear', () => {
  const malformed = structuredClone(baseline);
  delete malformed.entries['wp-en-12'].travel_regions;
  assert.throws(() => project([imported({})], { baseline: malformed }), /travel_regions/);
  assert.throws(() => project([native({})], { taxonomyTerms: { destinations: [], travel_styles: [], travel_regions: [] } }), /cruise_types/);
});
