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
// Mirrors the live loader EmDash serves collections through (`mapRowToData` in loader.ts): system columns are
// left out, SQL nulls stay null, text that looks like JSON is parsed, and local media references are normalised.
const SYSTEM_COLUMNS = new Set([
  'id', 'slug', 'status', 'author_id', 'primary_byline_id', 'created_at', 'updated_at', 'published_at',
  'scheduled_at', 'deleted_at', 'version', 'live_revision_id', 'draft_revision_id', 'locale', 'translation_group',
]);
const LOCAL_MEDIA_FILE_PREFIX = '/_emdash/api/media/file/';
const isRecord = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isBareMediaKey = src => !src.startsWith('/') && !/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(src);

function normalizeLocalMediaValue(value) {
  if (Array.isArray(value)) return value.map(normalizeLocalMediaValue);
  if (!isRecord(value)) return value;
  const normalized = {};
  for (const [key, child] of Object.entries(value)) normalized[key] = normalizeLocalMediaValue(child);
  if (normalized.provider === 'local' && typeof normalized.src === 'string' && normalized.src.length > 0) {
    const src = normalized.src;
    if (src.startsWith(LOCAL_MEDIA_FILE_PREFIX)) {
      const id = src.slice(LOCAL_MEDIA_FILE_PREFIX.length);
      if (!normalized.id && id) normalized.id = id;
    } else if (isBareMediaKey(src)) {
      if (!normalized.id) normalized.id = src;
      normalized.src = `${LOCAL_MEDIA_FILE_PREFIX}${src}`;
    }
  }
  return normalized;
}

function mapValue(value) {
  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try { return normalizeLocalMediaValue(JSON.parse(value)); } catch { return value; }
  }
  return value;
}

/** A content row in the shape `getEmDashCollection` returns, minus hydration. */
export function rowToEntry(row, locale, terms = {}) {
  const data = {};
  for (const [key, value] of Object.entries(row)) if (!SYSTEM_COLUMNS.has(key)) data[key] = mapValue(value);
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
