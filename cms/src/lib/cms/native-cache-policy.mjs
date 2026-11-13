import {nativeSiteRoute} from './native-site-policy.mjs';
import {collectInvalidationTags} from 'astro/cache/provider-utils';
export const isNativeProofPath = path => /^\/native-proof\/zh(?:\/tours\/[A-Za-z0-9_-]+)?\/?$/.test(path);
export function validateProofTags(tags){
 if(!Array.isArray(tags)||tags.length<1||tags.length>128||tags.some(x=>typeof x!=='string'||x.length>256||!(/^[!-~]+$/.test(x))||x.includes(',')))throw Error('Invalid native proof cache tags');
 return [...new Set(tags)];
}
/** Preserve Astro's official response headers; target only the named proof cache. */
export function scopedCloudflareProvider(nativeProvider,purge){
 return {...nativeProvider,async invalidate(options){
  const tags=collectInvalidationTags(options);if(!tags.length)return;
  const result=await purge(validateProofTags(tags));
  if(result?.success!==true)throw Error('Native proof cache invalidation failed');
 }};
}

const hasPrivateHeaders = request => request.headers.has('Authorization') || request.headers.has('Cookie');
export function forwardNativeProof(entrypoint, request) {
 const url=new URL(request.url), visitor=nativeSiteRoute(url.pathname);
 if(visitor&&(url.searchParams.has('_preview')||url.searchParams.has('_edit')))return Promise.resolve(new Response('Page not found',{status:404,headers:{'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'}}));
 if(hasPrivateHeaders(request))return entrypoint.fetch(request,{cache:'no-store'});
 return visitor?entrypoint.fetch(request,{cf:{cacheKey:url.pathname}}):entrypoint.fetch(request);
}
export function privateProofResponse(request, response) {
 return hasPrivateHeaders(request) || response.status !== 200 || response.headers.has('Set-Cookie');
}

/**
 * The assets service matches a non-ASCII file name only when its percent-escapes are uppercase (%E8), while the
 * links on our own pages spell them in lowercase (%e8). Without this, every Chinese tour page whose render failed
 * missed its prerendered page and came back as a 503.
 */
const assetRequest = request => {
 const url=new URL(request.url), pathname=url.pathname.replace(/%[0-9a-f]{2}/gi,escape=>escape.toUpperCase());
 if(pathname===url.pathname)return request;
 url.pathname=pathname;
 return new Request(url,request);
};

const reasonOf = error => String(error instanceof Error ? `${error.name}: ${error.message}` : error).replace(/[^\w .:,'()/-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);

/**
 * A visitor page whose live render failed is answered from the matching prerendered asset, if one exists,
 * instead of an error page or a blank one. "Failed" means a 503, a response whose body cannot be read to the
 * end, or a 200 whose body is empty. The answer is never cached and X-Qualitour-Rendered names it so
 * monitoring can tell a static answer from a native one; X-Qualitour-Fallback-Reason says why. A good native
 * page is returned as the fully read body (visitor pages are small enough to buffer).
 */
export async function withStaticFallback(request, response, assets) {
 const get=['GET','HEAD'].includes(request.method);
 if(!get||!nativeSiteRoute(new URL(request.url).pathname))return response;
 let reason=response.headers.get('X-Qualitour-Error')||undefined, failed=response.status===503, body;
 if(response.status===200&&request.method==='GET'){
  try{body=await response.arrayBuffer();if(body.byteLength===0){failed=true;reason=`empty body (length ${response.headers.get('content-length')??'-'}, type ${response.headers.get('content-type')??'-'}, encoding ${response.headers.get('content-encoding')??'-'}, ${response.body===null?'null body':'had body'})`;}}
  catch(error){failed=true;reason=`body stream failed: ${reasonOf(error)}`;}
 }
 if(!failed)return body===undefined?response:new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
 if(!assets)return body===undefined?response:new Response(null,{status:503,headers:{'Cache-Control':'private, no-store','X-Qualitour-Fallback-Reason':reason||'unknown'}});
 let fallback;
 try{fallback=await assets.fetch(assetRequest(request));}catch{return response.status===200?new Response('Content temporarily unavailable',{status:503,headers:{'Cache-Control':'private, no-store','X-Qualitour-Fallback-Reason':reason||'unknown'}}):response;}
 if(fallback.status!==200)return response.status===200?new Response('Content temporarily unavailable',{status:503,headers:{'Cache-Control':'private, no-store','X-Qualitour-Fallback-Reason':reason||'unknown'}}):response;
 const headers=new Headers(fallback.headers);
 headers.set('Cache-Control','private, no-store');
 headers.set('Cloudflare-CDN-Cache-Control','no-store');
 headers.set('X-Qualitour-Rendered','static-fallback');
 if(reason)headers.set('X-Qualitour-Fallback-Reason',reason);
 return new Response(request.method==='HEAD'?null:fallback.body,{status:200,statusText:fallback.statusText,headers});
}

/**
 * Derived images are addressed by content: the source is a media storage key (a new upload is a new key) and the
 * width/format are in the URL. A 200 can therefore be cached for a year by browsers and the edge, instead of the
 * endpoint's default `max-age=0, must-revalidate`, which re-transformed every image on every view.
 */
export function immutableImageResponse(response) {
 if(response.status!==200||!(response.headers.get('Content-Type')||'').startsWith('image/'))return response;
 const headers=new Headers(response.headers);
 headers.set('Cache-Control','public, max-age=31536000, immutable');
 headers.delete('Set-Cookie');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
