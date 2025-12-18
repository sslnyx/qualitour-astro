/**
 * WordPress API Client for Astro SSG
 * 
 * Simplified for static site generation - all data is fetched at build time,
 * so we don't need edge caching, request deduplication, or ISR logic.
 */

import type {
    WPTour,
    WPTourCategory,
    WPTourTag,
    WPTourActivity,
    WPTourDestination,
    WPTourDuration,
    WPTourType,
    WPApiParams,
} from './types';

// Default timeout for fetch requests (30 seconds for large datasets)
const DEFAULT_FETCH_TIMEOUT_MS = 30000;

// Get WordPress API URL from environment (qualitour/v1 custom API)
function getApiUrl(): string {
    const url = import.meta.env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        import.meta.env.PUBLIC_WORDPRESS_API_URL ||
        import.meta.env.WORDPRESS_API_URL ||
        (import.meta.env.DEV ? 'http://qualitour.local/wp-json/qualitour/v1' : '');
    return url.endsWith('/') ? url.slice(0, -1) : url;
}

// Alias for backwards compatibility
function getCustomApiUrl(): string {
    return getApiUrl();
}

// Get auth headers for authenticated requests
function getAuthHeaders(): Record<string, string> {
    const username = import.meta.env.WORDPRESS_AUTH_USER || '';
    const password = import.meta.env.WORDPRESS_AUTH_PASS || '';

    if (username && password) {
        const credentials = btoa(`${username}:${password}`);
        return { Authorization: `Basic ${credentials}` };
    }

    return {};
}

// Generic fetch with timeout and error handling
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Qualitour-Astro/1.0)',
                ...getAuthHeaders(),
                ...options.headers,
            },
        });

        if (!response.ok) {
            console.error(`[Astro API] Request failed for URL: ${url}`);
            console.error(`[Astro API] Status: ${response.status} ${response.statusText}`);
            try {
                const body = await response.text();
                // Check if it's an HTML 404 (wrong URL) or JSON error (API error)
                if (body.trim().startsWith('<')) {
                    console.error(`[Astro API] Received HTML response (likely wrong URL): ${body.substring(0, 200)}...`);
                } else {
                    console.error(`[Astro API] JSON Error Body: ${body.substring(0, 500)}`);
                }
            } catch (e) {
                console.error(`[Astro API] Could not read response body`);
            }
            throw new Error(`WordPress API Error: ${response.status} ${response.statusText}`);
        }

        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

// =====================
// TOUR FUNCTIONS
// =====================

export async function getTours(
    params: WPApiParams = {},
    lang?: string
): Promise<WPTour[]> {
    const customApiUrl = getCustomApiUrl();
    const url = new URL(`${customApiUrl}/tours`);

    // Default params for tour list
    url.searchParams.set('_fields', 'id,slug,title,excerpt,featured_media,tour_category,tour_tag,featured_image_url,tour_meta,tour_terms');
    url.searchParams.set('per_page', String(params.per_page || 100));
    url.searchParams.set('page', String(params.page || 1));

    if (params.orderby) url.searchParams.set('orderby', params.orderby);
    if (params.order) url.searchParams.set('order', params.order);
    if (params.search) url.searchParams.set('search', params.search);
    if (lang && lang !== 'en') url.searchParams.set('lang', lang);
    else url.searchParams.set('lang', 'en'); // Always send lang for same-slug support

    console.log(`[Astro SSG] Fetching tours from: ${url.toString()}`);

    const response = await fetchWithTimeout(url.toString());
    const tours = await response.json();

    return Array.isArray(tours) ? tours : [];
}

export async function getTourBySlug(slug: string, lang?: string): Promise<WPTour | null> {
    const customApiUrl = getCustomApiUrl();
    // Use dedicated slug endpoint which returns full tour data including goodlayers_data
    const url = new URL(`${customApiUrl}/tours/slug/${encodeURIComponent(slug)}`);

    // Always send lang parameter to ensure correct tour when slugs match across languages
    url.searchParams.set('lang', lang || 'en');

    console.log(`[Astro SSG] Fetching tour by slug: ${url.toString()}`);

    const response = await fetchWithTimeout(url.toString());
    const tour = await response.json();

    // The /tours/slug/{slug} endpoint returns a single tour object, not an array
    return tour && tour.id ? tour : null;
}

export async function getAllTourSlugs(lang?: string): Promise<string[]> {
    const tours = await getTours({ per_page: 1000 }, lang);
    return tours.map(tour => tour.slug);
}

// =====================
// TAXONOMY FUNCTIONS
// =====================

type V1TermMinimal = {
    id: number;
    slug: string;
    name: string;
    parent: number;
    count: number;
};

async function fetchTerms(taxonomy: string, lang?: string): Promise<V1TermMinimal[]> {
    const customApiUrl = getCustomApiUrl();
    const url = new URL(`${customApiUrl}/terms/${taxonomy}`);

    url.searchParams.set('per_page', '100');
    if (lang && lang !== 'en') url.searchParams.set('lang', lang);

    console.log(`[Astro SSG] Fetching terms for ${taxonomy}: ${url.toString()}`);

    const response = await fetchWithTimeout(url.toString());
    const terms = await response.json();

    return Array.isArray(terms) ? terms : [];
}

