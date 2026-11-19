// Permanent redirects from the WordPress site's addresses to their new equivalents, written into the site release as
// the static-assets `_redirects` file. Every target must be a page the release publishes (checked by the tests).
//
// Deliberately left out (no new equivalent; they answer 404): cart, checkout, my-account, login, dashboard, customer-*,
// crawler, maintenance, hidden-page, portfolio-*, newsletter-2, /hotels-accommodations and /insurance-services.

export const LEGACY_PAGE_REDIRECTS = Object.freeze([
  ['/tours', '/tours'], // old listing used a trailing slash; handled by the slash rule, kept here for the record
  ['/search-tours', '/tours'],
  ['/yellowknife', '/tours/destination/geo-yellowknife'],
  ['/whitehorse', '/tours/destination/geo-whitehorse'],
  ['/taiwan-tours-waves-of-wonder', '/tours/destination/geo-tw'],
  ['/africa', '/tours/destination/geo-continent-af'],
  ['/viking-tours', '/tours/style/cruises'],
  ['/attractions', '/tours/style/tickets-experiences'],
  ['/private-ski-shuttles', '/private-transfers'],
  ['/private-transfers/pt-yvr-cruise', '/private-transfers'],
  ['/private-transfers/pt-yvr-sunpeaks', '/private-transfers'],
  ['/private-transfers/pt-yvr-seattle', '/private-transfers'],
  ['/private-transfers/pt-whistler-yvr', '/private-transfers'],
  ['/how-the-payment-works', '/faq'],
  ['/customer-review', '/reviews'],
  ['/homepage-中文-中国', '/zh'],
].filter(([from, to]) => from !== to));

// The WordPress site kept its Chinese pages under /zh/ with the same names; where the Chinese catalogue has no page of
// that kind, the visitor lands on the Chinese tour list. /zh/air-tickets-to-china has no new equivalent (404).
export const LEGACY_ZH_PAGE_REDIRECTS = Object.freeze([
  ['/zh/search-tours', '/zh/tours'],
  ['/zh/yellowknife', '/zh/tours/destination/geo-yellowknife'],
  ['/zh/whitehorse', '/zh/tours/destination/geo-whitehorse'],
  ['/zh/banff', '/zh/tours/destination/geo-banff'],
  ['/zh/attractions', '/zh/tours/style/tickets-experiences'],
  ['/zh/turkey', '/zh/tours'],
  ['/zh/atlantic-canada', '/zh/tours'],
]);

/** The `_redirects` text: specific pages first (first match wins), then /tour/<slug>, then the trailing-slash rule. */
export function legacyRedirectRules() {
  const lines = [];
  for (const [from, to] of [...LEGACY_PAGE_REDIRECTS, ...LEGACY_ZH_PAGE_REDIRECTS]) {
    // WordPress addressed non-ASCII slugs percent-encoded in lower case, which is how a browser or crawler asks for them.
    const encoded = encodeURI(from).replace(/%[0-9A-F]{2}/g, hex => hex.toLowerCase());
    for (const source of new Set([from, encoded])) lines.push(`${source}/ ${to} 301`, `${source} ${to} 301`);
  }
  // The WordPress tour address was /tour/<slug>/ ; every slug exists unchanged under /tours/.
  // Chinese tours were /zh/tour/<slug>/ and their slugs are unchanged too.
  lines.push('/tour/:slug/ /tours/:slug 301', '/tour/:slug /tours/:slug 301');
  lines.push('/zh/tour/:slug/ /zh/tours/:slug 301', '/zh/tour/:slug /zh/tours/:slug 301');
  // The platform answers a trailing slash with a temporary 307; search engines are told it is permanent instead.
  lines.push('/*/ /:splat 301');
  return lines.join('\n') + '\n';
}
