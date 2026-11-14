import supportSource from '../../data/native-site-support.json' with { type: 'json' };
import { getNativeSiteCatalogues } from './native-site-data.mjs';

const localeOf=lang=>lang==='zh'?'zh':'en';
const clone=value=>structuredClone(value);
const decoded=value=>{try{return decodeURIComponent(value);}catch{return value;}};

export function createNativeSiteApi({getCatalogues=getNativeSiteCatalogues,support=supportSource}={}) {
  const catalogue=async lang=>(await getCatalogues())[localeOf(lang)];
  async function getAllTours(lang){return (await catalogue(lang)).tours;}
  async function getTours(params={},lang){
    let rows=[...await getAllTours(lang)];
    if(typeof params.slug==='string')rows=rows.filter(tour=>decoded(tour.slug)===decoded(params.slug));
    if(typeof params.search==='string'&&params.search.trim()){const query=params.search.trim().toLocaleLowerCase();rows=rows.filter(tour=>`${tour.title?.rendered||''} ${tour.excerpt?.rendered||''}`.toLocaleLowerCase().includes(query));}
    if(typeof params.style==='string')rows=rows.filter(tour=>(tour.tour_terms?.styles||[]).some(term=>term.slug===params.style));
    if(typeof params.destination==='string')rows=rows.filter(tour=>(tour.tour_terms?.destinationScope||[]).includes(params.destination));
    if(params.orderby){const direction=params.order==='asc'?1:-1;rows.sort((a,b)=>{if(params.orderby==='title')return String(a.title?.rendered||'').localeCompare(String(b.title?.rendered||''))*direction;if(params.orderby==='date')return (Date.parse(a.date)-Date.parse(b.date))*direction;return String(a.id).localeCompare(String(b.id), 'en', {numeric:true})*direction;});}
    const perPage=Number.isSafeInteger(params.per_page)&&params.per_page>0?params.per_page:100;
    const page=Number.isSafeInteger(params.page)&&params.page>0?params.page:1;
    return rows.slice((page-1)*perPage,page*perPage);
  }
  async function getTourBySlug(slug,lang){return (await getAllTours(lang)).find(tour=>decoded(tour.slug)===decoded(slug))||null;}
  async function getAllTourSlugs(lang){return (await getAllTours(lang)).map(tour=>tour.slug);}
  const terms=async(bucket,lang)=>((await catalogue(lang)).terms[bucket]||[]).map(term=>({...term,parent:term.parent??0,count:term.count??0}));
  async function getSiteNavData(lang){const [styles,cruiseTypes,regions,destinations]=await Promise.all([terms('styles',lang),terms('cruiseTypes',lang),terms('regions',lang),terms('destinations',lang)]);return {styles,cruiseTypes,regions,destinations,transfers:[]};}
  async function getGoogleReviews(){
    // The CMS collection is the source; the bundled snapshot only covers a build where the collection could not be read.
    const fromCms=(await catalogue('en')).reviews;
    return clone(Array.isArray(fromCms)?fromCms:Array.isArray(support.reviews)?support.reviews:[]);
  }
  async function getBusinessReviews(){
    const reviews=await getGoogleReviews();if(!reviews.length)return null;
    return {name:'Qualitour - Vancouver Branch',formatted_address:'Vancouver, BC, Canada',rating:reviews.reduce((sum,row)=>sum+Number(row.rating||0),0)/reviews.length,user_ratings_total:reviews.length,reviews:reviews.filter(row=>row.rating>2)};
  }
  async function getCompanyInfo(){return clone(support.company);}
  return {getTours,getAllTours,getTourBySlug,getAllTourSlugs,getSiteNavData,getGoogleReviews,getBusinessReviews,getCompanyInfo};
}

export function formatPhone(digits){
  const clean=String(digits||'').replace(/\D/g,'');const national=clean.startsWith('1')&&clean.length===11?clean.slice(1):clean;
  if(national.length===10)return {display:`(${national.slice(0,3)}) ${national.slice(3,6)}-${national.slice(6)}`,tel:`+1${national}`};
  return {display:clean,tel:`+${clean}`};
}

const runtime=createNativeSiteApi();
export const getTours=runtime.getTours;
export const getAllTours=runtime.getAllTours;
export const getTourBySlug=runtime.getTourBySlug;
export const getAllTourSlugs=runtime.getAllTourSlugs;
export const getSiteNavData=runtime.getSiteNavData;
export const getGoogleReviews=runtime.getGoogleReviews;
export const getBusinessReviews=runtime.getBusinessReviews;
export const getCompanyInfo=runtime.getCompanyInfo;
