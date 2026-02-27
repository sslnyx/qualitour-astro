/**
 * WordPress API Client for Astro SSG
 * 
 * Uses a persistent file-system cache in .astro/wordpress-cache/ so that:
 * 1. Multiple Astro worker processes share the same cached data
 * 2. Data persists across CI builds via GitHub Actions cache
 * 3. Only truly new/changed data triggers WordPress API calls
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
import type { TransferRoute } from '../zaui/zaui';
import { sanitizeUrls } from '../wp-url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

// Default timeout for fetch requests (30 seconds for large datasets)
const DEFAULT_FETCH_TIMEOUT_MS = 30000;

// =====================
// PERSISTENT FILE-SYSTEM CACHE
// =====================
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let WP_CACHE_DIR = '';
let hasFsAccess = false;

try {
    // Cloudflare Workers polyfills path and process, but throws on actual FS modifications.
    // The reliable way to detect CF Workers is via navigator.userAgent
    // @ts-ignore
    const isCF = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';

    if (!isCF) {
        WP_CACHE_DIR = path.join(process.cwd(), '.astro', 'wordpress-cache');
        if (!fs.existsSync(WP_CACHE_DIR)) {
            fs.mkdirSync(WP_CACHE_DIR, { recursive: true });
        }
        hasFsAccess = true;
    }
} catch (e) {
    // No FS access
}

// In-memory Promise cache for same-process deduplication
const promiseCache = new Map<string, Promise<any>>();

// Stats counters (logged once at end)
let fsHits = 0;
let fsMisses = 0;
let memHits = 0;

function getCacheFilePath(key: string): string {
    if (!hasFsAccess) return '';
    try {
        const hash = crypto.createHash('md5').update(key).digest('hex');
        return path.join(WP_CACHE_DIR, `${hash}.json`);
    } catch (e) {
        return '';
    }
}

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 1. Check in-memory promise cache (same worker deduplication)
    const existing = promiseCache.get(key);
    if (existing) {
        memHits++;
        return existing as Promise<T>;
    }

    const promise = (async (): Promise<T> => {
        // 2. Check file-system cache
        const cacheFile = getCacheFilePath(key);
        if (hasFsAccess && cacheFile) {
            try {
                if (fs.existsSync(cacheFile)) {
                    const stats = fs.statSync(cacheFile);
                    if (Date.now() - stats.mtimeMs < CACHE_TTL_MS) {
                        fsHits++;
                        return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                    }
                }
            } catch (e) {
                // Corrupted cache file, will re-fetch
            }
        }

        // 3. Cache miss — fetch from API
        fsMisses++;
        const result = await fn();

        // 4. Write to FS cache
        if (hasFsAccess && cacheFile) {
            try {
                fs.writeFileSync(cacheFile, JSON.stringify(result), 'utf-8');
            } catch (e) {
                console.warn(`[WP Cache] Failed to write cache for: ${key}`);
            }
        }

        return result;
    })();

    promiseCache.set(key, promise);
    return promise;
}

// Log cache stats summary at process exit
process.on('beforeExit', () => {
    if (fsHits + fsMisses + memHits > 0) {
        console.log(`[WP Cache] Summary: ${fsHits} FS-hits, ${fsMisses} API-fetches, ${memHits} in-memory dedup`);
    }
});

// Get WordPress API URL from environment (qualitour/v1 custom API)
function getApiUrl(): string {
    const url = import.meta.env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        import.meta.env.PUBLIC_WORDPRESS_API_URL ||
        import.meta.env.WORDPRESS_API_URL ||
        'https://qualitour.isquarestudio.com/wp-json/qualitour/v1';
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

export function getTours(
    params: WPApiParams = {},
    lang?: string
): Promise<WPTour[]> {
    const cacheKey = `tours:${lang || 'en'}:${JSON.stringify(params)}`;
    return cached(cacheKey, async () => {
        const customApiUrl = getApiUrl();
        const url = new URL(`${customApiUrl}/tours`);

        // Default params for tour list
        url.searchParams.set('_fields', 'id,slug,title,excerpt,featured_media,tour_category,tour_tag,featured_image_url,tour_meta,tour_terms');
        url.searchParams.set('per_page', String(params.per_page || 100));
        url.searchParams.set('page', String(params.page || 1));

        if (params.orderby) url.searchParams.set('orderby', params.orderby);
        if (params.order) url.searchParams.set('order', params.order);
        if (params.search) url.searchParams.set('search', params.search);
        if (params.categories) url.searchParams.set('tour_category', params.categories.join(','));
        if (params.tags) url.searchParams.set('tour_tag', params.tags.join(','));
        if (params.destinations) url.searchParams.set('tour-destination', params.destinations.join(','));
        if (lang && lang !== 'en') url.searchParams.set('lang', lang);
        else url.searchParams.set('lang', 'en'); // Always send lang for same-slug support

        const response = await fetchWithTimeout(url.toString());
        const tours = await response.json();

        // Sanitize all URLs in tour data to replace local domains with production
        const sanitizedTours = Array.isArray(tours) ? sanitizeUrls(tours) : [];
        return sanitizedTours;
    });
}

/**
 * Fetch all tours with automatic pagination (production API has per_page limit)
 */
