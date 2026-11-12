import { DurableObject } from 'cloudflare:workers';
import handler, { PluginBridge } from '@emdash-cms/cloudflare/worker';
import { durableExecutionContext, fetchFreeRuntime } from './lib/cms/free-runtime.mjs';

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

export default {
  ...handler,
  fetch(request: Request, env: RuntimeEnv, context: ExecutionContext) {
    return fetchFreeRuntime(handler, request, env, context);
  },
};
