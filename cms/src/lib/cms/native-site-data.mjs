import compatibilitySource from '../../../../src/data/cms-legacy-compat.json' with { type: 'json' };
import { buildCatalogue, retainPublicTranslations } from '../../../../src/lib/cms/legacy-adapter.mjs';
import { getEmDashCollection, getRequestContext, getTaxonomyDefs, getTaxonomyTermsWithCacheHint } from 'emdash';

const locales = ['en','zh'];
const bucketAliases = new Map([
  ['categories','categories'],['category','categories'],['tour_category','categories'],
  ['tags','tags'],['tag','tags'],['tour_tag','tags'],
  ['activities','activities'],['activity','activities'],['tour-activity','activities'],
  ['destinations','destinations'],['destination','destinations'],['tour-destination','destinations'],
  ['durations','durations'],['duration','durations'],['tour_duration','durations'],
  ['types','types'],['type','types'],['tour_type','types'],
]);
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
  return {id:String(term.id),slug:String(term.slug),name:String(term.label),parent:term.parentId ? String(term.parentId) : 0,translationGroup:term.translationGroup || null};
}
function attachTermTranslations(vocabulary) {
  for (const bucket of new Set([...bucketAliases.values()])) {
    const groups = new Map();
    for (const locale of locales) for (const term of vocabulary[locale][bucket] || []) {
      if (!term.translationGroup) continue;
      const group = groups.get(term.translationGroup) || {};
      group[locale] = term; groups.set(term.translationGroup,group);
    }
    for (const group of groups.values()) if (group.en && group.zh) {
      const translations={en:group.en.slug,zh:group.zh.slug};
      group.en.translations=translations; group.zh.translations=translations;
    }
  }
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
  presentTours=async tours=>(await import('./native-site-image.mjs')).optimizeTourPresentations(tours),
}={}) {
  const requestLoads=new WeakMap();
  const load=async()=>{
    const collectionResults=Object.fromEntries(await Promise.all(locales.map(async locale=>{
      const result=await getCollection('tours',{status:'published',locale,orderBy:{published_at:'desc'}});
      if (result.error) throw result.error;
      if (!Array.isArray(result.entries)) throw new Error(`Invalid published ${locale} CMS collection result`);
      return [locale,result];
    })));
    const entries=Object.fromEntries(locales.map(locale=>[locale,collectionResults[locale].entries.map(entry=>normalizeEntry(entry,locale))]));
    for (const locale of locales) {
      const ids=new Set(); for (const entry of entries[locale]) { if(ids.has(entry.id))throw new Error(`Duplicate published CMS tour ID ${entry.id}`); ids.add(entry.id); }
    }
    const vocabulary={en:{},zh:{}};
    const hints=locales.map(locale=>collectionResults[locale].cacheHint);
    await Promise.all(locales.map(async locale=>{
      const defs=await getDefs({locale});
      for (const def of defs) {
        const bucket=bucketAliases.get(def.name);
        if (!bucket || !def.collections?.includes('tours')) continue;
        const result=await getTerms(def.name,{locale,includeCounts:false});
        hints.push(result.cacheHint);
        vocabulary[locale][bucket]=flattenTerms(result.data).map(taxonomyRow);
      }
    }));
    attachTermTranslations(vocabulary);
    const catalogues=Object.fromEntries(await Promise.all(locales.map(async locale=>{
      const catalogue=buildCatalogue(entries[locale],compatibility,locale,{taxonomyTerms:vocabulary[locale]});
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
