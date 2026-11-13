import cloudflareProvider from '@astrojs/cloudflare/cache/provider';
import {scopedCloudflareProvider} from './native-cache-policy.mjs';
import {bumpNativeSnapshotVersion} from './native-snapshot-kv.mjs';
export default function(){
 return scopedCloudflareProvider(cloudflareProvider(),async tags=>{
  // Publishing runs in the CMS Durable Object; purge must run in the cached
  // named Worker entrypoint, not the caller's uncached execution context.
  const {exports: loopback, env}=await import('cloudflare:workers');
  // Replace the catalogue version first, so pages re-rendered after the purge cannot be built from the old snapshot.
  await bumpNativeSnapshotVersion(env.SESSION);
  return loopback.NativeProofCache.invalidateNativeProof(tags);
 });
}
