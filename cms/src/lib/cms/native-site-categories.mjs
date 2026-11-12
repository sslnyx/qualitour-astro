/**
 * Public categories for the native site: travel styles (+ cruise types under
 * Cruises), a destination tree and travel regions, read straight from the CMS
 * taxonomies. Nothing here maps back to the retired WordPress facets.
 *
 * Tours are tagged at the most specific place (usually a city), so a tour is
 * "in" every ancestor of each assigned destination. That path is exposed as
 * `tour_terms.destinationScope` so pages and filters never re-walk the tree.
 */
const string = value => typeof value === 'string' ? value.trim() : '';
const termLabel = term => string(term?.label) || string(term?.name);
const parentOf = term => string(term?.parentId ?? term?.parent_id);

function publicTerm(term) {
  const id = string(term?.id), slug = string(term?.slug), name = termLabel(term);
  if (!id || !slug || !name) throw new Error('Invalid assigned CMS taxonomy term');
  return { id, slug, name };
}

function indexVocabulary(rows) {
  const byId = new Map(), bySlug = new Map();
  for (const term of Array.isArray(rows) ? rows : []) {
    const id = string(term?.id), slug = string(term?.slug);
    if (id) byId.set(id, term);
    if (slug) bySlug.set(slug, term);
  }
  return { byId, bySlug };
}

function assigned(entry, name, index) {
  const rows = entry?.data?.terms?.[name];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) throw new Error(`Invalid ${name} assignment list for CMS entry ${entry?.id}`);
  const seen = new Set();
  return rows.flatMap(row => {
    const known = index.byId.get(string(row?.id)) || index.bySlug.get(string(row?.slug));
    const term = publicTerm(known ? { ...row, ...known } : row);
    if (seen.has(term.slug)) return [];
    seen.add(term.slug);
    return [term];
  });
}

/** Slugs of a destination and all of its ancestors, most specific first. */
function destinationPath(term, index) {
  const path = [], seen = new Set();
  for (let current = term; current && !seen.has(string(current.id)); current = index.byId.get(parentOf(current))) {
    seen.add(string(current.id));
    path.push(string(current.slug));
  }
  return path;
}

const byLabel = locale => (a, b) => a.name.localeCompare(b.name, locale === 'zh' ? 'zh-Hant' : 'en');

/**
 * Replaces tour_terms/terms on a built catalogue. `tourIdFor(entry)` returns the
 * catalogue tour id for a CMS entry (legacy numeric ID for imports).
 */
export function applyNativeCategories({ catalogue, entries, vocabulary, locale, tourIdFor }) {
  const index = {
    destinations: indexVocabulary(vocabulary?.destinations),
    styles: indexVocabulary(vocabulary?.travel_styles),
    cruiseTypes: indexVocabulary(vocabulary?.cruise_types),
    regions: indexVocabulary(vocabulary?.travel_regions),
  };
  const toursById = new Map(catalogue.tours.map(tour => [String(tour.id), tour]));
  const counts = { destinations: new Map(), styles: new Map(), cruiseTypes: new Map(), regions: new Map() };
  const used = { destinations: new Map(), styles: new Map(), cruiseTypes: new Map(), regions: new Map() };

  for (const entry of entries) {
    const tour = toursById.get(String(tourIdFor(entry)));
    if (!tour) continue;
    const rows = {
      destinations: assigned(entry, 'destinations', index.destinations),
      styles: assigned(entry, 'travel_styles', index.styles),
      cruiseTypes: assigned(entry, 'cruise_types', index.cruiseTypes),
      regions: assigned(entry, 'travel_regions', index.regions),
    };
    const scope = new Set();
    for (const row of rows.destinations) {
      const term = index.destinations.bySlug.get(row.slug);
      for (const slug of term ? destinationPath(term, index.destinations) : [row.slug]) scope.add(slug);
    }
    tour.tour_terms = { ...rows, destinationScope: [...scope] };
    for (const bucket of ['styles', 'cruiseTypes', 'regions'])
      for (const row of rows[bucket]) { used[bucket].set(row.slug, row); counts[bucket].set(row.slug, (counts[bucket].get(row.slug) || 0) + 1); }
    for (const slug of scope) counts.destinations.set(slug, (counts.destinations.get(slug) || 0) + 1);
  }

  const destinations = [];
  for (const [slug, count] of counts.destinations) {
    const term = index.destinations.bySlug.get(slug);
    if (!term) continue;
    const parent = index.destinations.byId.get(parentOf(term));
    destinations.push({
      id: string(term.id), slug, name: termLabel(term), parent: parent ? string(parent.id) : 0,
      parentSlug: parent ? string(parent.slug) : null, level: destinationPath(term, index.destinations).length, count,
    });
  }
  destinations.sort(byLabel(locale));
  const flat = bucket => [...used[bucket].values()].map(row => ({ ...row, parent: 0, count: counts[bucket].get(row.slug) || 0 }));
  // Styles keep the editor's vocabulary order (a deliberate menu order), not alphabetical.
  const styles = (vocabulary?.travel_styles || []).flatMap(term => {
    const slug = string(term?.slug);
    return slug && counts.styles.has(slug) ? [{ id: string(term.id), slug, name: termLabel(term), parent: 0, count: counts.styles.get(slug) }] : [];
  });
  catalogue.terms = {
    styles,
    cruiseTypes: flat('cruiseTypes').sort(byLabel(locale)),
    regions: flat('regions').sort(byLabel(locale)),
    destinations,
  };
  return catalogue;
}

/** Hierarchy helpers shared by menus and category pages. */
export function destinationChildren(destinations, parent) {
  return destinations.filter(term => String(term.parent) === String(parent));
}
