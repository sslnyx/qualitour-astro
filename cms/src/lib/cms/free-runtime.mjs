/** Keep static-site/build handling in Astro's normal adapter path. */
function usesCmsRuntime(pathname) {
  return pathname === '/_emdash' || pathname.startsWith('/_emdash/') ||
    /^(?:\/zh)?\/cms-proof\/tours(?:\/|$)/.test(pathname);
}

/** Forward the original Request/Response, including auth, cookies and streams. */
export function fetchFreeRuntime(handler, request, env, context) {
  const mode = env.EMDASH_CMS_EXECUTION || 'worker';
  if (!['worker', 'durable'].includes(mode)) throw new Error('Invalid CMS execution mode');
  if (mode === 'worker' || !usesCmsRuntime(new URL(request.url).pathname)) {
    return handler.fetch(request, env, context);
  }
  if (!env.CMS_RUNTIME) throw new Error('CMS_RUNTIME binding is required in Durable mode');
  const id = env.CMS_RUNTIME.idFromName('qualitour-cms');
  return env.CMS_RUNTIME.get(id).fetch(request);
}

/** Astro 14's handler uses waitUntil; unsupported origin fallback stays explicit. */
export function durableExecutionContext(state) {
  return {
    waitUntil(promise) { state.waitUntil(promise); },
    props: {},
    exports: state.exports,
    passThroughOnException() {
      throw new Error('Origin pass-through is unavailable in the Durable CMS runtime');
    },
  };
}
