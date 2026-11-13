import { collectInlineImageSources } from '../../../../src/lib/inline-images.mjs';
import { collectTourPhotoSources, mapWithConcurrency } from '../../../../src/lib/image-delivery.mjs';

const mediaOrigins=new Set(['https://qualitour-cms-free-test.qualitour.workers.dev','https://qualitour.qualitour.workers.dev','https://qualitour.ca']);
const widths=[480,960,1280,1920];
const mediaDimensionsKey=Symbol.for('qualitour:native-media-dimensions');
const textUrl=value=>typeof value==='string'&&value.trim()?value:typeof value?.url==='string'&&value.url.trim()?value.url:null;

export function getTourImageUrl(tour) {
  const value=tour?.featured_image_url;
  if(typeof value==='string'&&value.trim())return value;
  if(value&&typeof value==='object')for(const key of ['full','medium_large','large','medium','thumbnail']){const found=textUrl(value[key]);if(found)return found;}
  const media=tour?._embedded?.['wp:featuredmedia']?.[0];
  return media?.media_details?.sizes?.large?.source_url||media?.media_details?.sizes?.medium_large?.source_url||media?.media_details?.sizes?.full?.source_url||media?.source_url||null;
}

export function ownedMediaPath(value) {
  if(typeof value!=='string'||/[\\\u0000-\u001f]/.test(value))return;
  try{
    const url=new URL(value,'https://native-site.invalid');
    if(url.origin!=='https://native-site.invalid'&&!mediaOrigins.has(url.origin))return;
    if(!url.pathname.startsWith('/_emdash/api/media/file/'))return;
    const key=decodeURIComponent(url.pathname.slice('/_emdash/api/media/file/'.length));
    if(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)||key.split('/').includes('..'))return;
    return `/_emdash/api/media/file/${key}`;
  }catch{return;}
}

function transformHref(value) {
  const owned=ownedMediaPath(value);if(owned)return owned;
  if(typeof value!=='string')return;
  try{const url=new URL(value);if((url.hostname==='qualitour.ca'||url.hostname.endsWith('.qualitour.ca'))&&url.pathname.startsWith('/wp-content/uploads/'))return url.href;}catch{return;}
}
function claimsCmsMedia(value){return typeof value==='string'&&/(?:^|\/)\_emdash\/api\/media\/file\//.test(value);}

export function imageTransformUrl(value,width,quality=80) {
  const href=transformHref(value);
  if(!href||!Number.isSafeInteger(width)||width<1||width>4096)return;
  return `/_image?href=${encodeURIComponent(href)}&w=${width}&f=webp&q=${quality}`;
}

export async function getImageSafe(options={}) {
  const source=typeof options.src==='string'?options.src:options.src?.src;
  if(typeof source!=='string'||!source)return {src:'',attributes:{},srcSet:{values:[],attribute:''}};
  if(source.startsWith('/_image?'))return {src:source,attributes:{width:options.width,height:options.height},srcSet:{values:[],attribute:''}};
  const width=Number.isSafeInteger(options.width)&&options.width>0?options.width:1920;
  const quality=Number.isSafeInteger(options.quality)&&options.quality>0&&options.quality<=100?options.quality:80;
  const transformed=imageTransformUrl(source,width,quality);
  if(!transformed&&claimsCmsMedia(source))throw new Error('Refusing unsafe CMS media fallback');
  if(!transformed)return {src:source,attributes:{width:options.width,height:options.height},srcSet:{values:[],attribute:''}};
  const candidates=(Array.isArray(options.widths)?options.widths:[]).filter(value=>Number.isSafeInteger(value)&&value>0&&value<=4096).map(value=>({url:imageTransformUrl(source,value,quality),descriptor:`${value}w`}));
  return {src:transformed,attributes:{width:options.width,height:options.height},srcSet:{values:candidates,attribute:candidates.map(item=>`${item.url} ${item.descriptor}`).join(', ')}};
}

export async function optimizeResponsiveImage(source,{width=1920,height=1080,sizes='100vw'}={}) {
  const candidates=[...new Set([...widths.filter(value=>value<=width),width])].sort((a,b)=>a-b);
  const image=await getImageSafe({src:source,width,height,widths:candidates,quality:80});
  return {src:image.src,srcSet:image.srcSet.attribute,sizes,width,height};
}

export async function optimizeTourPresentation(tour) {
  const source=getTourImageUrl(tour);
  const dimensions=tour?.[mediaDimensionsKey]||{};
  const heroSize=source&&dimensions[source];
  const optimizedHero=tour.optimizedHero||(source?await optimizeResponsiveImage(source,heroSize):undefined);
  const optimizedPhotos={...(tour.optimizedPhotos||{})};
  for(const raw of collectTourPhotoSources(tour))if(transformHref(raw)&&!optimizedPhotos[raw]){
    const size=dimensions[raw]||{width:1600,height:1067};
    optimizedPhotos[raw]={thumbnail:imageTransformUrl(raw,600),full:imageTransformUrl(raw,1600),width:size.width,height:size.height};
  }
  const optimizedInlineImages={...(tour.optimizedInlineImages||{})};
  for(const raw of collectInlineImageSources(tour))if(transformHref(raw)&&!optimizedInlineImages[raw]){
    optimizedInlineImages[raw]={src:imageTransformUrl(raw,1200),srcSet:[480,960,1200].map(width=>`${imageTransformUrl(raw,width)} ${width}w`).join(', '),sizes:'100vw'};
  }
  return {...tour,optimizedHero,optimizedPhotos,optimizedInlineImages};
}

/**
 * Catalogue-wide presentation: only the responsive hero, decorated in place. The per-photo and inline
 * derivatives of every tour made the whole catalogue too large for the Worker's memory; the detail page
 * adds them for its single tour (optimizeTourPresentation keeps this hero and the media-size hints).
 */
export async function optimizeTourHero(tour) {
  if(tour.optimizedHero)return tour;
  const source=getTourImageUrl(tour);
  const heroSize=source&&(tour?.[mediaDimensionsKey]||{})[source];
  if(source)tour.optimizedHero=await optimizeResponsiveImage(source,heroSize);
  return tour;
}
export function optimizeTourHeroes(tours){return mapWithConcurrency(tours,optimizeTourHero,8);}

export function optimizeTourPresentations(tours){return mapWithConcurrency(tours,optimizeTourPresentation,4);}

export async function optimizeTourImages(tours,{width=600,height=450,concurrency=10}={}) {
  return mapWithConcurrency(tours,async tour=>{
    const source=getTourImageUrl(tour);if(!source)return {...tour};
    const image=await getImageSafe({src:source,width,height,quality:80});
    return {...tour,optimizedImageUrl:image.src};
  },concurrency);
}

/** Runtime presentation is additive; serialized CMS/legacy HTML remains the source record. */
export function deepOptimizeTourData(tour){return optimizeTourPresentation(tour);}

export async function optimizeImageUrl(url,width=1920){
  if(!url)return '';
  return (await getImageSafe({src:url,width,quality:80})).src;
}
