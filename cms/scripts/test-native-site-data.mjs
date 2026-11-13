import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeSiteData } from '../src/lib/cms/native-site-data.mjs';
import { optimizeTourHeroes } from '../src/lib/cms/native-site-image.mjs';

const compatibility={schema:1,locales:{
  en:{tours:{},terms:{categories:[],tags:[],activities:[],destinations:[],durations:[],types:[]}},
  zh:{tours:{},terms:{categories:[],tags:[],activities:[],destinations:[],durations:[],types:[]}},
}};
const taxonomyNames=['destinations','travel_styles','travel_regions','cruise_types'];
const row=(locale,id,slug,title)=>({id:locale==='zh'?`${locale}/${slug}`:slug,slug,seo:{title:`${locale} SEO`,description:null,canonical:null,image:null,noIndex:false},data:{id,status:'published',locale,publishedAt:new Date('2026-11-12T00:00:00Z'),translationGroup:'pair-1',title,hero:{meta:{storageKey:`${locale}-hero.jpg`},width:1200,height:800},terms:{destinations:[{id:`term-${locale}`,name:'destinations',slug:locale==='zh'?'banff-zh':'banff',label:locale==='zh'?'班夫':'Banff',children:[],locale,translationGroup:'term-pair'}]}}});

function harness({context={request:true},error,lookup,seoImage,paging,getEntry}={}){
  const calls=[],taxonomyCalls=[];
  const entries={en:[row('en','native-en','native-en','Native EN')],zh:[row('zh','native-zh','native-zh','原生中文')]};
  if(seoImage!==undefined)entries.en[0].seo.image=seoImage;
  if(paging){
    entries.en=[1,2,3].map(n=>{const r=row('en',n===1?'native-en':`native-en-${n}`,n===1?'native-en':`native-en-${n}`,`Native EN ${n}`);r.data.translationGroup=`group-${n}`;return r;});
    entries.zh[0].data.translationGroup='group-1';
  }
  const api=createNativeSiteData({
    compatibility,
    ...(lookup?{lookupMediaStorageKeys:lookup}:{}),
    ...(getEntry?{getEntry:getEntry(entries)}:{}),
    getContext:()=>context,
    readTourPages:async function*(locale){
      calls.push({locale});
      if(error)throw new Error('database failed');
      if(paging){for(const [index,entry] of entries[locale].entries()){paging.seen.push({locale,page:index});yield [entry];}return;}
      yield entries[locale];
    },
    getTaxonomyDefs:async({locale})=>taxonomyNames.map(name=>({name,collections:['tours'],locale})),
    getTaxonomyTermsWithCacheHint:async(name,{locale})=>{
      taxonomyCalls.push({name,locale});
      return {data:name==='destinations'?[{id:`term-${locale}`,name,slug:locale==='zh'?'banff-zh':'banff',label:locale==='zh'?'班夫':'Banff',children:[],locale,translationGroup:'term-pair'}]:[],cacheHint:{tags:[`taxonomy:${name}`]}};
    },
    presentTours:optimizeTourHeroes,
  });
  return {api,calls,taxonomyCalls,entries};
}

