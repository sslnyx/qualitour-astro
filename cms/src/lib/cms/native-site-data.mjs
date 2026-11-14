import compatibilitySource from '../../../../src/data/cms-legacy-compat.json' with { type: 'json' };
import { buildCatalogue, claimsImport, retainPublicTranslations, sortCatalogueTours } from '../../../../src/lib/cms/legacy-adapter.mjs';
import { getRequestContext, MediaRepository } from 'emdash';
import { getDb } from 'emdash/runtime';
import { assignTourCategories, buildCategoryTerms } from './native-site-categories.mjs';
import { optimizeTourHeroes } from './native-site-image.mjs';
import { createKvSnapshotStore, setNativeSnapshotKv } from './native-snapshot-kv.mjs';
import { TAXONOMY_NAMES, buildVocabulary, readAssignments, readPublishedEntryRow, readPublishedPage, readSeo, readVocabularyRows, rowToEntry, termsForEntry } from './native-site-sql.mjs';

const locales = ['en','zh'];
// A narrowed row is about 1.5 KB, so one query per locale (192 and 65 tours today) replaces four and two.
const PAGE_SIZE = 256;
/**
 * The itinerary/FAQ tree (goodlayers_data) is thousands of small objects per tour. Held as one JSON string it
 * costs a fraction of the Worker memory, and it is rebuilt only for a tour whose detail page actually reads it.
 */
function packTourDetail(tour) {
  if (!tour.goodlayers_data) return tour;
  const packed=JSON.stringify(tour.goodlayers_data);
  let value;
  Object.defineProperty(tour,'goodlayers_data',{get:()=>value??=JSON.parse(packed),enumerable:true,configurable:true});
  return tour;
}
const asIso = value => value instanceof Date ? value.toISOString() : value;

function normalizeEntry(entry, locale) {
  const data = entry?.data;
  if (!data || typeof data !== 'object') throw new Error('Invalid published CMS tour entry');
  const normalized={...data};
  for(const field of ['id','status','locale','publishedAt','translationGroup'])if(normalized[field]===undefined&&entry[field]!==undefined)normalized[field]=entry[field];
  if(normalized.seo===undefined&&entry.seo!==undefined)normalized.seo=entry.seo;
  const id = typeof normalized.id === 'string' ? normalized.id : '';
  if (!id || normalized.status !== 'published' || normalized.locale !== locale) throw new Error(`Invalid published ${locale} CMS tour entry`);
  return { id, slug: entry.slug??normalized.slug, status:normalized.status, locale:normalized.locale, publishedAt:asIso(normalized.publishedAt), data:normalized };
}
function projectedId(entry) {
  const source = entry.data.source_key;
  if (typeof source === 'string') {
    const match = source.match(/^wp-(?:en|zh)-([1-9]\d*)$/);
    if (match) return Number(match[1]);
  }
  return entry.id;
}
function linkPublishedTranslations(catalogues, entries) {
  retainPublicTranslations(catalogues);
  const byLocale = Object.fromEntries(locales.map(locale=>[locale,new Map(catalogues[locale].tours.map(tour=>[tour.id,tour]))]));
  const groups = new Map();
  for (const locale of locales) for (const entry of entries[locale]) {
    const key = typeof entry.data.translationGroup === 'string' && entry.data.translationGroup || entry.id;
    const group = groups.get(key) || {};
    if (group[locale]) throw new Error(`Duplicate published ${locale} translation in group ${key}`);
    group[locale]=entry; groups.set(key,group);
  }
  for (const group of groups.values()) {
    if (!group.en || !group.zh) continue;
    const en=byLocale.en.get(projectedId(group.en)), zh=byLocale.zh.get(projectedId(group.zh));
    if (!en || !zh) continue;
    const importedEn=claimsImport(group.en.data), importedZh=claimsImport(group.zh.data);
    if (importedEn && importedZh) continue;
    if (en.translations && Object.keys(en.translations).length || zh.translations && Object.keys(zh.translations).length) continue;
    en.translations={zh:{id:zh.id,slug:zh.slug}};
    zh.translations={en:{id:en.id,slug:en.slug}};
  }
}
const bareMediaId=value=>typeof value==='string'&&value.trim()&&!/^(?:[a-z][a-z\d+.-]*:|\/)/i.test(value.trim())?value.trim():undefined;
const mediaFilePath=key=>`/_emdash/api/media/file/${key.split('/').map(encodeURIComponent).join('/')}`;
/** The SEO image picker stores a media ID, but the public file route is keyed by storage key. */
async function lookupStorageKeys(ids) {
  // Named static imports only: a dynamic import('emdash') would keep every export, including the image decoders the Free runtime must not ship.
  const repository=new MediaRepository(await getDb());
  return new Map(await Promise.all([...ids].map(async id=>[id,(await repository.findById(id))?.storageKey])));
}
async function resolveSeoImages(entries, lookup) {
  const ids=new Set();
  for (const rows of Object.values(entries)) for (const entry of rows) { const id=bareMediaId(entry.data.seo?.image); if(id)ids.add(id); }
  if (!ids.size) return;
  const keys=await lookup(ids);
  for (const rows of Object.values(entries)) for (const entry of rows) {
    const id=bareMediaId(entry.data.seo?.image); if(!id)continue;
    const key=keys.get(id), seo={...entry.data.seo};
    if (typeof key==='string' && key) seo.image=mediaFilePath(key); else delete seo.image; // an unresolved image must not become a 404 og:image
    entry.data.seo=seo;
  }
}
/** Only what translation linking needs; the full entry (itineraries, rich text) can then be released. */
function linkingStub(entry) {
  const data={};
  if (typeof entry.data.translationGroup==='string') data.translationGroup=entry.data.translationGroup;
  if (claimsImport(entry.data)) for (const key of ['source_key','source_status']) if (typeof entry.data[key]==='string') data[key]=entry.data[key];
  return { id:entry.id, data };
}
function mergeHints(hints) {
  const tags=[];
  for (const hint of hints) for (const tag of hint?.tags || []) if (typeof tag === 'string' && !tags.includes(tag)) tags.push(tag);
  return {tags};
}