export async function getAllTours(lang?: string): Promise<WPTour[]> {
    const cacheKey = `all-tours:${lang || 'en'}`;
    return cached(cacheKey, async () => {
        const customApiUrl = getApiUrl();
        const allTours: WPTour[] = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const url = new URL(`${customApiUrl}/tours`);
            url.searchParams.set('_fields', 'id,slug,title,excerpt,featured_media,tour_category,tour_tag,featured_image_url,tour_meta,tour_terms');
            url.searchParams.set('per_page', '100');
            url.searchParams.set('page', String(page));
            if (lang && lang !== 'en') url.searchParams.set('lang', lang);
            else url.searchParams.set('lang', 'en');

            try {
                const response = await fetchWithTimeout(url.toString());
                const tours = await response.json();

                if (Array.isArray(tours) && tours.length > 0) {
                    allTours.push(...sanitizeUrls(tours));
                    page++;
                } else {
                    hasMore = false;
                }
            } catch (e) {
                console.error(`[Astro SSG] Error fetching page ${page}:`, e);
                hasMore = false;
            }
        }

        return allTours;
    });
}

export function getTourBySlug(slug: string, lang?: string): Promise<WPTour | null> {
    const cacheKey = `tour-slug:${lang || 'en'}:${slug}`;
    return cached(cacheKey, async () => {
        const customApiUrl = getCustomApiUrl();
        // Use dedicated slug endpoint which returns full tour data including goodlayers_data
        const url = new URL(`${customApiUrl}/tours/slug/${encodeURIComponent(slug)}`);

        // Always send lang parameter to ensure correct tour when slugs match across languages
        url.searchParams.set('lang', lang || 'en');

        const response = await fetchWithTimeout(url.toString());
        const tour = await response.json();

        // The /tours/slug/{slug} endpoint returns a single tour object, not an array
        // Sanitize URLs to replace local domains with production
        return tour && tour.id ? sanitizeUrls(tour) : null;
    });
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
    translations?: Record<string, string>;
};

function fetchTerms(taxonomy: string, lang?: string): Promise<V1TermMinimal[]> {
    const cacheKey = `terms:${lang || 'en'}:${taxonomy}`;
    return cached(cacheKey, async () => {
        const customApiUrl = getCustomApiUrl();
        const url = new URL(`${customApiUrl}/terms/${taxonomy}`);

        url.searchParams.set('per_page', '200');
        if (lang && lang !== 'en') url.searchParams.set('lang', lang);

        const response = await fetchWithTimeout(url.toString());
        const terms = await response.json();

        return Array.isArray(terms) ? terms : [];
    });
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
    transfers: TransferRoute[];
}

export function getSiteNavData(lang?: string): Promise<SiteNavData> {
    const cacheKey = `sitenav:${lang || 'en'}`;
    return cached(cacheKey, async () => {
        const customApiUrl = getCustomApiUrl();
        const url = new URL(`${customApiUrl}/sitenav`);

        if (lang && lang !== 'en') url.searchParams.set('lang', lang);

        try {
            const response = await fetchWithTimeout(url.toString());
            const data = await response.json();

            return {
                activities: Array.isArray(data.activities) ? data.activities.map(mapToActivity) : [],
                destinations: Array.isArray(data.destinations) ? data.destinations.map(mapToDestination) : [],
                durations: Array.isArray(data.durations) ? data.durations.map(mapToDuration) : [],
                types: Array.isArray(data.types) ? data.types.map(mapToType) : [],
                transfers: [],
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
            return { activities, destinations, durations, types, transfers: [] };
        }
    });
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
        translations: term.translations,
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
        translations: term.translations,
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
        translations: term.translations,
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
        translations: term.translations,
    };
}

