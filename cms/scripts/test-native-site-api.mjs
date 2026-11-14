import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeSiteApi, formatPhone } from '../src/lib/cms/native-site-api.mjs';

const tours=[
  {id:1,slug:'one',date:'2026-01-02',title:{rendered:'One'},excerpt:{rendered:''},featured_media:0,tour_terms:{destinations:[{id:10,slug:'geo-ca-bc',name:'British Columbia'}],styles:[{id:20,slug:'day-tours',name:'Day Tours'}],destinationScope:['geo-ca-bc','geo-ca','geo-continent-na']}},
  {id:'native',slug:'native',date:'2026-01-01',title:{rendered:'Native Aurora'},excerpt:{rendered:''},featured_media:0,tour_terms:{destinations:[{id:'term-yukon',slug:'geo-ca-yt',name:'Yukon'}],styles:[],destinationScope:['geo-ca-yt','geo-ca','geo-continent-na']}},
];
const catalogues={en:{tours,terms:{styles:[{id:20,slug:'day-tours',name:'Day Tours',count:1}],cruiseTypes:[],regions:[],destinations:[{id:'na',slug:'geo-continent-na',name:'North America',parent:0,count:2},{id:10,slug:'geo-ca-bc',name:'British Columbia',parent:'ca',count:1}]}},zh:{tours:[],terms:{styles:[],cruiseTypes:[],regions:[],destinations:[]}}};
const support={company:{company_name:'Qualitour',phone:'17789456000',email:'info@example.test',bc_reg:'1',address:{street:'A',city:'B',province:'BC',postal:'C',country:'Canada'},google_maps_url:'',hours:'Open',hours_zh:'開放',social:{facebook:'',instagram:'',youtube:'',xiaohongshu:'',whatsapp:'',wechat:''}},reviews:[{rating:5,text:'Great'},{rating:2,text:'Poor'}]};

test('tour API preserves paging, search, IDs and slug lookup',async()=>{
  const api=createNativeSiteApi({getCatalogues:async()=>catalogues,support});
  assert.deepEqual((await api.getTours({per_page:1,page:2})).map(row=>row.id),['native']);
  assert.deepEqual((await api.getTours({search:'aurora'})).map(row=>row.id),['native']);
  assert.deepEqual((await api.getTours({destination:'geo-ca-yt'})).map(row=>row.id),['native']);
  assert.deepEqual((await api.getTours({destination:'geo-ca'})).map(row=>row.id),[1,'native'],'country filter rolls up city tours');
  assert.deepEqual((await api.getTours({style:'day-tours'})).map(row=>row.id),[1]);
  assert.equal((await api.getTourBySlug('native')).id,'native');
  assert.equal(await api.getTourBySlug('missing'),null);
  assert.deepEqual(await api.getAllTourSlugs(),['one','native']);
});

test('navigation reader exposes the native category buckets only',async()=>{
  const api=createNativeSiteApi({getCatalogues:async()=>catalogues,support});
  const nav=await api.getSiteNavData();
  assert.deepEqual(Object.keys(nav).sort(),['cruiseTypes','destinations','regions','styles','transfers']);
  assert.deepEqual(nav.styles.map(term=>term.slug),['day-tours']);
  assert.equal(nav.destinations[1].parent,'ca');assert.deepEqual(nav.transfers,[]);
  assert.equal((await createNativeSiteApi({getCatalogues:async()=>catalogues,support}).getTours({},'zh')).length,0);
});

test('support snapshot remains exact and review aggregation filters display only',async()=>{
  const api=createNativeSiteApi({getCatalogues:async()=>catalogues,support});
  assert.equal((await api.getCompanyInfo()).social.facebook,'');
  const reviews=await api.getGoogleReviews();reviews[0].rating=1;
  assert.equal((await api.getGoogleReviews())[0].rating,5,'callers cannot mutate the shared support snapshot');
  const business=await api.getBusinessReviews();
  assert.equal(business.rating,3.5);assert.equal(business.user_ratings_total,2);assert.equal(business.reviews.length,1);
  assert.deepEqual(formatPhone('1 (778) 945-6000'),{display:'(778) 945-6000',tel:'+17789456000'});
});

test('reviews come from the CMS catalogue; the bundled snapshot only covers a catalogue without them',async()=>{
  const live=[{id:7,author_name:'From CMS',rating:4,text:'x',time:'1',relative_time_description:'today',profile_photo_url:'',images:[],source:'google'}];
  const bundled={...support,reviews:[{id:1,author_name:'Bundled',rating:5,text:'y',time:'1',relative_time_description:'',profile_photo_url:'',images:[],source:'google'}]};
  const fromCms=createNativeSiteApi({getCatalogues:async()=>({...catalogues,en:{...catalogues.en,reviews:live}}),support:bundled});
  assert.deepEqual((await fromCms.getGoogleReviews()).map(r=>r.author_name),['From CMS']);
  assert.equal((await fromCms.getBusinessReviews()).user_ratings_total,1);
  const fallback=createNativeSiteApi({getCatalogues:async()=>catalogues,support:bundled});
  assert.deepEqual((await fallback.getGoogleReviews()).map(r=>r.author_name),['Bundled']);
  const hidden=createNativeSiteApi({getCatalogues:async()=>({...catalogues,en:{...catalogues.en,reviews:[]}}),support:bundled});
  assert.deepEqual(await hidden.getGoogleReviews(),[],'every review unpublished means none are shown, not the bundled ones');
  const copy=await fromCms.getGoogleReviews();copy[0].author_name='changed';
  assert.equal((await fromCms.getGoogleReviews())[0].author_name,'From CMS','callers get their own copy');
});
