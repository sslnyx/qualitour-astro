import { readFile, mkdir, rename, writeFile, stat, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCmsReader, CMS_ORIGIN } from './read-client.mjs';
import { buildCatalogue, retainPublicTranslations, contentHash, sortToursByPublishedAt } from './legacy-adapter.mjs';

const snapshotPath = () => resolve('.astro/cms-content/public-catalogue.json');
const compatPath = () => resolve('src/data/cms-legacy-compat.json');
const SCHEMA = 2;
const MAX_AGE_MS = 15 * 60 * 1000;
let cached, cachedStamp, loading;
let compatCached, compatStamp;
export function cmsEnabled() {
  const source = process.env.TOUR_CONTENT_SOURCE || 'emdash';
  if (!['emdash','wordpress'].includes(source)) throw new Error('TOUR_CONTENT_SOURCE must be emdash or wordpress');
  return source === 'emdash';
}
async function compatibility() {
  const info=await stat(compatPath());const stamp=`${info.mtimeMs}:${info.size}`;
  if(stamp!==compatStamp){const value=JSON.parse(await readFile(compatPath(),'utf8'));compatCached={value,hash:contentHash(value)};compatStamp=stamp;}
  return compatCached;
}

/** Only the public adapter output is cached; raw API responses never reach this file. */
export async function syncCmsSnapshot({ reader = createCmsReader() } = {}) {
  // A failed explicit refresh must not leave an apparently usable stale catalogue.
  await rm(snapshotPath(), { force:true }); cached = undefined; cachedStamp = undefined;
  const {value:compat,hash:compatibilityHash} = await compatibility();
  if (compat.schema !== 1) throw new Error('Unsupported CMS compatibility manifest');
  const locales = {};
  // Sequential locales also avoid concurrent refresh-token rotation in the CLI store.
  for (const locale of ['en','zh']) locales[locale] = buildCatalogue(await reader.listPublished(locale),compat,locale);
  retainPublicTranslations(locales);
  const result = { schema:SCHEMA, origin:CMS_ORIGIN, generatedAt:new Date().toISOString(), compatibilityHash, locales };
  await mkdir(resolve('.astro/cms-content'),{recursive:true});
  const tmp = `${snapshotPath()}.${process.pid}.partial`;
  await writeFile(tmp,JSON.stringify(result)+'\n',{mode:0o600}); await rename(tmp,snapshotPath());
  console.log(`[CMS] Live read complete: ${locales.en.tours.length} English, ${locales.zh.tours.length} Chinese tours; ${locales.en.excluded.length+locales.zh.excluded.length} proof fixtures excluded`);
  return result;
}

async function snapshot() {
  let info;
  try { info=await stat(snapshotPath()); } catch(error) {
    if (error.code!=='ENOENT') throw error;
    if (!loading) loading=syncCmsSnapshot().finally(()=>{loading=undefined;});
    await loading; info=await stat(snapshotPath());
  }
  const stamp=`${info.mtimeMs}:${info.size}`;
  const value=cached && stamp===cachedStamp ? cached : JSON.parse(await readFile(snapshotPath(),'utf8'));
  if (value.origin!==CMS_ORIGIN || !value.locales?.en?.tours?.length || !value.locales?.zh?.tours?.length) throw new Error('Invalid CMS build snapshot; run npm run sync:cms');
  const age=Date.now()-Date.parse(value.generatedAt);
  if(value.schema!==SCHEMA||!Number.isFinite(age)||age< -60000||age>MAX_AGE_MS||value.compatibilityHash!==(await compatibility()).hash){
    if(!loading)loading=syncCmsSnapshot().finally(()=>{loading=undefined;});
    await loading;return snapshot();
  }
  cached=value; cachedStamp=stamp; return value;
}
const language = lang => {if(!lang || lang==='en')return 'en';if(lang==='zh')return 'zh';throw new Error('Unsupported CMS locale');};
export async function getCmsTours(params={},lang) {
  let tours=(await snapshot()).locales[language(lang)].tours;
  const filterTerms={categories:'categories',tags:'tags',destinations:'destinations'};
  for(const [param,field] of Object.entries(filterTerms)) if(params[param]?.length) tours=tours.filter(tour=>tour.tour_terms[field].some(term=>params[param].includes(term.id)));
  if(params.search){const query=params.search.toLocaleLowerCase();tours=tours.filter(tour=>(tour.title.rendered+' '+tour.excerpt.rendered).toLocaleLowerCase().includes(query));}
  if(params.orderby==='date')tours=sortToursByPublishedAt(tours,params.order);
  else if(params.orderby==='title')tours=[...tours].sort((a,b)=>a.title.rendered.localeCompare(b.title.rendered)*(params.order==='asc'?1:-1));
  else if(params.orderby==='id')tours=[...tours].sort((a,b)=>(a.id-b.id)*(params.order==='asc'?1:-1));
  else if(params.order==='asc')tours=[...tours].reverse();
  const size=params.per_page||100,offset=((params.page||1)-1)*size;
  return structuredClone(tours.slice(offset,offset+size));
}
export async function getAllCmsTours(lang) {return structuredClone((await snapshot()).locales[language(lang)].tours);}
export async function getCmsTourBySlug(slug,lang) {
  let decoded;try{decoded=decodeURIComponent(slug);}catch{decoded=slug;}
  return (await getAllCmsTours(lang)).find(tour=>{try{return decodeURIComponent(tour.slug)===decoded;}catch{return tour.slug===slug;}})||null;
}
const taxonomyFields={'tour_category':'categories','tour_tag':'tags','tour-activity':'activities','tour-destination':'destinations','tour_duration':'durations','tour_type':'types'};
export async function getCmsTerms(taxonomy,lang) {
  const field=taxonomyFields[taxonomy];if(!field)throw new Error('Unsupported CMS taxonomy');
  return structuredClone((await snapshot()).locales[language(lang)].terms[field]);
}
