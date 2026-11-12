const TAXONOMIES = ['destinations', 'travel_styles', 'travel_regions', 'cruise_types'];

// Deliberate visitor-facet compatibility aliases, not geographic inference.
// A mapped slug is used only when it exists in the frozen locale vocabulary.
const LEGACY_SLUG_ALIASES = new Map([
  ['geo-ca', 'canada'],
  ['geo-us', 'usa'],
  ['geo-tr', 'turkey'],
  ['geo-asia', 'asia'],
  ['geo-continent-as', 'asia'],
  ['geo-africa', 'africa'],
  ['geo-continent-af', 'africa'],
  ['geo-whitehorse', 'whitehorse'],
  ['geo-yellowknife', 'yellowknife'],
  ['geo-banff', 'banff'],
  ['geo-victoria', 'victoria'],
  ['geo-us-ak', 'alaska'],
  ['area-canadian-rockies', 'banff'],
]);

const string = value => typeof value === 'string' ? value.trim() : '';
const termGroup = term => string(term?.translationGroup ?? term?.translation_group ?? term?.group ?? term?.id);
const termParent = term => string(term?.parentId ?? term?.parent_id);

function assignmentGroups(rows, label) {
  if (!Array.isArray(rows)) throw new Error(`Invalid taxonomy assignment list for ${label}`);
  const groups = rows.map(termGroup);
  if (groups.some(group => !group)) throw new Error(`Missing taxonomy assignment group for ${label}`);
  return [...new Set(groups)].sort();
}

function sameAssignments(current, captured, label) {
  const left = assignmentGroups(current, label);
  const right = assignmentGroups(captured, `baseline ${label}`);
  return left.length === right.length && left.every((group, index) => group === right[index]);
}

function validateBaseline(baseline) {
  if (baseline?.schema !== 1 || !baseline.entries || typeof baseline.entries !== 'object') {
    throw new Error('Invalid native taxonomy baseline');
  }
  for (const name of TAXONOMIES) {
    if (!baseline.taxonomies?.includes(name)) throw new Error(`Native taxonomy baseline is missing ${name}`);
  }
  if (!Array.isArray(baseline.terms)) throw new Error('Native taxonomy baseline is missing terms');
}

function validateVocabulary(taxonomyTerms) {
  for (const name of TAXONOMIES) {
    if (!Array.isArray(taxonomyTerms?.[name])) throw new Error(`Current taxonomy query is missing ${name}`);
  }
}

function publicTerm(term) {
  const id = string(term?.id), slug = string(term?.slug), name = string(term?.label ?? term?.name);
  if (!id || !slug || !name) throw new Error('Invalid assigned CMS taxonomy term');
  const translations = term?.translations && typeof term.translations === 'object'
    ? Object.fromEntries(Object.entries(term.translations).filter(([, value]) => string(value)).map(([key, value]) => [key, string(value)]))
    : undefined;
  return { id, slug, name, ...(translations && Object.keys(translations).length ? { translations } : {}) };
}

function createResolver({ locale, source, baseline, taxonomyTerms }) {
  const catalog = new Map();
  for (const term of [...baseline.terms, ...TAXONOMIES.flatMap(name => taxonomyTerms[name])]) {
    if (term?.locale !== locale) continue;
    const group = termGroup(term);
    if (group) catalog.set(group, term);
  }

  const resolve = (selected, bucket) => {
    const legacy = source.terms?.[bucket] || [];
    const bySlug = new Map(legacy.map(term => [term.slug, term]));
    let current = selected;
    const visited = new Set();
    while (current) {
      const group = termGroup(current);
      if (group && visited.has(group)) throw new Error(`Cyclic CMS taxonomy ancestry at ${group}`);
      if (group) visited.add(group);
      const slug = string(current.slug);
      const exact = bySlug.get(slug);
      if (exact) return { term: { id: exact.id, slug: exact.slug, name: exact.name }, isNew: false };
      const alias = LEGACY_SLUG_ALIASES.get(slug);
      const mapped = alias && bySlug.get(alias);
      if (mapped) return { term: { id: mapped.id, slug: mapped.slug, name: mapped.name }, isNew: false };
      const parent = termParent(current);
      current = parent ? catalog.get(parent) : undefined;
    }
    return { term: publicTerm(catalog.get(termGroup(selected)) || selected), isNew: true };
  };

  return (selectedTerms, bucket) => {
    const terms = [], additions = [], seen = new Set();
    for (const selected of selectedTerms) {
      const result = resolve(selected, bucket);
      if (seen.has(result.term.slug)) continue;
      seen.add(result.term.slug);
      terms.push(result.term);
      if (result.isNew) additions.push(result.term);
    }
    return { terms, additions };
  };
}

function currentTerms(entry, name) {
  const rows = entry?.data?.terms?.[name];
  return rows === undefined ? [] : rows;
}

function addUsed(target, bucket, rows) {
  const seen = new Set(target[bucket].map(term => term.slug));
  for (const term of rows) if (!seen.has(term.slug)) {
    seen.add(term.slug);
    target[bucket].push(term);
  }
}

export function projectNativeSiteTaxonomy({ entries, locale, source, baseline, taxonomyTerms }) {
  validateBaseline(baseline);
  validateVocabulary(taxonomyTerms);
  if (!source?.terms || !Array.isArray(entries)) throw new Error('Invalid native taxonomy projection input');
  const project = createResolver({ locale, source, baseline, taxonomyTerms });
  const overrides = new Map();
  const used = { destinations: [], types: [] };

  for (const entry of entries) {
    const data = entry?.data || {};
    const claimsImport = Object.hasOwn(data, 'source_key') || Object.hasOwn(data, 'source_status');
    const destinations = currentTerms(entry, 'destinations');
    const regions = currentTerms(entry, 'travel_regions');
    const styles = currentTerms(entry, 'travel_styles');
    let override;

    if (claimsImport) {
      const sourceKey = string(data.source_key);
      const captured = baseline.entries[sourceKey];
      if (!sourceKey || !captured) throw new Error(`Missing native taxonomy baseline for ${sourceKey || entry.id}`);
      for (const name of TAXONOMIES) {
        if (!Array.isArray(captured[name])) throw new Error(`Native taxonomy baseline for ${sourceKey} is missing ${name}`);
      }
      const destinationsChanged = !sameAssignments(destinations, captured.destinations, `${sourceKey} destinations`)
        || !sameAssignments(regions, captured.travel_regions, `${sourceKey} travel_regions`);
      const stylesChanged = !sameAssignments(styles, captured.travel_styles, `${sourceKey} travel_styles`);
      if (destinationsChanged) {
        const result = project([...destinations, ...regions], 'destinations');
        override ||= {};
        override.destinations = result.terms;
        addUsed(used, 'destinations', result.additions);
      }
      if (stylesChanged) {
        const result = project(styles, 'types');
        override ||= {};
        override.types = result.terms;
        addUsed(used, 'types', result.additions);
      }
    } else {
      const projectedDestinations = project([...destinations, ...regions], 'destinations');
      const projectedStyles = project(styles, 'types');
      override = { destinations: projectedDestinations.terms, types: projectedStyles.terms };
      addUsed(used, 'destinations', projectedDestinations.additions);
      addUsed(used, 'types', projectedStyles.additions);
    }

    if (override) overrides.set(entry.id, override);
  }

  return { overrides, taxonomyTerms: used };
}
