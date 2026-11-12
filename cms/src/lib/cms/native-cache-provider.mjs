import cloudflareProvider from '@astrojs/cloudflare/cache/provider';
import {scopedCloudflareProvider} from './native-cache-policy.mjs';
export default function(){
 return scopedCloudflareProvider(cloudflareProvider(),async tags=>{
  // Publishing runs in the CMS Durable Object; purge must run in the cached
  // named Worker entrypoint, not the caller's uncached execution context.
  const {exports: loopback}=await import('cloudflare:workers');
  return loopback.NativeProofCache.invalidateNativeProof(tags);
 });
}
