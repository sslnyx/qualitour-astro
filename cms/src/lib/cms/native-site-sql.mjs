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

/**
 * The text and JSON fields only a detail page shows. In the backup they are 95% of the published bytes
 * (itinerary alone 72%, about 6.3 of 8.9 MB across 258 tours) while a card needs none of them. The catalogue
 * reads rows without them; a detail page re-reads its one complete row with `readPublishedEntryRow`.
 */
export const OMITTED_COLUMNS = Object.freeze(['overview', 'itinerary', 'itinerary_continued', 'additional_info', 'faq', 'gallery']);
/**
 * Everything the catalogue reads from a row. A column added to the tours collection later is not read here
 * until it is listed (a detail page still gets it from the complete row), so a new card field needs an entry.
 */
export const CARD_COLUMNS = Object.freeze([
  'id', 'slug', 'status', 'published_at', 'locale', 'translation_group', 'title', 'tour_code', 'summary', 'price',
  'currency', 'duration', 'location', 'hero', 'brochure', 'source_key', 'source_status', 'ribbon',
]);
const OMITTED_AS_NULL = Object.freeze(Object.fromEntries(OMITTED_COLUMNS.map(column => [column, null])));

/**
 * One page of published rows for a locale, newest first with a stable tie-break, without the bulky detail
 * columns. The adapter requires those fields to be present on an imported tour and accepts an explicit null
 * as an editor's removal, so each row carries nulls for them: the cards come out exactly as from complete rows
 * (the catalogue drops `content` and `goodlayers_data`, the only outputs those fields feed).
 */
