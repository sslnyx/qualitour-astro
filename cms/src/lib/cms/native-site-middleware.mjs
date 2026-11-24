import {defineMiddleware} from 'astro:middleware';
import {getRequestContext} from 'emdash';
import {env} from 'cloudflare:workers';
import {getNativeSiteCatalogues,getNativeSiteCacheHint,getNativeTourDetail,setNativeSnapshotKv} from './native-site-data.mjs';
import {getGoogleReviews} from './native-site-api.mjs';
import {resolveNativePageProps} from './native-site-page-props.mjs';
import {nativeSiteRoute} from './native-site-policy.mjs';
import { VEHICLE_WEBSITE_RELEASE_HEADER } from './vehicle-website-release.mjs';
import { loadVehicleWebsiteRelease } from './vehicle-website-release.mjs';
import {getImage} from 'astro:assets';
import {transferProductBySlug} from '../../../../src/lib/transfer-products.ts';
import {routeNativeBooking} from '../../../../src/server/native-booking/index.mjs';
/**
 * Astro loads the configured image service with a lazy import the first time any <Image> renders. In the Worker
 * that import fails once a page's data is in memory ("InvalidImageService"), blanking every page that renders an
 * image, so it is done once per isolate before any data is loaded. A failure is retried on the next request.
 */
let imageServiceWarm;
const warmImageService=()=>imageServiceWarm??=getImage({src:'/qualitour-image-service-warmup.png',width:8,height:8,format:'webp'}).then(()=>true,()=>{imageServiceWarm=undefined;return false;});
const failure=(status,text,reason)=>new Response(text,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow',...(reason?{'X-Qualitour-Error':reason}:{})}});
/** Class and a short message only (no stack, no markup), so a fallback response says why without leaking internals. */
const safeReason=error=>String(error instanceof Error?`${error.name}: ${error.message}`:error).replace(/[^\w .:,'()/-]+/g,' ').replace(/\s+/g,' ').trim().slice(0,140);
export const onRequest=defineMiddleware(async(context,next)=>{
 const route=nativeSiteRoute(context.url.pathname);
 if(!route){
  // The injected home uses a rest locale parameter: never let arbitrary URLs
  // become English duplicate homepages. Infrastructure routes are unaffected.
  if(context.params.lang&&!['zh'].includes(context.params.lang)&&!context.url.pathname.includes('/cms-proof/'))return failure(404,'Page not found');
  return next();
 }
 if(route.redirect)return context.redirect(route.redirect+context.url.search,307);
 await warmImageService();
 setNativeSnapshotKv(env.SESSION);
 const mode=getRequestContext();
 if(mode?.preview||mode?.editMode||context.url.searchParams.has('_preview')||context.url.searchParams.has('_edit'))return failure(404,'Page not found');
 try{
  const vehicleReleaseRoute=route.pathname==='/private-transfers'||route.pathname==='/zh/private-transfers';
  if(context.request.headers.has(VEHICLE_WEBSITE_RELEASE_HEADER)&&!vehicleReleaseRoute)return failure(404,'Page not found');
  const vehicleWebsiteRelease=vehicleReleaseRoute?await loadVehicleWebsiteRelease(context.request,env):null;
  if(vehicleWebsiteRelease)context.locals.qualitourVehicleWebsiteRelease=vehicleWebsiteRelease;
  let props={};
  let transferDetailsAvailable=true;
  if(route.kind==='transfer-product'){
   const product=transferProductBySlug(route.params.slug);
   const url=new URL('/api/transfer/details/'+product.activityId,'https://qualitour.qualitour.workers.dev');
   const details=await routeNativeBooking(new Request(url),env,{});
   if(details?.ok)context.locals.qualitourTransferDetails=await details.json();
   // Prefer the release snapshot on the next render when the details store was temporarily unavailable.
   transferDetailsAvailable=Boolean(details?.ok);
  } else if(!['home','simple','tours','featured'].includes(route.kind)){
   const catalogues=await getNativeSiteCatalogues();
   props=resolveNativePageProps({pathname:route.pathname,params:route.params,origin:context.site?.origin||context.url.origin,base:'/',catalogues,reviews:await getGoogleReviews()});
   if(!props){context.cache.set(false);return failure(404,'Page not found');}
   if(route.kind==='tour'){
    const full=await getNativeTourDetail(route.locale,props.tour);
    if(!full){context.cache.set(false);return failure(404,'Page not found');}
    props={...props,tour:full};
   }
  }
  context.locals.qualitourPageProps=props;
  if(context.request.headers.has('Authorization')||context.request.headers.has('Cookie')||vehicleWebsiteRelease||!transferDetailsAvailable)context.cache.set(false);
  else {const hint=await getNativeSiteCacheHint();context.cache.set({...hint,tags:[...new Set(['tours',...(hint?.tags||[])])],maxAge:86400,swr:604800});}
  const response=await next();
  if(response.status!==200){context.cache.set(false);return response;}
  // Astro streams the page, so a render error after the response starts ends the stream silently (a 200 with
  // nothing in it). Reading it here turns that into the real error, which the outer Worker reports and falls back on.
  const html=await response.arrayBuffer();
  if(html.byteLength===0)throw new Error('The page rendered an empty body');
  return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
 }catch(error){
  context.cache.set(false);
  // Operator-only log line: the visitor still gets the generic 503 below.
  console.error('[qualitour-native-site] public render unavailable',error instanceof Error?`${error.name}: ${error.message}\n${String(error.stack||'').split('\n').slice(1,6).join('\n')}`:String(error));
  return failure(503,'Content temporarily unavailable',safeReason(error));
 }
});
