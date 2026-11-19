/**
 * Analyze Tour Matching Between EN and ZH Sites
 * 
 * Matches tours using multiple strategies:
 * 1. Tour Code (from GoodLayers icon-list)
 * 2. Price matching (exact price match)
 * 3. Slug similarity
 * 4. Featured image filename match
 */

interface TourData {
    id: number;
    slug: string;
    title: string;
    status: string;
    tour_code: string | null;
    price: string | null;
    featured_image_url?: string;
}

interface MatchResult {
    en_tour: TourData;
    zh_tour: TourData;
    match_type: string;
    confidence: number;
    tour_code?: string;
}

const EN_API = 'https://qualitour.ca/wp-json/qualitour/v1';
const ZH_API = 'https://qualitour.ca/zh/wp-json/qualitour/v1';

// Extract tour code from GoodLayers sections
function extractTourCode(sections: any[]): string | null {
    if (!sections || !Array.isArray(sections)) return null;

    for (const section of sections) {
        if (!section.items) continue;

        for (const item of section.items) {
            if (item.type === 'icon-list' && item.value?.tabs) {
                for (const tab of item.value.tabs) {
                    const title = tab.title || '';
                    const match = title.match(/(?:Tour Code|團號|Code|tour code)[:\s]*([A-Z0-9]+)/i);
                    if (match) {
                        return match[1].toUpperCase();
                    }
                }
            }
        }
    }

    return null;
}

// Get image filename from URL
function getImageFilename(url: string | any): string | null {
    if (!url) return null;

    let imgUrl = '';
    if (typeof url === 'string') {
        imgUrl = url;
    } else if (url.full?.url) {
        imgUrl = url.full.url;
    } else if (url.url) {
        imgUrl = url.url;
    }

    if (!imgUrl) return null;

    const parts = imgUrl.split('/');
    const filename = parts[parts.length - 1];
    // Remove size suffix like -300x200
    return filename.replace(/-\d+x\d+/, '').replace(/\.[^.]+$/, '').toLowerCase();
}

// Normalize slug for comparison
function normalizeSlug(slug: string): string {
    return decodeURIComponent(slug)
        .toLowerCase()
        .replace(/-\d+$/, '') // Remove trailing numbers like "-2"
        .replace(/[^a-z0-9\u4e00-\u9fff]/g, ''); // Keep only alphanumeric and Chinese chars
}

