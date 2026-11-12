import { confirmedTourAlternates } from '../../../../src/lib/seo-pages.ts';

const LOCALES = new Set(['en', 'zh']);
const DESTINATION_ALIASES = Object.freeze({ rockies: 'banff', maritimes: 'atlantic-canada' });

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

function term(catalogues, locale, field, slug, { zhFallback = false } = {}) {
  const current = catalogue(catalogues, locale)?.terms?.[field];
  const exact = Array.isArray(current) && current.find(item => item?.slug === slug);
  if (exact || locale !== 'zh' || !zhFallback) return exact || null;
  const english = catalogue(catalogues, 'en')?.terms?.[field];
  return Array.isArray(english) ? english.find(item => item?.slug === slug) || null : null;
}

function publicDestination(catalogues, locale, slug) {
  const field = 'destinations';
  const target = DESTINATION_ALIASES[slug] || slug;
  if (locale === 'en') return term(catalogues, 'en', field, target);
  const destinations = catalogue(catalogues, 'zh')?.terms?.[field];
  if (!Array.isArray(destinations)) return null;
  return destinations.find(item => item?.translations?.en === target || item?.slug === `${target}-zh` || item?.slug?.replace(/-zh$/, '') === target) || null;
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
    const mapping = {
      activity: ['activities', 'activity'],
      destination: ['destinations', 'destination'],
      duration: ['durations', 'duration'],
      type: ['types', 'tourType'],
    }[route];
    if (!mapping) return null;
    const selected = term(catalogues, locale, mapping[0], slug, { zhFallback: true });
    return selected ? { [mapping[1]]: selected } : null;
  }

  if (parts.length === 2 && parts[0] === 'destinations') {
    const destination = publicDestination(catalogues, locale, decoded(params.slug || parts[1]));
    return destination ? { destination } : null;
  }
  return null;
}
