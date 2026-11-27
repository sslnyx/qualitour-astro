import compatibility from '../../../../src/data/cms-legacy-compat.json' with { type: 'json' };
import { buildCatalogue } from '../../../../src/lib/cms/legacy-adapter.mjs';

export const NATIVE_PROOF_LOCALE = 'zh';
export const DEFAULT_NATIVE_TOUR_ID = '01M77CFJT9M7H2YPYV1J8GF8PV';
export const PROOF_FIXTURE_IDS = Object.freeze([
  '01M75S22W89VBB2VD299MVP3TK',
  '01M75S913P35FB1Z6DP6MHG17G',
]);
const proofIds = new Set(PROOF_FIXTURE_IDS);
const widths = [480, 960, 1280, 1920];
const mediaOrigins = new Set([
  'https://qualitour-cms-free-test.qualitour.workers.dev',
  'https://qualitour.qualitour.workers.dev',
  'https://qualitour.ca',
]);

const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const finiteDimension = (value, fallback) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : fallback;

export function assertPublicProofRequest(url, context) {
  if (url?.searchParams?.has('_preview') || context?.editMode === true || context?.preview) {
    throw new Error('Native public proof does not allow preview or edit mode');
  }
}

function normalizeEntry(entry, locale = NATIVE_PROOF_LOCALE) {
  const data = entry?.data;
  if (!data || typeof data !== 'object') throw new Error('Invalid native CMS entry');
  const id = text(data.id);
  if (!id) throw new Error('Native CMS entry is missing its stable ID');
  if (data.status !== 'published') throw new Error(`Native CMS entry ${id} is not published`);
  if (data.locale !== locale) throw new Error(`Native CMS entry ${id} has a locale mismatch`);
  const publishedAt = data.publishedAt instanceof Date ? data.publishedAt.toISOString() : data.publishedAt;
  return { id, status: data.status, locale: data.locale, publishedAt, data };
}

function validateMedia(data) {
  for (const field of ['hero', 'brochure']) {
    if (data[field] != null && !mediaFilePath(data[field])) throw new Error(`Native CMS ${field} must use a safe storage key`);
  }
  if (data.gallery != null && !Array.isArray(data.gallery)) throw new Error('Native CMS gallery must be an array');
  for (const item of data.gallery || []) if (!mediaFilePath(item?.image)) throw new Error('Native CMS gallery must use safe storage keys');
}

export function mediaFilePath(value) {
  const key = value?.meta?.storageKey;
  if (typeof key !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) || key.split('/').includes('..')) return;
  return `/_emdash/api/media/file/${key}`;
}

export function imageTransformUrl(value, width) {
  const href = typeof value === 'string' && value.startsWith('/_emdash/api/media/file/') ? value : mediaFilePath(value);
  if (!href || !Number.isSafeInteger(width) || width < 1 || width > 4096) return;
  return `/_image?href=${encodeURIComponent(href)}&w=${width}&f=webp&q=80`;
}

function knownMediaPath(value) {
  if (typeof value !== 'string' || /[\\\u0000-\u001f]/.test(value)) return;
  try {
    const url = new URL(value, 'https://native-proof.invalid');
    if (url.origin !== 'https://native-proof.invalid' && !mediaOrigins.has(url.origin)) return;
    const prefix = '/_emdash/api/media/file/';
    if (!url.pathname.startsWith(prefix)) return;
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    return mediaFilePath({ meta: { storageKey: key } });
  } catch { return; }
}

function transformHtmlImages(html) {
  if (typeof html !== 'string' || !/<img\b/i.test(html)) return html;
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const source = tag.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    const path = knownMediaPath(source?.[2]);
    if (!source || !path) return '';
    const optimized = imageTransformUrl(path, 960).replaceAll('&', '&amp;');
    return tag
      .replace(/\s+(?:srcset|sizes|data-src|data-srcset|data-lazy-src)\s*=\s*(["']).*?\1/gi, '')
      .replace(source[0], `src="${optimized}"`);
  });
}

function transformInlinePresentation(value) {
  if (typeof value === 'string') return transformHtmlImages(value);
  if (Array.isArray(value)) return value.map(transformInlinePresentation).filter(item => item !== undefined);
  if (!value || typeof value !== 'object') return value;
  if (value.type === 'image' && value.value && typeof value.value === 'object') {
    const path = knownMediaPath(value.value.url);
    if (!path) return;
    return { ...value, value: { ...value.value, url: imageTransformUrl(path, 1200) } };
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, transformInlinePresentation(item)]));
}

