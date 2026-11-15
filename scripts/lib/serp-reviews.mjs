// Google reviews via SerpApi (engine google_maps_reviews) for the weekly CMS sync. Pure and injectable for tests.
export const DATA_ID = '0x548674772811435d:0xf1c5dc03b49a9927'; // Qualitour Vancouver
const SERP_URL = 'https://serpapi.com/search.json';
const MAX_PAGES = 5;

/** A Google reviewer has one review per place, so the contributor id in the profile link is a stable identity. */
export function contributorId(url) {
  return /\/contrib\/(\d+)/.exec(String(url || ''))?.[1] ?? null;
}

const fallbackKey = (name, rating, text) => `${String(name).trim().toLowerCase()}|${Number(rating)}|${String(text).trim().slice(0, 80)}`;

/** Identity keys of a review: the contributor id when there is one, else author + rating + text start. */
export function identityKeys({ author_url, author_name, rating, text, source_id }) {
  const keys = [];
  const id = contributorId(author_url);
  if (id) keys.push('c:' + id);
  if (source_id) keys.push('s:' + source_id);
  keys.push('f:' + fallbackKey(author_name, rating, text));
  return keys;
}

const imageUrl = value => typeof value === 'string' ? value : value?.thumbnail || value?.url || value?.link || '';

/** SerpApi review → CMS `google_reviews` data (the same shape import-google-reviews.mjs writes). */
export function mapSerpReview(review) {
  const when = Date.parse(review.iso_date || review.review_datetime || '');
  if (!Number.isFinite(when)) throw new Error('Review ' + review.review_id + ' has no valid date');
  const reviewId = review.review_id;
  if (!reviewId) throw new Error('Review without review_id');
  const text = String(review.snippet ?? review.extracted_snippet?.original ?? '');
  return {
    slug: `review-serp-${String(reviewId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40)}`,
    data: {
      author_name: String(review.user?.name || 'Anonymous'),
      source_id: `serp-${reviewId}`,
      rating: Number(review.rating) || 0,
      text,
      reviewed_at: new Date(when).toISOString(),
      author_url: String(review.user?.link || ''),
      profile_photo: '',
      profile_photo_source: String(review.user?.thumbnail || ''),
      local_guide: Boolean(review.user?.local_guide),
      reviewer_reviews: Number(review.user?.reviews || 0),
      reviewer_photos: Number(review.user?.photos || 0),
      images: (Array.isArray(review.images) ? review.images : []).map(imageUrl).filter(Boolean),
      source: 'google',
    },
  };
}

/**
 * Newest reviews first. Stops as soon as a whole page is already known (nothing newer can follow), so a normal week
 * costs one SerpApi search; the first run on an empty list reads up to MAX_PAGES pages.
 */
export async function fetchNewReviews({ apiKey, known, fetchImpl = fetch, maxPages = MAX_PAGES }) {
  if (!apiKey) throw new Error('SERPAPI_KEY missing');
  const fresh = [];
  let token = null;
  let searches = 0;
  for (let page = 1; page <= maxPages; page++) {
    const params = new URLSearchParams({ engine: 'google_maps_reviews', data_id: DATA_ID, hl: 'en', sort_by: 'newestFirst', api_key: apiKey });
    if (token) { params.set('next_page_token', token); params.set('num', '20'); }
    const response = await fetchImpl(`${SERP_URL}?${params}`, { signal: AbortSignal.timeout(60_000) });
    searches++;
    if (!response.ok) throw new Error('SerpApi HTTP ' + response.status);
    const body = await response.json();
    if (body.error) throw new Error('SerpApi: ' + String(body.error).replace(apiKey, '***').slice(0, 120));
    const list = Array.isArray(body.reviews) ? body.reviews : [];
    if (!list.length) {
      if (page === 1) throw new Error('SerpApi returned no reviews for the place'); // it has dozens: treat as a failed lookup, not as "nothing new"
      break;
    }
    let unseen = 0;
    for (const raw of list) {
      const entry = mapSerpReview(raw);
      if (identityKeys(entry.data).some(key => known.has(key))) continue;
      if (fresh.some(other => other.data.source_id === entry.data.source_id)) continue;
      fresh.push(entry); unseen++;
    }
    token = body.serpapi_pagination?.next_page_token;
    if (!unseen || !token) break;
  }
  return { fresh, searches };
}
