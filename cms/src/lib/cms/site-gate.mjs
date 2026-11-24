import { nativeSiteRoute } from './native-site-policy.mjs';

// The public pages are served by the static Worker `qualitour-site`. The CMS Worker still renders them, but only for
// the site build (which presents SITE_BUILD_KEY); everyone else is sent to the static site. Admin, API, media and the
// /_image fallback are not pages and stay open. With no key configured the gate is off, so a missing secret can never
// lock the pages out.
const FIXED_PAGES = new Set(['/booking-status', '/zh/booking-status', '/404', '/500']);
const DEFAULT_PUBLIC_ORIGIN = 'https://qualitour-site.qualitour.workers.dev';
export const SITE_BUILD_HEADER = 'X-Qualitour-Site-Build';

export function isSitePage(pathname) {
  return Boolean(nativeSiteRoute(pathname)) || FIXED_PAGES.has(pathname);
}

function sameSecret(given, secret) {
  if (typeof given !== 'string' || given.length !== secret.length) return false;
  let difference = 0;
  for (let i = 0; i < secret.length; i += 1) difference |= given.charCodeAt(i) ^ secret.charCodeAt(i);
  return difference === 0;
}

/** True only for a request made by the site-release job. */
export function hasSiteBuildKey(request, env) {
  const secret = env?.SITE_BUILD_KEY;
  return typeof secret === 'string' && secret !== '' && sameSecret(request.headers.get(SITE_BUILD_HEADER), secret);
}

/** Returns a redirect to the static site for a visitor, or null when the request may be rendered here. */
export function siteGate(request, env) {
  if (!['GET', 'HEAD'].includes(request.method)) return null;
  const url = new URL(request.url);
  if (!isSitePage(url.pathname)) return null;
  const secret = env?.SITE_BUILD_KEY;
  if (typeof secret !== 'string' || !secret) return null;
  if (hasSiteBuildKey(request, env)) return null;
  const origin = new URL(env.PUBLIC_SITE_ORIGIN || DEFAULT_PUBLIC_ORIGIN).origin;
  return new Response(null, {
    status: 302,
    headers: { Location: new URL(url.pathname + url.search, origin).href, 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