test('loads every published locale without a limit and links native translations and terms',async()=>{
  const {api,calls,taxonomyCalls}=harness();
  const catalogues=await api.getNativeSiteCatalogues();
  assert.equal(calls.length,2,'one read per locale');
  assert.deepEqual(calls.map(call=>call.locale),['en','zh'],'locales load one at a time');
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
  assert.deepEqual(await api.getNativeSiteCacheHint(),{tags:['tours','taxonomy:destinations','taxonomy:travel_styles','taxonomy:travel_regions','taxonomy:cruise_types']});
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
  assert.equal(failed.calls.length,2,'failed request memo is evicted so callers can retry (each attempt stops at the first failing read)');
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

test('reads the collection page by page and keeps every entry',async()=>{
  const seen=[];
  const {api,entries}=harness({paging:{seen}});
  const catalogues=await api.getNativeSiteCatalogues();
  assert.deepEqual(seen,[0,1,2].map(page=>({locale:'en',page})).concat([{locale:'zh',page:0}]));
  assert.equal(catalogues.en.tours.length,3);
  assert.deepEqual(catalogues.en.tours.map(tour=>tour.id).sort(),['native-en','native-en-2','native-en-3']);
  assert.ok(entries);
});

test('a page holding only excluded proof fixtures does not fail the load',async()=>{
  const seen=[];
  const {api,entries}=harness({paging:{seen}});
  entries.en[0].id='01M75S22W89VBB2VD299MVP3TK';entries.en[0].data.id='01M75S22W89VBB2VD299MVP3TK';
  const catalogues=await api.getNativeSiteCatalogues();
  assert.deepEqual(catalogues.en.tours.map(tour=>tour.id).sort(),['native-en-2','native-en-3']);
});

test('itinerary data is held packed and unpacked lazily, identically for readers and copies',async()=>{
  const {api}=harness();
  const tour=(await api.getNativeSiteCatalogues()).en.tours[0];
  const descriptor=Object.getOwnPropertyDescriptor(tour,'goodlayers_data');
  assert.equal(typeof descriptor.get,'function','stored as a lazy getter, not a resident object tree');
  assert.equal(descriptor.enumerable,true);
  const first=tour.goodlayers_data;
  assert.ok(first&&typeof first==='object');
  assert.equal(tour.goodlayers_data,first,'unpacked once per tour');
  assert.deepEqual({...tour}.goodlayers_data,first,'spread copies still carry it');
  assert.deepEqual(JSON.parse(JSON.stringify(tour)).goodlayers_data,first);
});

test('a detail page reads one complete entry and keeps the catalogue terms, translations and hero',async()=>{
  const reads=[];
  const {api}=harness({getEntry:entries=>async(type,id,options)=>{reads.push({type,id,locale:options.locale});const entry=structuredClone(entries[options.locale].find(row=>row.id===id));entry.data.overview=[{_type:'block',style:'normal',markDefs:[],children:[{_type:'span',marks:[],text:'Full itinerary text'}]}];return {entry};}});
  const catalogues=await api.getNativeSiteCatalogues();
  const lite=catalogues.en.tours[0];
  assert.equal(lite.entryId,'native-en','catalogue tours remember their CMS entry');
  assert.equal(Object.keys(lite).includes('entryId'),false,'and keep it out of enumerable data');
  const full=await api.getNativeTourDetail('en',lite);
  assert.deepEqual(reads,[{type:'tours',id:'native-en',locale:'en'}]);
  assert.match(full.content.rendered,/Full itinerary text/);
  assert.deepEqual(full.tour_terms,lite.tour_terms);
  assert.deepEqual(full.translations,lite.translations);
  assert.equal(full.optimizedHero,lite.optimizedHero);
  assert.equal(full.slug,lite.slug);
});

test('a detail page for a missing or preview-only entry is not served, and read errors propagate',async()=>{
  const missing=harness({getEntry:()=>async()=>({entry:null})});
  assert.equal(await missing.api.getNativeTourDetail('en',(await missing.api.getNativeSiteCatalogues()).en.tours[0]),null);
  const preview=harness({getEntry:entries=>async(type,id,options)=>({entry:entries[options.locale][0],isPreview:true})});
  assert.equal(await preview.api.getNativeTourDetail('en',(await preview.api.getNativeSiteCatalogues()).en.tours[0]),null);
  const failing=harness({getEntry:()=>async()=>({error:new Error('read failed')})});
  await assert.rejects(failing.api.getNativeTourDetail('en',(await failing.api.getNativeSiteCatalogues()).en.tours[0]),/read failed/);
  await assert.rejects(failing.api.getNativeTourDetail('en',{id:1}),/no CMS entry/);
});
