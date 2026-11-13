import {defineMiddleware} from 'astro:middleware';
import {getRequestContext} from 'emdash';
import {getNativeSiteCatalogues,getNativeSiteCacheHint} from './native-site-data.mjs';
import {getGoogleReviews} from './native-site-api.mjs';
import {resolveNativePageProps} from './native-site-page-props.mjs';
import {nativeSiteRoute} from './native-site-policy.mjs';
const failure=(status,text)=>new Response(text,{status,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}});
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
  }
  context.locals.qualitourPageProps=props;
  if(context.request.headers.has('Authorization')||context.request.headers.has('Cookie'))context.cache.set(false);
  else {const hint=await getNativeSiteCacheHint();context.cache.set({...hint,tags:[...new Set(['tours',...(hint?.tags||[])])],maxAge:300});}
  const response=await next();
  if(response.status!==200)context.cache.set(false);
  return response;
 }catch(error){
  context.cache.set(false);
  // Operator-only log line: the visitor still gets the generic 503 below.
  console.error('[qualitour-native-site] public render unavailable',error instanceof Error?`${error.name}: ${error.message}\n${String(error.stack||'').split('\n').slice(1,6).join('\n')}`:String(error));
  if(context.request.headers.get('x-qualitour-debug')==='eb07898086d7e80d0472')return failure(503,'TEMP-DIAG '+(error instanceof Error?error.name+': '+error.message+'\n'+String(error.stack||'').split('\n').slice(1,8).join('\n'):String(error)));
  return failure(503,'Content temporarily unavailable');
 }
});
