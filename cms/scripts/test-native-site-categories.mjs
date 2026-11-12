import assert from 'node:assert/strict';
import test from 'node:test';
import { applyNativeCategories } from '../src/lib/cms/native-site-categories.mjs';

const term = (id, slug, label, parentId = null) => ({ id, slug, label, name: 'x', parentId });
const vocabulary = {
  destinations: [
    term('as', 'geo-continent-as', 'Asia'), term('na', 'geo-continent-na', 'North America'),
    term('ca', 'geo-ca', 'Canada', 'na'), term('ab', 'geo-ca-ab', 'Alberta', 'ca'), term('banff', 'geo-banff', 'Banff', 'ab'),
    term('bc', 'geo-ca-bc', 'British Columbia', 'ca'), term('van', 'geo-vancouver', 'Vancouver', 'bc'),
    term('jp', 'geo-jp', 'Japan', 'as'), term('unused', 'geo-unused', 'Unused', 'as'),
  ],
  travel_styles: [term('s1', 'day-tours', 'Day Tours'), term('s2', 'multi-day-tours', 'Multi-day'), term('s3', 'cruises', 'Cruises')],
  cruise_types: [term('c1', 'river', 'River Cruises'), term('c2', 'ocean', 'Ocean Cruises')],
  travel_regions: [term('r1', 'area-canadian-rockies', 'Canadian Rockies'), term('r2', 'area-danube', 'Danube')],
};
const entry = (id, terms) => ({ id: `e${id}`, data: { terms } });
const build = (entries, locale = 'en') => {
  const catalogue = { tours: entries.map(e => ({ id: e.id, tour_terms: { legacy: true } })), terms: { legacy: [] } };
  return applyNativeCategories({ catalogue, entries, vocabulary, locale, tourIdFor: e => e.id });
};

test('a tour is in every ancestor of its city and counts roll up once per tour', () => {
  const result = build([
    entry(1, { destinations: [{ id: 'banff' }, { id: 'van' }], travel_styles: [{ id: 's2' }] }),
    entry(2, { destinations: [{ id: 'jp' }], travel_styles: [{ id: 's1' }, { id: 's2' }] }),
  ]);
  assert.deepEqual(result.tours[0].tour_terms.destinationScope.sort(),
    ['geo-banff', 'geo-ca', 'geo-ca-ab', 'geo-ca-bc', 'geo-continent-na', 'geo-vancouver']);
  const counts = Object.fromEntries(result.terms.destinations.map(t => [t.slug, t.count]));
  assert.equal(counts['geo-ca'], 1, 'two Canadian cities on one tour are one tour');
  assert.equal(counts['geo-continent-na'], 1);
  assert.equal(counts['geo-jp'], 1);
  assert.equal('geo-unused' in counts, false, 'unused terms never produce a page or link');
  assert.equal('legacy' in result.tours[0].tour_terms, false, 'legacy facets are gone');
  assert.equal('legacy' in result.terms, false);
});

test('destination terms expose parent links and level for menus', () => {
  const { terms } = build([entry(1, { destinations: [{ id: 'banff' }] })]);
  const ca = terms.destinations.find(t => t.slug === 'geo-ca');
  assert.deepEqual({ parent: ca.parent, parentSlug: ca.parentSlug, level: ca.level }, { parent: 'na', parentSlug: 'geo-continent-na', level: 2 });
  const continent = terms.destinations.find(t => t.slug === 'geo-continent-na');
  assert.deepEqual({ parent: continent.parent, parentSlug: continent.parentSlug, level: continent.level }, { parent: 0, parentSlug: null, level: 1 });
});

test('styles keep editor order; cruise types and regions list only used terms', () => {
  const { terms } = build([
    entry(1, { travel_styles: [{ id: 's3' }, { id: 's1' }], cruise_types: [{ id: 'c1' }], travel_regions: [{ id: 'r1' }] }),
  ]);
  assert.deepEqual(terms.styles.map(t => t.slug), ['day-tours', 'cruises']);
  assert.deepEqual(terms.cruiseTypes.map(t => t.slug), ['river']);
  assert.deepEqual(terms.regions.map(t => t.slug), ['area-canadian-rockies']);
});

test('invalid assignment lists fail loudly instead of publishing partial categories', () => {
  assert.throws(() => build([entry(1, { destinations: 'banff' })]), /Invalid destinations assignment list/);
  assert.throws(() => build([entry(1, { destinations: [{ id: '', slug: '', label: '' }] })]), /Invalid assigned CMS taxonomy term/);
});
