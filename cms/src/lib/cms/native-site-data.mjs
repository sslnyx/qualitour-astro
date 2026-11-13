import compatibilitySource from '../../../../src/data/cms-legacy-compat.json' with { type: 'json' };
import { buildCatalogue, retainPublicTranslations, sortCatalogueTours } from '../../../../src/lib/cms/legacy-adapter.mjs';
import { getEmDashEntry, getRequestContext, getTaxonomyDefs, getTaxonomyTermsWithCacheHint, MediaRepository } from 'emdash';
import { getDb } from 'emdash/runtime';
import { assignTourCategories, buildCategoryTerms } from './native-site-categories.mjs';
import { optimizeTourHeroes } from './native-site-image.mjs';
import { readAssignments, readPublishedPage, rowToEntry, termsForEntry } from './native-site-sql.mjs';

const locales = ['en','zh'];
const PAGE_SIZE = 32;
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
const taxonomyNames = ['destinations','travel_styles','travel_regions','cruise_types'];
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
function flattenTerms(rows) {
  return (Array.isArray(rows) ? rows : []).flatMap(row => [row, ...flattenTerms(row?.children)]);
}
function taxonomyRow(term) {
  return {id:String(term.id),name:String(term.name),slug:String(term.slug),label:String(term.label),parentId:term.parentId ? String(term.parentId) : undefined,locale:String(term.locale),translationGroup:term.translationGroup || null};
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
    const importedEn=Object.hasOwn(group.en.data,'source_key') || Object.hasOwn(group.en.data,'source_status');
    const importedZh=Object.hasOwn(group.zh.data,'source_key') || Object.hasOwn(group.zh.data,'source_status');
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
  for (const key of ['translationGroup','source_key','source_status']) if (Object.hasOwn(entry.data,key)) data[key]=entry.data[key];
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
  return async function* readTourPages(locale, vocabulary) {
    const db = await getDatabase();
    const assignments = await readAssignments(db);
    const fallback = locale === 'en' ? undefined : vocabulary.en;
    for (let offset = 0; ; offset += pageSize) {
      const rows = await readPublishedPage(db, locale, { limit: pageSize, offset });
      if (!rows.length) return;
      yield rows.map(row => rowToEntry(row, locale, termsForEntry(assignments.get(row.id) || [], vocabulary[locale], fallback)));
      if (rows.length < pageSize) return;
    }
  };
}

export function createNativeSiteData({
  compatibility=compatibilitySource,
  readTourPages=createSqlTourSource(),
  getContext=getRequestContext,
  getTaxonomyDefs:getDefs=getTaxonomyDefs,
  getTaxonomyTermsWithCacheHint:getTerms=getTaxonomyTermsWithCacheHint,
  lookupMediaStorageKeys=lookupStorageKeys,
  presentTours=optimizeTourHeroes,
  getEntry=getEmDashEntry,
}={}) {
  const requestLoads=new WeakMap();
  const load=async()=>{
    // The vocabulary comes first: every page of tours needs it to attach terms.
    const vocabulary={en:{},zh:{}};
    const taxonomyHints=[];
    for (const locale of locales) {
      const defs=await getDefs({locale});
      const tourDefs=new Map(defs.filter(def=>def.collections?.includes('tours')).map(def=>[def.name,def]));
      for (const name of taxonomyNames) {
        if (!tourDefs.has(name)) throw new Error(`Missing published CMS taxonomy definition ${name} for ${locale}`);
        const result=await getTerms(name,{locale,includeCounts:false});
        taxonomyHints.push(result.cacheHint);
        vocabulary[locale][name]=flattenTerms(result.data).map(taxonomyRow);
      }
    }
    // Memory is the constraint in the Worker: one locale at a time, in pages of PAGE_SIZE, and each page's raw
    // entries are released as soon as its tours exist. Only a small stub per entry survives for translation linking.
    const catalogues={}, stubs={}, collectionHints=[];
    for (const locale of locales) {
      const tours=[], excluded=[], seenIds=new Set(), sortDates=new Map();
      stubs[locale]=[];
      let pageCount=0;
      for await (const page of readTourPages(locale,vocabulary)) {
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
    const hints=[...collectionHints,...taxonomyHints];
    return {catalogues,cacheHint:mergeHints(hints)};
  };
  const current=()=>{
    const context=getContext();
    if (!context || typeof context !== 'object') return load();
    const found=requestLoads.get(context); if(found)return found;
    const pending=load().catch(error=>{requestLoads.delete(context);throw error;});
    requestLoads.set(context,pending); return pending;
  };
  /**
   * The catalogue holds card-level tours; a detail page reads its one complete entry through the official
   * single-entry API (editor SEO overrides included) and keeps the catalogue's terms and translations.
   */
  const getNativeTourDetail=async(locale,tour)=>{
    if (!tour?.entryId) throw new Error('Catalogue tour has no CMS entry');
    const result=await getEntry('tours',tour.entryId,{locale});
    if (result.error) throw result.error;
    if (!result.entry || result.isPreview) return null;
    const entry=normalizeEntry(result.entry,locale);
    await resolveSeoImages({[locale]:[entry]},lookupMediaStorageKeys);
    const full=buildCatalogue([entry],compatibility,locale,{allowEmpty:true}).tours[0];
    if (!full) return null;
    full.tour_terms=tour.tour_terms;
    if (tour.translations) full.translations=tour.translations;
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