function presentMedia(tour, entry) {
  const result = structuredClone(tour);
  const { data } = entry;
  validateMedia(data);
  result.content = transformInlinePresentation(result.content);
  result.goodlayers_data = transformInlinePresentation(result.goodlayers_data);
  const hero = mediaFilePath(data.hero);
  result.featured_image_url = hero || '';
  if (hero) {
    const width = finiteDimension(data.hero?.width, 1920);
    const height = finiteDimension(data.hero?.height, 1080);
    result.optimizedImageUrl = imageTransformUrl(hero, 960);
    result.optimizedHero = {
      src: imageTransformUrl(hero, 1920),
      srcSet: widths.map(size => `${imageTransformUrl(hero, size)} ${size}w`).join(', '),
      sizes: '100vw', width, height,
    };
  } else {
    delete result.optimizedImageUrl;
    delete result.optimizedHero;
  }
  const photos = {};
  result.goodlayers_data ||= {};
  result.goodlayers_data.tour_gallery = (data.gallery || []).map(item => {
    const url = mediaFilePath(item.image);
    const width = finiteDimension(item.image?.width, 1600);
    const height = finiteDimension(item.image?.height, 1067);
    photos[url] = { thumbnail: imageTransformUrl(url, 600), full: imageTransformUrl(url, 1600), width, height };
    return { url, alt: text(item.alt), caption: text(item.caption) };
  });
  result.optimizedPhotos = photos;
  if (Object.hasOwn(data, 'brochure')) {
    const url = mediaFilePath(data.brochure);
    result.tour_meta ||= {};
    result.tour_meta.brochure = url ? { ID: 0, id: 0, url, title: text(data.brochure?.filename) || 'brochure.pdf', filename: text(data.brochure?.filename) || 'brochure.pdf', mime_type: 'application/pdf' } : false;
  }
  return result;
}

function markers(entries) {
  return entries.map(entry => {
    const locale = entry?.data?.locale;
    if (!['en', 'zh'].includes(locale)) throw new Error('Native proof fixture locale mismatch');
    const normalized = normalizeEntry(entry, locale);
    if (!proofIds.has(normalized.id)) throw new Error('Unexpected native proof fixture');
    return { id: normalized.id, title: text(normalized.data.title), summary: text(normalized.data.summary) };
  });
}

export function createNativeProofCatalogue(entries, { compatibility: source = compatibility, proofEntries = [] } = {}) {
  const normalized = entries.map(entry => normalizeEntry(entry));
  for (const entry of normalized) validateMedia(entry.data);
  const catalogue = buildCatalogue(normalized, source, NATIVE_PROOF_LOCALE);
  const bySource = new Map(normalized.filter(entry => catalogue.claims.has(entry.id)).map(entry => [entry.data.source_key, entry]));
  const tours = catalogue.tours.map(tour => presentMedia(tour, bySource.get(`wp-zh-${tour.id}`)));
  const cards = tours.map(tour => {
    const entry = bySource.get(`wp-zh-${tour.id}`);
    return { ...tour, slug: entry.id };
  });
  return {
    catalogue: { ...catalogue, tours },
    cards,
    proofMarkers: markers([...normalized.filter(entry => proofIds.has(entry.id)).map(entry => ({ data: entry.data })), ...proofEntries]),
  };
}

export function createNativeProofTour(entry, { compatibility: source = compatibility } = {}) {
  const normalized = normalizeEntry(entry);
  if (proofIds.has(normalized.id)) throw new Error('Synthetic proof fixtures are not public tour detail pages');
  validateMedia(normalized.data);
  const catalogue = buildCatalogue([normalized], source, NATIVE_PROOF_LOCALE);
  return presentMedia(catalogue.tours[0], normalized);
}

export function nativeProofTourHref(id) {
  if (typeof id !== 'string' || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)) throw new Error('Invalid native tour ID');
  return `/native-proof/zh/tours/${id}`;
}

export function nativeProofNavTerms(source = compatibility) {
  const terms = source?.locales?.zh?.terms;
  if (!terms) throw new Error('Missing zh compatibility terms');
  return { destinations: terms.destinations || [], activities: terms.activities || [], types: terms.types || [], durations: terms.durations || [] };
}
