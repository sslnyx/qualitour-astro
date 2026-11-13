import {defineMiddleware} from 'astro:middleware';
import {getRequestContext} from 'emdash';
import {getNativeSiteCatalogues,getNativeSiteCacheHint,getNativeTourDetail} from './native-site-data.mjs';
import {getGoogleReviews} from './native-site-api.mjs';
import {resolveNativePageProps} from './native-site-page-props.mjs';
import {nativeSiteRoute} from './native-site-policy.mjs';
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
 const mode=getRequestContext();
 if(mode?.preview||mode?.editMode||context.url.searchParams.has('_preview')||context.url.searchParams.has('_edit'))return failure(404,'Page not found');
 try{
  const catalogues=await getNativeSiteCatalogues();
  let props={};
  if(!['home','simple','tours','featured'].includes(route.kind)){
   props=resolveNativePageProps({pathname:route.pathname,params:route.params,origin:context.site?.origin||context.url.origin,base:'/',catalogues,reviews:await getGoogleReviews()});
   if(!props){context.cache.set(false);return failure(404,'Page not found');}
   if(route.kind==='tour'){
    const full=await getNativeTourDetail(route.locale,props.tour);
    if(!full){context.cache.set(false);return failure(404,'Page not found');}
    props={...props,tour:full};
   }
  }
  context.locals.qualitourPageProps=props;
  if(context.request.headers.has('Authorization')||context.request.headers.has('Cookie'))context.cache.set(false);
  else {const hint=await getNativeSiteCacheHint();context.cache.set({...hint,tags:[...new Set(['tours',...(hint?.tags||[])])],maxAge:300});}
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