async function fetchTourDetails(apiUrl: string, tourId: number): Promise<any> {
    try {
        const response = await fetch(`${apiUrl}/tours/${tourId}`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

async function fetchToursWithData(apiUrl: string, label: string): Promise<TourData[]> {
    const listUrl = `${apiUrl}/tours?per_page=200&_fields=id,slug,status,title,featured_image_url,tour_meta`;
    console.log(`Fetching ${label} tours...`);

    const listResponse = await fetch(listUrl);
    if (!listResponse.ok) {
        throw new Error(`Failed to fetch from ${apiUrl}: ${listResponse.status}`);
    }

    const tours = await listResponse.json();
    const toursWithData: TourData[] = [];

    let processed = 0;
    for (const tour of tours) {
        if (tour.status !== 'publish') continue;

        processed++;
        if (processed % 20 === 0) {
            console.log(`  ${label}: Processed ${processed}/${tours.length} tours...`);
        }

        try {
            // Fetch individual tour to get GoodLayers data for tour code
            const detail = await fetchTourDetails(apiUrl, tour.id);
            const tourCode = detail ? extractTourCode(detail.goodlayers_data?.sections || []) : null;

            toursWithData.push({
                id: tour.id,
                slug: tour.slug,
                status: tour.status || 'publish',
                title: typeof tour.title === 'string' ? tour.title : tour.title?.rendered || '',
                tour_code: tourCode,
                price: tour.tour_meta?.price || null,
                featured_image_url: tour.featured_image_url,
            });
        } catch (err) {
            console.warn(`  Error fetching tour ${tour.id}: ${err}`);
        }
    }

    console.log(`  ${label}: Found ${toursWithData.length} published tours`);
    return toursWithData;
}

function findMatches(enTours: TourData[], zhTours: TourData[]): MatchResult[] {
    const matches: MatchResult[] = [];
    const matchedEnIds = new Set<number>();
    const matchedZhIds = new Set<number>();

    // Build lookup maps
    const zhByCode = new Map<string, TourData>();
    const zhByPrice = new Map<string, TourData[]>();
    const zhBySlug = new Map<string, TourData>();
    const zhByImage = new Map<string, TourData>();

    for (const zh of zhTours) {
        if (zh.tour_code) {
            zhByCode.set(zh.tour_code, zh);
        }
        if (zh.price) {
            if (!zhByPrice.has(zh.price)) {
                zhByPrice.set(zh.price, []);
            }
            zhByPrice.get(zh.price)!.push(zh);
        }
        const normSlug = normalizeSlug(zh.slug);
        zhBySlug.set(normSlug, zh);

        const imgFilename = getImageFilename(zh.featured_image_url);
        if (imgFilename) {
            zhByImage.set(imgFilename, zh);
        }
    }

    // Strategy 1: Match by Tour Code (highest confidence)
    for (const en of enTours) {
        if (!en.tour_code || matchedEnIds.has(en.id)) continue;

        const zhMatch = zhByCode.get(en.tour_code);
        if (zhMatch && !matchedZhIds.has(zhMatch.id)) {
            matches.push({
                en_tour: en,
                zh_tour: zhMatch,
                match_type: 'tour_code',
                confidence: 100,
                tour_code: en.tour_code,
            });
            matchedEnIds.add(en.id);
            matchedZhIds.add(zhMatch.id);
        }
    }

    // Strategy 2: Match by exact slug
    for (const en of enTours) {
        if (matchedEnIds.has(en.id)) continue;

        const normSlug = normalizeSlug(en.slug);
        const zhMatch = zhBySlug.get(normSlug);
        if (zhMatch && !matchedZhIds.has(zhMatch.id)) {
            matches.push({
                en_tour: en,
                zh_tour: zhMatch,
                match_type: 'slug_match',
                confidence: 95,
            });
            matchedEnIds.add(en.id);
            matchedZhIds.add(zhMatch.id);
        }
    }

    // Strategy 3: Match by featured image filename
    for (const en of enTours) {
        if (matchedEnIds.has(en.id)) continue;

        const imgFilename = getImageFilename(en.featured_image_url);
        if (!imgFilename) continue;

        const zhMatch = zhByImage.get(imgFilename);
        if (zhMatch && !matchedZhIds.has(zhMatch.id)) {
            matches.push({
                en_tour: en,
                zh_tour: zhMatch,
                match_type: 'image_match',
                confidence: 90,
            });
            matchedEnIds.add(en.id);
            matchedZhIds.add(zhMatch.id);
        }
    }

    // Strategy 4: Match by price (lower confidence, only if unique price)
    for (const en of enTours) {
        if (matchedEnIds.has(en.id) || !en.price) continue;

        const zhMatches = zhByPrice.get(en.price)?.filter(zh => !matchedZhIds.has(zh.id)) || [];

        // Only match if there's exactly one ZH tour with this price
        if (zhMatches.length === 1) {
            const zhMatch = zhMatches[0];
            matches.push({
                en_tour: en,
                zh_tour: zhMatch,
                match_type: 'price_match',
                confidence: 70,
            });
            matchedEnIds.add(en.id);
            matchedZhIds.add(zhMatch.id);
        }
    }

    // Sort by confidence
    matches.sort((a, b) => b.confidence - a.confidence);

    return matches;
}

async function main() {
    console.log('='.repeat(70));
    console.log('Tour Matching Analysis: EN ↔ ZH (Multi-Strategy)');
    console.log('='.repeat(70));
    console.log();

    // Fetch tours from both sites
    const enTours = await fetchToursWithData(EN_API, 'EN');
    const zhTours = await fetchToursWithData(ZH_API, 'ZH');

    // Count tours with codes
    const enWithCode = enTours.filter(t => t.tour_code);
    const zhWithCode = zhTours.filter(t => t.tour_code);
    const enWithPrice = enTours.filter(t => t.price);
    const zhWithPrice = zhTours.filter(t => t.price);

    console.log();
    console.log('='.repeat(70));
    console.log('TOUR STATISTICS');
    console.log('='.repeat(70));
    console.log(`EN Published Tours: ${enTours.length}`);
    console.log(`  - With Tour Code: ${enWithCode.length}`);
    console.log(`  - With Price: ${enWithPrice.length}`);
    console.log();
    console.log(`ZH Published Tours: ${zhTours.length}`);
    console.log(`  - With Tour Code: ${zhWithCode.length}`);
    console.log(`  - With Price: ${zhWithPrice.length}`);

    // Find all matches
    const matches = findMatches(enTours, zhTours);

    // Group by match type
    const byType = new Map<string, MatchResult[]>();
    for (const m of matches) {
        if (!byType.has(m.match_type)) {
            byType.set(m.match_type, []);
        }
        byType.get(m.match_type)!.push(m);
    }

    console.log();
    console.log('='.repeat(70));
    console.log('MATCHED TOURS');
    console.log('='.repeat(70));
    console.log(`Total Matched Pairs: ${matches.length}`);
    console.log();

    for (const [type, typeMatches] of byType) {
        console.log(`\n--- ${type.toUpperCase()} (${typeMatches.length} matches) ---`);
        for (const m of typeMatches) {
            console.log();
            console.log(`✓ Confidence: ${m.confidence}%${m.tour_code ? ` | Code: ${m.tour_code}` : ''}`);
            console.log(`  EN [${m.en_tour.id}]: ${m.en_tour.title.slice(0, 60)}`);
            console.log(`  ZH [${m.zh_tour.id}]: ${m.zh_tour.title.slice(0, 60)}`);
            if (m.en_tour.price) {
                console.log(`  Price: $${m.en_tour.price}`);
            }
        }
    }

    // Unmatched tours
    const matchedEnIds = new Set(matches.map(m => m.en_tour.id));
    const matchedZhIds = new Set(matches.map(m => m.zh_tour.id));

    const unmatchedEn = enTours.filter(t => !matchedEnIds.has(t.id));
    const unmatchedZh = zhTours.filter(t => !matchedZhIds.has(t.id));

    console.log();
    console.log('='.repeat(70));
    console.log('UNMATCHED TOURS');
    console.log('='.repeat(70));
    console.log(`EN Unmatched: ${unmatchedEn.length}`);
    console.log(`ZH Unmatched: ${unmatchedZh.length}`);

    // Sample unmatched
    console.log('\nSample EN Unmatched (first 15):');
    for (const t of unmatchedEn.slice(0, 15)) {
        console.log(`  [${t.id}] ${t.tour_code || 'no-code'} | $${t.price || '?'} | ${t.slug.slice(0, 50)}`);
    }

    console.log('\nSample ZH Unmatched (first 15):');
    for (const t of unmatchedZh.slice(0, 15)) {
        const decodedSlug = decodeURIComponent(t.slug).slice(0, 40);
        console.log(`  [${t.id}] ${t.tour_code || 'no-code'} | $${t.price || '?'} | ${decodedSlug}`);
    }

    // JSON output
    console.log();
    console.log('='.repeat(70));
    console.log('JSON OUTPUT (for Polylang linking)');
    console.log('='.repeat(70));

    const linkingData = matches.map(m => ({
        en_id: m.en_tour.id,
        zh_id: m.zh_tour.id,
        match_type: m.match_type,
        confidence: m.confidence,
        tour_code: m.tour_code || null,
        en_slug: m.en_tour.slug,
        zh_slug: m.zh_tour.slug,
    }));

    console.log(JSON.stringify(linkingData, null, 2));
}

main().catch(console.error);
