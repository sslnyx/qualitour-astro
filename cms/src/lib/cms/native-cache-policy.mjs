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
 return hasPrivateHeaders(request) ? entrypoint.fetch(request, {cache:'no-store'}) : entrypoint.fetch(request);
}
export function privateProofResponse(request, response) {
 return hasPrivateHeaders(request) || response.status !== 200 || response.headers.has('Set-Cookie');
}
