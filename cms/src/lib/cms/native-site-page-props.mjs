import { confirmedTourAlternates } from '../../../../src/lib/seo-pages.ts';
import { absolutePublicUrl } from '../../../../src/lib/seo.ts';

const LOCALES = new Set(['en', 'zh']);

function decoded(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function routeParts(pathname, origin, base) {
  let path;
  try { path = new URL(pathname, origin).pathname; } catch { return null; }
  const prefix = base && base !== '/' ? `/${String(base).replace(/^\/+|\/+$/g, '')}` : '';
  if (prefix) {
    if (path === prefix) path = '/';
    else if (path.startsWith(`${prefix}/`)) path = path.slice(prefix.length);
    else return null;
  }
  return path.split('/').filter(Boolean).map(decoded);
}

function localeAndParts(parts) {
  if (!parts) return null;
  if (parts[0] === 'zh') return { locale: 'zh', parts: parts.slice(1) };
  if (parts[0] && LOCALES.has(parts[0])) return null;
  return { locale: 'en', parts };
}

function catalogue(catalogues, locale) {
  const result = catalogues?.[locale];
  return result && Array.isArray(result.tours) && result.terms && typeof result.terms === 'object' ? result : null;
}

/** A category page exists only for a term some published tour of that locale uses. */
function usedTerm(catalogues, locale, bucket, slug) {
  const rows = catalogue(catalogues, locale)?.terms?.[bucket];
  const found = Array.isArray(rows) && rows.find(item => item?.slug === slug);
  return found && found.count > 0 ? found : null;
}

const CATEGORY_ROUTES = Object.freeze({ style: ['styles', 'style'], destination: ['destinations', 'destination'] });

function categoryAlternates(catalogues, locale, route, slug, origin, base) {
  const [bucket] = CATEGORY_ROUTES[route];
  if (!usedTerm(catalogues, 'en', bucket, slug) || !usedTerm(catalogues, 'zh', bucket, slug)) return [];
  const prefix = base && base !== '/' ? `/${String(base).replace(/^\/+|\/+$/g, '')}` : '';
  const en = absolutePublicUrl(origin, `${prefix}/tours/${route}/${slug}`);
  const zh = absolutePublicUrl(origin, `${prefix}/zh/tours/${route}/${slug}`);
  return [{ lang: 'en', href: en }, { lang: 'zh', href: zh }, { lang: 'x-default', href: en }];
}

/**
 * Maps only existing public route shapes to the props their unchanged Astro
 * templates already consume. The middleware owns catalogue loading and turns a
 * null result into a normal 404 before rendering.
 */
export function resolveNativePageProps({ pathname, params = {}, origin = 'https://qualitour.ca', base = '/', catalogues, reviews = [] } = {}) {
  const parsed = localeAndParts(routeParts(pathname, origin, base));
  if (!parsed) return null;
  const { locale, parts } = parsed;
  const current = catalogue(catalogues, locale);
  if (!current) return null;

  if (parts.length === 1 && parts[0] === 'tours') return {};
  if (parts.length === 2 && parts[0] === 'tours' && parts[1] === 'featured') return {};

  if (parts.length === 2 && parts[0] === 'tours') {
    const slug = decoded(params.slug || parts[1]);
    const tour = current.tours.find(item => decoded(item?.slug) === slug);
    if (!tour) return null;
    const languages = { en: catalogue(catalogues, 'en')?.tours || [], zh: catalogue(catalogues, 'zh')?.tours || [] };
    const alternates = confirmedTourAlternates(tour, locale, languages, origin, base);
    const reviewTourId = locale === 'en' ? tour.id : alternates.length ? tour.translations?.en?.id : undefined;
    return {
      tour,
      reviews: Array.isArray(reviews) ? reviews.filter(review => {
        const ids = review?.related_tours;
        return reviewTourId !== undefined && (Array.isArray(ids) ? ids.includes(reviewTourId) : ids === reviewTourId);
      }).slice(0, 6) : [],
      alternates,
      duplicateTitle: current.tours.filter(other => other?.title?.rendered === tour?.title?.rendered).length > 1,
    };
  }

  if (parts.length === 3 && parts[0] === 'tours') {
    const slug = decoded(params.slug || parts[2]);
    const route = parts[1];
    const mapping = CATEGORY_ROUTES[route];
    if (!mapping) return null;
    const selected = usedTerm(catalogues, locale, mapping[0], slug);
    return selected ? { [mapping[1]]: selected, alternates: categoryAlternates(catalogues, locale, route, slug, origin, base) } : null;
  }
  return null;
}
