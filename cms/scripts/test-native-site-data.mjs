import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeSiteData } from '../src/lib/cms/native-site-data.mjs';
import { optimizeTourPresentations } from '../src/lib/cms/native-site-image.mjs';

const compatibility={schema:1,locales:{
  en:{tours:{},terms:{categories:[],tags:[],activities:[],destinations:[],durations:[],types:[]}},
  zh:{tours:{},terms:{categories:[],tags:[],activities:[],destinations:[],durations:[],types:[]}},
}};
const taxonomyNames=['destinations','travel_styles','travel_regions','cruise_types'];
const row=(locale,id,slug,title)=>({id:locale==='zh'?`${locale}/${slug}`:slug,slug,seo:{title:`${locale} SEO`,description:null,canonical:null,image:null,noIndex:false},data:{id,status:'published',locale,publishedAt:new Date('2026-11-12T00:00:00Z'),translationGroup:'pair-1',title,hero:{meta:{storageKey:`${locale}-hero.jpg`},width:1200,height:800},terms:{destinations:[{id:`term-${locale}`,name:'destinations',slug:locale==='zh'?'banff-zh':'banff',label:locale==='zh'?'班夫':'Banff',children:[],locale,translationGroup:'term-pair'}]}}});

function harness({context={request:true},error,lookup,seoImage}={}){
  const calls=[],taxonomyCalls=[];
  const entries={en:[row('en','native-en','native-en','Native EN')],zh:[row('zh','native-zh','native-zh','原生中文')]};
  if(seoImage!==undefined)entries.en[0].seo.image=seoImage;
  const api=createNativeSiteData({
    compatibility,
    ...(lookup?{lookupMediaStorageKeys:lookup}:{}),
    getContext:()=>context,
    getCollection:async(type,filter)=>{calls.push({type,filter});return error?{entries:[],error:new Error('database failed'),cacheHint:{}}:{entries:entries[filter.locale],cacheHint:{tags:[`collection:${filter.locale}`]}};},
    getTaxonomyDefs:async({locale})=>taxonomyNames.map(name=>({name,collections:['tours'],locale})),
    getTaxonomyTermsWithCacheHint:async(name,{locale})=>{
      taxonomyCalls.push({name,locale});
      return {data:name==='destinations'?[{id:`term-${locale}`,name,slug:locale==='zh'?'banff-zh':'banff',label:locale==='zh'?'班夫':'Banff',children:[],locale,translationGroup:'term-pair'}]:[],cacheHint:{tags:[`taxonomy:${name}`]}};
    },
    presentTours:optimizeTourPresentations,
  });
  return {api,calls,taxonomyCalls,entries};
}

test('loads every published locale without a limit and links native translations and terms',async()=>{
  const {api,calls,taxonomyCalls}=harness();
  const catalogues=await api.getNativeSiteCatalogues();
  assert.equal(calls.length,2);
  for(const call of calls){assert.equal(call.type,'tours');assert.equal(call.filter.status,'published');assert.equal(Object.hasOwn(call.filter,'limit'),false);assert.deepEqual(call.filter.orderBy,{published_at:'desc'});}
  assert.deepEqual(catalogues.en.tours[0].translations.zh,{id:'native-zh',slug:'native-zh'});
  assert.deepEqual(catalogues.en.tours[0].nativeSeo,{title:'en SEO'});
  assert.equal(catalogues.en.tours[0].optimizedHero.width,1200);
  assert.equal(catalogues.en.tours[0].optimizedHero.height,800);
  assert.doesNotMatch(catalogues.en.tours[0].optimizedHero.srcSet,/1280w|1920w/);
  assert.deepEqual(catalogues.zh.tours[0].translations.en,{id:'native-en',slug:'native-en'});
  assert.deepEqual(catalogues.en.terms.destinations.map(term=>({slug:term.slug,count:term.count,parent:term.parent})),[{slug:'banff',count:1,parent:0}]);
  assert.deepEqual(catalogues.en.tours[0].tour_terms.destinationScope,['banff']);
  assert.deepEqual(catalogues.zh.terms.destinations.map(term=>term.slug),['banff-zh']);
  assert.deepEqual(taxonomyCalls.map(call=>`${call.locale}:${call.name}`).sort(),[
    'en:cruise_types','en:destinations','en:travel_regions','en:travel_styles',
    'zh:cruise_types','zh:destinations','zh:travel_regions','zh:travel_styles',
  ]);
  assert.deepEqual(await api.getNativeSiteCacheHint(),{tags:['collection:en','collection:zh','taxonomy:destinations','taxonomy:travel_styles','taxonomy:travel_regions','taxonomy:cruise_types']});
  assert.equal(calls.length,2,'cache hint must share the same request-scoped load');
});

test('memoizes only within one request context and retries after failures',async()=>{
  const context={request:1};
  const {api,calls}=harness({context});
  await Promise.all([api.getNativeSiteCatalogues(),api.getNativeSiteCatalogues()]);
  assert.equal(calls.length,2);
  context.request=2;
  await api.getNativeSiteCatalogues();
  assert.equal(calls.length,2,'the same context object remains the same request identity');
  const failed=harness({error:true});
  await assert.rejects(failed.api.getNativeSiteCatalogues(),/database failed/);
  await assert.rejects(failed.api.getNativeSiteCatalogues(),/database failed/);
  assert.equal(failed.calls.length,4,'failed request memo is evicted so callers can retry');
});

test('does not create an isolate cache when no request context exists',async()=>{
  const {api,calls}=harness({context:null});
  await api.getNativeSiteCatalogues();
  await api.getNativeSiteCatalogues();
  assert.equal(calls.length,4);
});

test('SEO image media IDs resolve to the public storage-key route; unresolved IDs are dropped',async()=>{
  const lookups=[];
  const lookup=async ids=>{lookups.push([...ids]);return new Map([['01MEDIA',"hero/01 share.png"]]);};
  const found=harness({lookup,seoImage:'01MEDIA'});
  const catalogues=await found.api.getNativeSiteCatalogues();
  assert.deepEqual(lookups,[['01MEDIA']]);
  assert.deepEqual(catalogues.en.tours[0].nativeSeo,{title:'en SEO',image:'/_emdash/api/media/file/hero/01%20share.png'});
  const missing=harness({lookup:async()=>new Map(),seoImage:'01GONE'});
  assert.deepEqual((await missing.api.getNativeSiteCatalogues()).en.tours[0].nativeSeo,{title:'en SEO'});
  const absolute=harness({lookup:async()=>{throw new Error('must not look up URLs');},seoImage:'https://cdn.example.test/share.jpg'});
  assert.equal((await absolute.api.getNativeSiteCatalogues()).en.tours[0].nativeSeo.image,'https://cdn.example.test/share.jpg');
});
