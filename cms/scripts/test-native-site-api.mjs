import assert from 'node:assert/strict';
import test from 'node:test';
import { createNativeSiteApi, formatPhone } from '../src/lib/cms/native-site-api.mjs';

const tours=[
  {id:1,slug:'one',date:'2026-01-02',title:{rendered:'One'},excerpt:{rendered:''},featured_media:0,tour_terms:{destinations:[{id:10,slug:'canada',name:'Canada'}],types:[{id:20,slug:'group',name:'Group'}]}},
  {id:'native',slug:'native',date:'2026-01-01',title:{rendered:'Native Aurora'},excerpt:{rendered:''},featured_media:0,tour_terms:{destinations:[{id:'term-yukon',slug:'yukon',name:'Yukon'}],types:[]}},
];
const catalogues={en:{tours,terms:{categories:[],tags:[],activities:[],destinations:[{id:10,slug:'canada',name:'Canada',parent:0,count:1},{id:'term-yukon',slug:'yukon',name:'Yukon',parent:0,count:1}],durations:[],types:[{id:20,slug:'group',name:'Group',count:1}]}},zh:{tours:[],terms:{categories:[],tags:[],activities:[],destinations:[],durations:[],types:[]}}};
const support={company:{company_name:'Qualitour',phone:'17789456000',email:'info@example.test',bc_reg:'1',address:{street:'A',city:'B',province:'BC',postal:'C',country:'Canada'},google_maps_url:'',hours:'Open',hours_zh:'開放',social:{facebook:'',instagram:'',youtube:'',xiaohongshu:'',whatsapp:'',wechat:''}},reviews:[{rating:5,text:'Great'},{rating:2,text:'Poor'}]};

test('tour API preserves paging, search, IDs and slug lookup',async()=>{
  const api=createNativeSiteApi({getCatalogues:async()=>catalogues,support});
  assert.deepEqual((await api.getTours({per_page:1,page:2})).map(row=>row.id),['native']);
  assert.deepEqual((await api.getTours({search:'aurora'})).map(row=>row.id),['native']);
  assert.deepEqual((await api.getTours({destinations:['term-yukon']})).map(row=>row.id),['native']);
  assert.equal((await api.getTourBySlug('native')).id,'native');
  assert.equal(await api.getTourBySlug('missing'),null);
  assert.deepEqual(await api.getAllTourSlugs(),['one','native']);
});

test('taxonomy and navigation readers expose catalogue terms with legacy taxonomy names',async()=>{
  const api=createNativeSiteApi({getCatalogues:async()=>catalogues,support});
  assert.equal((await api.getTourDestinations())[1].taxonomy,'tour-destination');
  assert.equal((await api.getTourTypes())[0].taxonomy,'tour_type');
  const nav=await api.getSiteNavData();
  assert.equal(nav.destinations.length,2);assert.deepEqual(nav.transfers,[]);
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