/**
 * Published tours as pages of entries with their taxonomy terms attached, read straight from the database
 * (see native-site-sql.mjs for why this does not go through getEmDashCollection).
 */
export function createSqlTourSource({ getDatabase = getDb, pageSize = PAGE_SIZE } = {}) {
  return async function* readTourPages(locale, vocabulary, shared = {}) {
    const db = await getDatabase();
    // One pivot read per load, shared by both locales.
    const assignments = await (shared.assignments ??= readAssignments(db));
    const fallback = locale === 'en' ? undefined : vocabulary.en;
    for (let offset = 0; ; offset += pageSize) {
      const rows = await readPublishedPage(db, locale, { limit: pageSize, offset });
      if (!rows.length) return;
      // EmDash stores an assignment once per content translation group (an English entry and its Chinese
      // translation share the rows saved under the group), while imported entries have rows of their own.
      yield rows.map(row => rowToEntry(row, locale, termsForEntry([...new Set([...(assignments.get(row.id) || []), ...(assignments.get(row.translation_group) || [])])], vocabulary[locale], fallback)));
      if (rows.length < pageSize) return;
    }
  };
}

/**
 * One complete published tour with its editor SEO, again straight from the database: the single-entry
 * EmDash API also hydrates through lazy imports, and a detail page already holds the whole catalogue.
 * Resolves to null for a missing, draft or trashed entry.
 */
/**
 * The tour vocabulary straight from the taxonomies table, with the cache tags EmDash invalidates when an editor
 * changes a taxonomy (`emdash:taxonomy:<name>`).
 */
/** The cache tags EmDash invalidates when a taxonomy changes; the same on every render, so a snapshot hit needs no read to know them. */
const taxonomyTagHints = () => TAXONOMY_NAMES.map(name => ({ tags: [`emdash:taxonomy:${name}`] }));
export function createSqlVocabularySource({ getDatabase = getDb } = {}) {
  return async function readVocabulary() {
    const vocabulary = buildVocabulary(await readVocabularyRows(await getDatabase()));
    return { vocabulary, hints: taxonomyTagHints() };
  };
}

export function createSqlEntrySource({ getDatabase = getDb } = {}) {
  return async function readEntry(entryId, locale) {
    const db = await getDatabase();
    const row = await readPublishedEntryRow(db, entryId);
    if (!row) return null;
    const entry = rowToEntry(row, locale);
    const seo = await readSeo(db, entryId);
    if (seo) entry.seo = seo;
    return entry;
  };
}

export { setNativeSnapshotKv };

const LITE_DROP = new Set(['content', 'goodlayers_data']);
/** List pages need cards, not itineraries; a detail page re-reads its one complete entry. */
function toLiteCatalogues(catalogues) {
  const lite = {}, entryIds = {};
  for (const locale of locales) {
    entryIds[locale] = {};
    lite[locale] = {
      terms: catalogues[locale].terms,
      excluded: catalogues[locale].excluded,
      tours: catalogues[locale].tours.map(tour => {
        const card = {};
        for (const key of Object.keys(tour)) if (!LITE_DROP.has(key)) card[key] = tour[key];
        card.content = { rendered: '' };
        entryIds[locale][String(tour.id)] = tour.entryId;
        return card;
      }),
    };
  }
  return { catalogues: lite, entryIds };
}
function restoreEntryIds({ catalogues, entryIds }) {
  for (const locale of locales) for (const tour of catalogues[locale].tours) {
    Object.defineProperty(tour, 'entryId', { value: entryIds[locale]?.[String(tour.id)], enumerable: false });
  }
  return catalogues;
}

