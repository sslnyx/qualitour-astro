// Frontend Worker for qualitour.ca: every public page is a static asset (no Worker request, no D1).
// Only the paths listed under assets.run_worker_first reach this script; they belong to the CMS Worker
// (`qualitour`) and are forwarded over a service binding as a same-origin reverse proxy:
//   /api/transfer/*   booking API          /book/{manage,return,receipt}/<id>   transactional pages
//   /_image           image transform (fallback)   /_emdash/api/media/file/*    public media
// The CMS Worker pins its public origin (booking Origin check, Stripe return URLs), so the proxy presents the
// request under the CMS origin and maps the answer back. The CMS admin is NOT proxied: passkeys are bound to
// the CMS host, which stays reachable on its own address.

const FORWARDED = [/^\/api\/transfer(?:\/|$)/, /^\/(?:zh\/)?book\/(?:manage|return|receipt)\//, /^\/_image$/, /^\/_emdash\/api\/media\/file\//];

export function isForwardedPath(pathname) {
  return FORWARDED.some(pattern => pattern.test(pathname));
}

/** Present `request` to the CMS Worker under its own origin. Only this Worker's own public origin is rewritten. */
export function toCmsRequest(request, cmsOrigin) {
  const url = new URL(request.url);
  const publicOrigin = url.origin;
  const out = new Request(new URL(url.pathname + url.search, cmsOrigin), request);
  const origin = out.headers.get('Origin');
  if (origin === publicOrigin) out.headers.set('Origin', cmsOrigin);
  const referer = out.headers.get('Referer');
  if (referer && referer.startsWith(publicOrigin + '/')) out.headers.set('Referer', cmsOrigin + referer.slice(publicOrigin.length));
  out.headers.set('X-Forwarded-Host', url.host);
  return out;
}

/** Map the CMS answer back to the public origin (redirects only; bodies of the forwarded paths hold no absolute URLs). */
export function toPublicResponse(response, cmsOrigin, publicOrigin) {
  const location = response.headers.get('Location');
  if (!location || !location.startsWith(cmsOrigin)) return response;
  const headers = new Headers(response.headers);
  headers.set('Location', publicOrigin + location.slice(cmsOrigin.length));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!isForwardedPath(url.pathname)) return env.ASSETS.fetch(request);
    const cmsOrigin = new URL(env.CMS_ORIGIN).origin;
    return toPublicResponse(await env.CMS.fetch(toCmsRequest(request, cmsOrigin), { redirect: 'manual' }), cmsOrigin, url.origin);
  },
};