export async function getTourCategories(lang?: string): Promise<WPTourCategory[]> {
    const terms = await fetchTerms('tour_category', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        parent: term.parent,
        count: term.count,
        taxonomy: 'tour_category',
        description: '',
        link: '',
    }));
}

export async function getTourTags(lang?: string): Promise<WPTourTag[]> {
    const terms = await fetchTerms('tour_tag', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        count: term.count,
        taxonomy: 'tour_tag',
        description: '',
        link: '',
    }));
}

export async function getTourActivities(lang?: string): Promise<WPTourActivity[]> {
    const terms = await fetchTerms('tour-activity', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        parent: term.parent,
        count: term.count,
        taxonomy: 'tour-activity',
        description: '',
        link: '',
    }));
}

export async function getTourDestinations(lang?: string): Promise<WPTourDestination[]> {
    const terms = await fetchTerms('tour-destination', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        parent: term.parent,
        count: term.count,
        taxonomy: 'tour-destination',
        description: '',
        link: '',
    }));
}

export async function getTourDurations(lang?: string): Promise<WPTourDuration[]> {
    const terms = await fetchTerms('tour_duration', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        count: term.count,
        taxonomy: 'tour_duration',
        description: '',
        link: '',
    }));
}

export async function getTourTypes(lang?: string): Promise<WPTourType[]> {
    const terms = await fetchTerms('tour_type', lang);
    return terms.map(term => ({
        id: term.id,
        slug: term.slug,
        name: term.name,
        count: term.count,
        taxonomy: 'tour_type',
        description: '',
        link: '',
    }));
}

// =====================
// SITE NAVIGATION DATA
// =====================

export interface SiteNavData {
    activities: WPTourActivity[];
    destinations: WPTourDestination[];
    durations: WPTourDuration[];
    types: WPTourType[];
}

export async function getSiteNavData(lang?: string): Promise<SiteNavData> {
    const customApiUrl = getCustomApiUrl();
    const url = new URL(`${customApiUrl}/sitenav`);

    if (lang && lang !== 'en') url.searchParams.set('lang', lang);

    console.log(`[Astro SSG] Fetching site nav data: ${url.toString()}`);

    try {
        const response = await fetchWithTimeout(url.toString());
        const data = await response.json();

        return {
            activities: Array.isArray(data.activities) ? data.activities.map(mapToActivity) : [],
            destinations: Array.isArray(data.destinations) ? data.destinations.map(mapToDestination) : [],
            durations: Array.isArray(data.durations) ? data.durations.map(mapToDuration) : [],
            types: Array.isArray(data.types) ? data.types.map(mapToType) : [],
        };
    } catch (error) {
        console.error('[Astro SSG] Error fetching site nav data:', error);
        // Fallback to individual fetches
        const [activities, destinations, durations, types] = await Promise.all([
            getTourActivities(lang),
            getTourDestinations(lang),
            getTourDurations(lang),
            getTourTypes(lang),
        ]);
        return { activities, destinations, durations, types };
    }
}

// Helper mappers
function mapToActivity(term: V1TermMinimal): WPTourActivity {
    return {
        id: term.id,
        slug: term.slug,
        name: term.name,
        parent: term.parent,
        count: term.count,
        taxonomy: 'tour-activity',
        description: '',
        link: '',
    };
}

function mapToDestination(term: V1TermMinimal): WPTourDestination {
    return {
        id: term.id,
        slug: term.slug,
        name: term.name,
        parent: term.parent,
        count: term.count,
        taxonomy: 'tour-destination',
        description: '',
        link: '',
    };
}

function mapToDuration(term: V1TermMinimal): WPTourDuration {
    return {
        id: term.id,
        slug: term.slug,
        name: term.name,
        count: term.count,
        taxonomy: 'tour_duration',
        description: '',
        link: '',
    };
}

function mapToType(term: V1TermMinimal): WPTourType {
    return {
        id: term.id,
        slug: term.slug,
        name: term.name,
        count: term.count,
        taxonomy: 'tour_type',
        description: '',
        link: '',
    };
}

// =====================
// GOOGLE REVIEWS
// =====================

import type { GoogleReview, PlaceDetails } from './types';

/**
 * Get all Google reviews from WordPress custom API
 */
export async function getGoogleReviews(): Promise<GoogleReview[]> {
    const customApiUrl = getCustomApiUrl();
    const url = new URL(`${customApiUrl}/google-reviews`);

    console.log(`[Astro SSG] Fetching Google reviews: ${url.toString()}`);

    try {
        const response = await fetchWithTimeout(url.toString());
        const reviews = await response.json();

        if (!Array.isArray(reviews)) {
            console.warn('[Astro SSG] Unexpected reviews response format');
            return [];
        }

        console.log(`[Astro SSG] Retrieved ${reviews.length} reviews`);
        return reviews;
    } catch (error) {
        console.error('[Astro SSG] Error fetching reviews:', error);
        return [];
    }
}

/**
 * Get business reviews with aggregated details
 */
export async function getBusinessReviews(): Promise<PlaceDetails | null> {
    const reviews = await getGoogleReviews();

    if (!reviews || reviews.length === 0) {
        console.warn('[Astro SSG] No reviews available');
        return null;
    }

    const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    return {
        name: 'Qualitour - Vancouver Branch',
        formatted_address: 'Vancouver, BC, Canada',
        rating: averageRating,
        user_ratings_total: reviews.length,
        reviews,
    };
}

