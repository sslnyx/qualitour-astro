// Frontend Worker for qualitour.ca: every public page is a static asset (no Worker request, no D1).
// Only the paths listed under assets.run_worker_first reach this script; they belong to the CMS Worker
// (`qualitour`) and are forwarded over a service binding as a same-origin reverse proxy:
//   /api/transfer/*   booking API
//   (the booking pages /book/{manage,return,receipt}/<id> are served from this Worker's own /book asset)
//   /_image           image transform (fallback)   /_emdash/api/media/file/*    public media
// The CMS Worker pins its public origin (booking Origin check, Stripe return URLs), so the proxy presents the
// request under the CMS origin and maps the answer back. The CMS admin is NOT proxied: passkeys are bound to
// the CMS host, which stays reachable on its own address.

const FORWARDED = [/^\/api\/transfer(?:\/|$)/, /^\/_image$/, /^\/_emdash\/api\/media\/file\//];
// A guest's booking pages (manage, return from Stripe, receipt) are the booking page itself; the page reads the booking
// id from its address. Serving /book from this Worker's own assets keeps the page and its scripts from the same release
// (the CMS Worker's copy can be newer or older than the last site release).
const BOOKING_PAGE = /^\/(zh\/)?book\/(?:manage|return|receipt)\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function isBookingPagePath(pathname) {
  return BOOKING_PAGE.test(pathname);
}

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
    if (isBookingPagePath(url.pathname)) {
      if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
      const page = await env.ASSETS.fetch(new Request(new URL(url.pathname.startsWith('/zh/') ? '/zh/book' : '/book', url.origin)));
      const headers = new Headers(page.headers);
      headers.set('Cache-Control', 'no-store'); headers.set('X-Robots-Tag', 'noindex'); headers.set('Referrer-Policy', 'no-referrer');
      return new Response(page.body, { status: page.status, headers });
    }
    if (!isForwardedPath(url.pathname)) return env.ASSETS.fetch(request);
    const cmsOrigin = new URL(env.CMS_ORIGIN).origin;
    return toPublicResponse(await env.CMS.fetch(toCmsRequest(request, cmsOrigin), { redirect: 'manual' }), cmsOrigin, url.origin);
  },
};
