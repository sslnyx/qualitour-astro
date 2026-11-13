/**
 * Direct, paged reads of the published tours and their taxonomy assignments.
 *
 * `getEmDashCollection` hydrates bylines, taxonomy terms and references with lazy `import()` calls. In the
 * Worker, doing that over the whole collection on every request aborts with "Dynamic import exceeded memory
 * limits". These reads need no hydration at all: the content row already holds every field, and the pivot
 * table holds the term assignments, so one small query per page replaces the hydration machinery.
 *
 * The functions take a Kysely-compatible `db` so they can be exercised without a Worker.
 */
const COLLECTION = 'ec_tours';
const JSON_FIELDS = ['hero', 'brochure', 'overview', 'itinerary', 'itinerary_continued', 'gallery', 'additional_info', 'faq'];
const PLAIN_FIELDS = ['title', 'tour_code', 'summary', 'price', 'currency', 'duration', 'location', 'source_key', 'source_status'];

function parseJson(value, field, id) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); }
  catch { throw new Error(`Invalid stored ${field} for CMS entry ${id}`); }
}

/**
 * A content row in the shape `getEmDashCollection` returns, minus hydration. Absent columns stay absent
 * (EmDash omits fields a collection does not declare), while null columns stay null.
 */
export function rowToEntry(row, locale, terms = {}) {
  const data = {};
  for (const field of PLAIN_FIELDS) if (field in row) data[field] = row[field];
  for (const field of JSON_FIELDS) if (field in row) data[field] = parseJson(row[field], field, row.id);
  // EmDash leaves an unset structured field out of `data` instead of exposing null, and the adapter tells
  // imported entries from native ones by whether `source_key`/`source_status` exist at all.
  for (const field of [...JSON_FIELDS, 'source_key', 'source_status']) if (data[field] === null) delete data[field];
  return {
    id: row.id,
    slug: row.slug,
    data: {
      ...data,
      id: row.id,
      status: row.status,
      locale: row.locale ?? locale,
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      translationGroup: row.translation_group,
      terms,
    },
  };
}

/** One page of published rows for a locale, newest first with a stable tie-break. */
export async function readPublishedPage(db, locale, { limit, offset }) {
  return db.selectFrom(COLLECTION).selectAll()
    .where('status', '=', 'published').where('deleted_at', 'is', null).where('locale', '=', locale)
    .orderBy('published_at', 'desc').orderBy('id', 'asc')
    .limit(limit).offset(offset).execute();
}

/** Every term assignment for the collection, grouped per entry as translation-group IDs. */
export async function readAssignments(db) {
  const rows = await db.selectFrom('content_taxonomies').select(['entry_id', 'taxonomy_id']).where('collection', '=', 'tours').execute();
  const byEntry = new Map();
  for (const row of rows) {
    const groups = byEntry.get(row.entry_id) || [];
    groups.push(String(row.taxonomy_id));
    byEntry.set(row.entry_id, groups);
  }
  return byEntry;
}

/**
 * Terms of one taxonomy for an entry. `taxonomy_id` stores a term's translation group; an entry in a language
 * that lacks the term's translation falls back to the default-locale term, as EmDash's own hydration does.
 */
export function termsForEntry(groups, vocabulary, fallbackVocabulary) {
  const result = {};
  for (const [name, rows] of Object.entries(vocabulary)) {
    const fallbackRows = fallbackVocabulary?.[name] || [];
    const byGroup = new Map(rows.map(term => [term.translationGroup || term.id, term]));
    const fallbackByGroup = new Map(fallbackRows.map(term => [term.translationGroup || term.id, term]));
    const assigned = [];
    for (const group of groups) {
      const term = byGroup.get(group) || fallbackByGroup.get(group);
      if (term) assigned.push({ id: term.id, name, slug: term.slug, label: term.label, parentId: term.parentId, locale: term.locale, translationGroup: term.translationGroup });
    }
    // EmDash's own hydration orders each taxonomy's terms by label; cards show the first two, so the order is visible.
    if (assigned.length) result[name] = assigned.toSorted((a, b) => String(a.label).localeCompare(String(b.label)));
  }
  return result;
}
