import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import handler, { PluginBridge } from '@emdash-cms/cloudflare/worker';
import { routeNativeBooking } from '../../src/server/native-booking/index.mjs';
import { durableExecutionContext, fetchFreeRuntime } from './lib/cms/free-runtime.mjs';

import {nativeSiteRoute} from './lib/cms/native-site-policy.mjs';
import { isNativeProofPath, validateProofTags, forwardNativeProof, privateProofResponse, withStaticFallback } from './lib/cms/native-cache-policy.mjs';

export { PluginBridge };

interface RuntimeEnv {
  CMS_RUNTIME: DurableObjectNamespace<QualitourCmsRuntime>;
  EMDASH_CMS_EXECUTION?: string;
  [binding: string]: unknown;
}

// Compute lives here; D1, R2, KV, URLs, users and passkeys stay unchanged.
// A SQLite-backed class is required for availability on Workers Free, even
// though this class does not use its own storage as the CMS database.
export class QualitourCmsRuntime extends DurableObject<RuntimeEnv> {
  #observedForwarding = false;

  async fetch(request: Request): Promise<Response> {
    const hasCf = Boolean(request.cf);
    const hasClientIp = Boolean(request.headers.get('cf-connecting-ip'));
    if (!this.#observedForwarding) {
      console.info('[qualitour-cms-runtime] forwarding', { hasCf, hasClientIp });
      this.#observedForwarding = true;
    }
    // EmDash trusts edge IP headers only when cf metadata exists. Refuse to
    // serve if forwarding loses that context: never silently skip auth limits.
    if (!hasCf || !hasClientIp) {
      return new Response('CMS request context unavailable', {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return handler.fetch!(request, this.env,
      durableExecutionContext(this.ctx) as ExecutionContext);
  }
}

/** Only these proof pages enter Workers Cache; existing visitor routes stay static. */
export class NativeProofCache extends WorkerEntrypoint<RuntimeEnv> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const visitor=nativeSiteRoute(url.pathname);
    if ((!visitor && !isNativeProofPath(url.pathname)) || (!visitor && url.search) || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store', 'Cloudflare-CDN-Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    const response = await fetchFreeRuntime(handler, request, this.env, this.ctx);
    const headers = new Headers(response.headers);
    if(!visitor)headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('X-Qualitour-Rendered', crypto.randomUUID());
    headers.set('X-Native-Proof-Rendered', crypto.randomUUID());
    if (privateProofResponse(request, response)) {
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Cloudflare-CDN-Cache-Control', 'no-store');
      headers.delete('Cache-Tag');
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }

  async invalidateNativeProof(tags: unknown) {
    return this.ctx.cache.purge({ tags: validateProofTags(tags) });
  }
}

export default {
  ...handler,
  async fetch(request: Request, env: RuntimeEnv, context: ExecutionContext) {
    const pathname = new URL(request.url).pathname;
    if (pathname.startsWith('/native-proof/') || nativeSiteRoute(pathname)) {
      const proof = (context.exports as { NativeProofCache: { fetch(request: Request): Promise<Response> } }).NativeProofCache;
      const response = await forwardNativeProof(proof, request);
      return withStaticFallback(request, response, env.ASSETS as { fetch(request: Request): Promise<Response> } | undefined);
    }
    const native = await routeNativeBooking(request, env, context);
    if (native) return native;
    return fetchFreeRuntime(handler, request, env, context);
  },
};