export function createNativeSiteData({
  compatibility=compatibilitySource,
  readTourPages=createSqlTourSource(),
  getContext=getRequestContext,
  readVocabulary=createSqlVocabularySource(),
  lookupMediaStorageKeys=lookupStorageKeys,
  presentTours=optimizeTourHeroes,
  readEntry=createSqlEntrySource(),
  snapshotStore=createKvSnapshotStore(),
}={}) {
  const requestLoads=new WeakMap();
  const load=async()=>{
    // The version marker lives in KV, so a render that finds its snapshot reads no database rows at all.
    const version=await Promise.resolve().then(()=>snapshotStore.version()).catch(()=>null);
    if (version) {
      const hit=await snapshotStore.get(version);
      if (hit?.catalogues?.en?.tours && hit.catalogues.zh?.tours) return {catalogues:restoreEntryIds(hit),cacheHint:mergeHints([{tags:['tours']},{tags:['tours']},...taxonomyTagHints()])};
    }
    const shared={};
    const {vocabulary:rawVocabulary,hints:taxonomyHints}=await readVocabulary();
    const vocabulary=Object.fromEntries(locales.map(locale=>[locale,Object.fromEntries(TAXONOMY_NAMES.map(name=>[name,rawVocabulary[locale]?.[name]||[]]))]));
    // Memory is the constraint in the Worker: one locale at a time, in pages of PAGE_SIZE, and each page's raw
    // entries are released as soon as its tours exist. Only a small stub per entry survives for translation linking.
    const catalogues={}, stubs={}, collectionHints=[];
    for (const locale of locales) {
      const tours=[], excluded=[], seenIds=new Set(), sortDates=new Map();
      stubs[locale]=[];
      let pageCount=0;
      for await (const page of readTourPages(locale,vocabulary,shared)) {
        if (!Array.isArray(page)) throw new Error(`Invalid published ${locale} CMS collection result`);
        const rows=page.map(entry=>normalizeEntry(entry,locale));
        for (const entry of rows) { if(seenIds.has(entry.id))throw new Error(`Duplicate published CMS tour ID ${entry.id}`); seenIds.add(entry.id); }
        await resolveSeoImages({[locale]:rows},lookupMediaStorageKeys);
        if (rows.length) {
          const part=buildCatalogue(rows,compatibility,locale,{allowEmpty:true});
          assignTourCategories({tours:part.tours,entries:rows,vocabulary:vocabulary[locale],tourIdFor:projectedId});
          const entryIds=new Map(rows.map(entry=>[String(projectedId(entry)),entry.id]));
          for (const tour of part.tours) { Object.defineProperty(tour,'entryId',{value:entryIds.get(String(tour.id)),enumerable:false}); packTourDetail(tour); }
          tours.push(...part.tours); excluded.push(...part.excluded);
          for (const [id,date] of part.sortDates) sortDates.set(id,date);
          stubs[locale].push(...rows.map(linkingStub));
        }
        if (++pageCount>100) throw new Error(`Published ${locale} CMS collection did not terminate`);
      }
      if (!tours.length) throw new Error(`Refusing an empty ${locale} CMS catalogue`);
      collectionHints.push({tags:['tours']});
      sortCatalogueTours(tours,sortDates);
      const terms=buildCategoryTerms({tours,vocabulary:vocabulary[locale],locale});
      catalogues[locale]={tours:await presentTours(tours),terms,excluded};
    }
    linkPublishedTranslations(catalogues,stubs);
    const snapshot=toLiteCatalogues(catalogues);
    if (version) await snapshotStore.put(version,snapshot);
    const hints=[...collectionHints,...taxonomyHints];
    return {catalogues:restoreEntryIds(snapshot),cacheHint:mergeHints(hints)};
  };
  const current=()=>{
    const context=getContext();
    if (!context || typeof context !== 'object') return load();
    const found=requestLoads.get(context); if(found)return found;
    const pending=load().catch(error=>{requestLoads.delete(context);throw error;});
    requestLoads.set(context,pending); return pending;
  };
  /**
   * The catalogue holds card-level tours; a detail page reads its one complete entry
   * (editor SEO overrides included) and keeps the catalogue's terms and translations.
   */
  const getNativeTourDetail=async(locale,tour)=>{
    if (!tour?.entryId) throw new Error('Catalogue tour has no CMS entry');
    const found=await readEntry(tour.entryId,locale);
    if (!found) return null;
    const entry=normalizeEntry(found,locale);
    await resolveSeoImages({[locale]:[entry]},lookupMediaStorageKeys);
    const full=buildCatalogue([entry],compatibility,locale,{allowEmpty:true}).tours[0];
    if (!full) return null;
    full.tour_terms=tour.tour_terms;
    // The single-entry build carries the frozen baseline's links; only the catalogue knows which are still public.
    if (tour.translations) full.translations=tour.translations; else delete full.translations;
    if (tour.optimizedHero) full.optimizedHero=tour.optimizedHero;
    return full;
  };
  return {
    getNativeSiteCatalogues:async()=>(await current()).catalogues,
    getNativeSiteCacheHint:async()=>(await current()).cacheHint,
    getNativeTourDetail,
  };
}

const runtime=createNativeSiteData();
export const getNativeSiteCatalogues=runtime.getNativeSiteCatalogues;
export const getNativeSiteCacheHint=runtime.getNativeSiteCacheHint;
export const getNativeTourDetail=runtime.getNativeTourDetail;