export async function readPublishedPage(db, locale, { limit, offset }) {
  const rows = await db.selectFrom(COLLECTION).select([...CARD_COLUMNS])
    .where('status', '=', 'published').where('deleted_at', 'is', null).where('locale', '=', locale)
    .orderBy('published_at', 'desc').orderBy('id', 'asc')
    .limit(limit).offset(offset).execute();
  return rows.map(row => ({ ...row, ...OMITTED_AS_NULL }));
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

/** One published row by ID, or undefined (a draft, trashed or missing entry must not be served). */
export async function readPublishedEntryRow(db, id) {
  const rows = await db.selectFrom(COLLECTION).selectAll()
    .where('id', '=', id).where('status', '=', 'published').where('deleted_at', 'is', null).limit(1).execute();
  return rows[0];
}

/** Editor SEO overrides in the loader's shape; null when the entry has no SEO row. */
export async function readSeo(db, id) {
  const rows = await db.selectFrom('_emdash_seo').selectAll().where('collection', '=', 'tours').where('content_id', '=', id).limit(1).execute();
  const row = rows[0];
  if (!row || row.seo_no_index === null || row.seo_no_index === undefined) return null;
  const text = value => typeof value === 'string' ? value : null;
  return { title: text(row.seo_title), description: text(row.seo_description), image: text(row.seo_image), canonical: text(row.seo_canonical), noIndex: row.seo_no_index === 1 };
}

export const TAXONOMY_NAMES = ['destinations', 'travel_styles', 'travel_regions', 'cruise_types'];

/** Every term of the four tour taxonomies, in the order EmDash lists them (sort_order, then label). */
export async function readVocabularyRows(db) {
  return db.selectFrom('taxonomies')
    .select(['id', 'name', 'slug', 'label', 'parent_id', 'locale', 'translation_group'])
    .where('name', 'in', TAXONOMY_NAMES).orderBy('sort_order', 'asc').orderBy('label', 'asc').execute();
}

/**
 * Vocabulary per locale and taxonomy. A translated term may point at its parent's *English* term (80 of the 129
 * Chinese destinations do), which leaves it an orphan in a per-locale tree and drops it from EmDash's term lists.
 * Slugs are shared across languages, so each parent is re-linked to the same-locale term with the parent's slug,
 * and becomes a root only when that language has no such term.
 */
/**
 * Public page text of a term (`intro`: blank-line separated paragraphs, `promo`: one offer line). It lives in its own
 * table, not in a term's `data`: EmDash replaces `data` wholesale whenever an editor saves a term's description, which
 * would silently delete the text. A missing table means no term has any.
 */
export async function readTermPublicText(db) {
  try {
    return await db.selectFrom('term_public_text').select(['taxonomy', 'slug', 'locale', 'intro', 'promo']).execute();
  } catch { return []; }
}

const publicText = row => {
  const text = value => typeof value === 'string' && value.trim() ? value.trim().slice(0, 4000) : undefined;
  const intro = text(row?.intro), promo = text(row?.promo);
  return { ...(intro ? { intro } : {}), ...(promo ? { promo } : {}) };
};

export function buildVocabulary(rows, texts = []) {
  const textOf = new Map(texts.map(row => [`${row.locale}|${row.taxonomy}|${row.slug}`, row]));
  const byId = new Map(rows.map(row => [row.id, row]));
  const inLocale = new Map(rows.map(row => [`${row.locale}|${row.name}|${row.slug}`, row]));
  const vocabulary = {};
  for (const row of rows) {
    const parent = row.parent_id ? byId.get(row.parent_id) : undefined;
    const localParent = parent ? inLocale.get(`${row.locale}|${row.name}|${parent.slug}`) : undefined;
    const term = { id: row.id, name: row.name, slug: row.slug, label: row.label, parentId: localParent?.id ?? null, locale: row.locale, translationGroup: row.translation_group || null, ...publicText(textOf.get(`${row.locale}|${row.name}|${row.slug}`)) };
    ((vocabulary[row.locale] ||= Object.fromEntries(TAXONOMY_NAMES.map(name => [name, []])))[row.name] ||= []).push(term);
  }
  return vocabulary;
}


/**
 * Google reviews live in their own collection: published = shown on the site, draft or unpublished = hidden.
 * Reviews are not translated, so there is no locale filter; the legacy shape the review components read is built
 * from these columns by `reviewRowToLegacy`.
 */
const REVIEWS_COLLECTION = 'ec_google_reviews';
export const REVIEW_COLUMNS = Object.freeze([
  'id', 'slug', 'author_name', 'source_id', 'rating', 'text', 'reviewed_at', 'author_url', 'profile_photo',
  'profile_photo_source', 'local_guide', 'reviewer_reviews', 'reviewer_photos', 'images', 'source',
]);
export async function readPublishedReviewRows(db) {
  return db.selectFrom(REVIEWS_COLLECTION).select([...REVIEW_COLUMNS])
    .where('status', '=', 'published').where('deleted_at', 'is', null)
    .orderBy('reviewed_at', 'desc').orderBy('id', 'asc').execute();
}

/** Google's own wording ("a month ago"), computed when the snapshot is built. */
export function relativeTimeDescription(reviewedAt, now = Date.now()) {
  const days = Math.floor((now - Date.parse(reviewedAt)) / 86400000);
  if (!Number.isFinite(days) || days < 0) return '';
  if (days < 1) return 'today';
  if (days < 2) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return months <= 1 ? 'a month ago' : `${months} months ago`;
  const years = Math.floor(days / 365.25);
  return years <= 1 ? 'a year ago' : `${years} years ago`;
}

export function reviewRowToLegacy(row, index = 0, now = Date.now()) {
  const when = Date.parse(row.reviewed_at);
  const numeric = String(row.source_id ?? '').match(/(\d+)$/);
  const images = mapValue(row.images);
  return {
    id: numeric ? Number(numeric[1]) : 1_000_000 + index,
    author_name: String(row.author_name ?? ''),
    author_url: String(row.author_url ?? ''),
    profile_photo_url: String(row.profile_photo || row.profile_photo_source || ''),
    rating: Number(row.rating) || 0,
    text: String(row.text ?? ''),
    time: Number.isFinite(when) ? String(Math.floor(when / 1000)) : '0',
    relative_time_description: relativeTimeDescription(row.reviewed_at, now),
    local_guide: Boolean(Number(row.local_guide)),
    reviewer_reviews: Number(row.reviewer_reviews) || 0,
    reviewer_photos: Number(row.reviewer_photos) || 0,
    images: Array.isArray(images) ? images : [],
    source: String(row.source || 'google'),
  };
}