// =====================
// GOOGLE REVIEWS
// =====================

import type { GoogleReview, PlaceDetails } from './types';

/**
 * Get all Google reviews from WordPress custom API
 */
export function getGoogleReviews(): Promise<GoogleReview[]> {
    return cached('google-reviews', async () => {
        const customApiUrl = getCustomApiUrl();
        const url = new URL(`${customApiUrl}/google-reviews`);

        try {
            const response = await fetchWithTimeout(url.toString());
            const reviews = await response.json();

            if (!Array.isArray(reviews)) {
                return [];
            }

            return reviews;
        } catch (error) {
            console.error('[Astro SSG] Error fetching reviews:', error);
            return [];
        }
    });
}

/**
 * Get business reviews with aggregated details
 */
export async function getBusinessReviews(): Promise<PlaceDetails | null> {
    const allReviews = await getGoogleReviews();

    if (!allReviews || allReviews.length === 0) {
        console.warn('[Astro SSG] No reviews available');
        return null;
    }

    // Calculate "real" average rating based on ALL reviews (before filtering)
    const realAverageRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    // Filter out reviews with rating <= 2 for display
    const displayReviews = allReviews.filter(r => r.rating > 2);

    return {
        name: 'Qualitour - Vancouver Branch',
        formatted_address: 'Vancouver, BC, Canada',
        rating: realAverageRating,
        user_ratings_total: allReviews.length,
        reviews: displayReviews,
    };
}

// =====================
// COMPANY INFO
// =====================

export interface CompanyInfo {
    company_name: string;
    phone: string;
    phone_raw: string;
    email: string;
    bc_reg: string;
    address: {
        street: string;
        city: string;
        province: string;
        postal: string;
        country: string;
    };
    google_maps_url: string;
    hours: string;
    hours_zh: string;
    social: {
        facebook: string;
        instagram: string;
        youtube: string;
        xiaohongshu: string;
        whatsapp: string;
        wechat: string;
    };
}

const COMPANY_INFO_DEFAULTS: CompanyInfo = {
    company_name: 'Qualitour Holiday Inc.',
    phone: '(778) 945-6000',
    phone_raw: '+17789456000',
    email: 'info@qualitour.ca',
    bc_reg: '62469',
    address: {
        street: '8283 Granville St',
        city: 'Vancouver',
        province: 'BC',
        postal: 'V6P 4Z6',
        country: 'Canada',
    },
    google_maps_url: '',
    hours: 'Mon-Fri from 9am to 6pm PST',
    hours_zh: '週一至週五 9am-6pm PST',
    social: {
        facebook: 'https://www.facebook.com/profile.php?id=61571902435431',
        instagram: 'https://www.instagram.com/qualitour',
        youtube: 'https://www.youtube.com/@qualitour',
        xiaohongshu: 'https://www.xiaohongshu.com/user/profile/879334972',
        whatsapp: '',
        wechat: '',
    },
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
    const apiUrl = getApiUrl();
    try {
        const response = await fetchWithTimeout(`${apiUrl}/company-info`);
        if (!response.ok) {
            console.warn(`[Company Info] API returned ${response.status}, using defaults`);
            return COMPANY_INFO_DEFAULTS;
        }
        const data = await response.json();
        // Merge with defaults so missing fields don't break the frontend
        return {
            ...COMPANY_INFO_DEFAULTS,
            ...data,
            address: { ...COMPANY_INFO_DEFAULTS.address, ...(data.address || {}) },
            social: { ...COMPANY_INFO_DEFAULTS.social, ...(data.social || {}) },
        };
    } catch (e) {
        console.warn('[Company Info] Fetch failed, using defaults:', e);
        return COMPANY_INFO_DEFAULTS;
    }
}
