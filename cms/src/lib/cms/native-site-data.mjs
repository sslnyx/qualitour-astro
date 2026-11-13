import compatibilitySource from '../../../../src/data/cms-legacy-compat.json' with { type: 'json' };
import { buildCatalogue, retainPublicTranslations } from '../../../../src/lib/cms/legacy-adapter.mjs';
import { getEmDashCollection, getRequestContext, getTaxonomyDefs, getTaxonomyTermsWithCacheHint, MediaRepository } from 'emdash';
import { getDb } from 'emdash/runtime';
import { applyNativeCategories } from './native-site-categories.mjs';

const locales = ['en','zh'];
const PAGE_SIZE = 32;
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
  for (const locale of locales) for (const entry of entries[locale]) { const id=bareMediaId(entry.data.seo?.image); if(id)ids.add(id); }
  if (!ids.size) return;
  const keys=await lookup(ids);
  for (const locale of locales) for (const entry of entries[locale]) {
    const id=bareMediaId(entry.data.seo?.image); if(!id)continue;
    const key=keys.get(id), seo={...entry.data.seo};
    if (typeof key==='string' && key) seo.image=mediaFilePath(key); else delete seo.image; // an unresolved image must not become a 404 og:image
    entry.data.seo=seo;
  }
}
function mergeHints(hints) {
  const tags=[];
  for (const hint of hints) for (const tag of hint?.tags || []) if (typeof tag === 'string' && !tags.includes(tag)) tags.push(tag);
  return {tags};
}

export function createNativeSiteData({
  compatibility=compatibilitySource,
  getCollection=getEmDashCollection,
  getContext=getRequestContext,
  getTaxonomyDefs:getDefs=getTaxonomyDefs,
  getTaxonomyTermsWithCacheHint:getTerms=getTaxonomyTermsWithCacheHint,
  lookupMediaStorageKeys=lookupStorageKeys,
  presentTours=async tours=>(await import('./native-site-image.mjs')).optimizeTourPresentations(tours),
}={}) {
  const requestLoads=new WeakMap();
  const load=async()=>{
    // Taxonomy first: it loads EmDash's taxonomy module while memory is still free.
    // That module is otherwise imported lazily in the middle of hydrating hundreds of
    // large entries, where the Worker aborts with "Dynamic import exceeded memory limits".
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
    // Pages of PAGE_SIZE keep each EmDash hydration small. One 192-entry query makes the Worker abort with
    // "Dynamic import exceeded memory limits" when EmDash lazily imports its taxonomy module mid-hydration,
    // while the 64-entry Chinese collection loads fine. Locales also load one at a time.
    const collectionResults={};
    for (const locale of locales) {
      const pages=[];
      let cursor;
      do {
        const result=await getCollection('tours',{status:'published',locale,orderBy:{published_at:'desc'},limit:PAGE_SIZE,...(cursor?{cursor}:{})});
        if (result.error) throw result.error;
        if (!Array.isArray(result.entries)) throw new Error(`Invalid published ${locale} CMS collection result`);
        pages.push(result);
        cursor=result.nextCursor;
        if (pages.length>100) throw new Error(`Published ${locale} CMS collection did not terminate`);
      } while (cursor);
      collectionResults[locale]={entries:pages.flatMap(page=>page.entries),cacheHint:mergeHints(pages.map(page=>page.cacheHint))};
    }
    const entries=Object.fromEntries(locales.map(locale=>[locale,collectionResults[locale].entries.map(entry=>normalizeEntry(entry,locale))]));
    for (const locale of locales) {
      const ids=new Set(); for (const entry of entries[locale]) { if(ids.has(entry.id))throw new Error(`Duplicate published CMS tour ID ${entry.id}`); ids.add(entry.id); }
    }
    await resolveSeoImages(entries,lookupMediaStorageKeys);
    const hints=[...locales.map(locale=>collectionResults[locale].cacheHint),...taxonomyHints];
    const catalogues=Object.fromEntries(await Promise.all(locales.map(async locale=>{
      const catalogue=buildCatalogue(entries[locale],compatibility,locale);
      applyNativeCategories({catalogue,entries:entries[locale],vocabulary:vocabulary[locale],locale,tourIdFor:projectedId});
      catalogue.tours=await presentTours(catalogue.tours);
      return [locale,catalogue];
    })));
    linkPublishedTranslations(catalogues,entries);
    return {catalogues,cacheHint:mergeHints(hints)};
  };
  const current=()=>{
    const context=getContext();
    if (!context || typeof context !== 'object') return load();
    const found=requestLoads.get(context); if(found)return found;
    const pending=load().catch(error=>{requestLoads.delete(context);throw error;});
    requestLoads.set(context,pending); return pending;
  };
  return {
    getNativeSiteCatalogues:async()=>(await current()).catalogues,
    getNativeSiteCacheHint:async()=>(await current()).cacheHint,
  };
}

const runtime=createNativeSiteData();
export const getNativeSiteCatalogues=runtime.getNativeSiteCatalogues;
export const getNativeSiteCacheHint=runtime.getNativeSiteCacheHint;
