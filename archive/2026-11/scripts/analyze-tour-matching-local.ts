/**
 * Analyze Tour Matching for LOCAL WordPress (qualitour.local)
 * 
 * Matches tours using multiple strategies and outputs PHP array for linking
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

// Use LOCAL WordPress
const EN_API = 'http://qualitour.local/wp-json/qualitour/v1';
const ZH_API = 'http://qualitour.local/wp-json/qualitour/v1';

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
    return filename.replace(/-\d+x\d+/, '').replace(/\.[^.]+$/, '').toLowerCase();
}

function normalizeSlug(slug: string): string {
    return decodeURIComponent(slug)
        .toLowerCase()
        .replace(/-\d+$/, '')
        .replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

async function fetchTourDetails(apiUrl: string, tourId: number, lang?: string): Promise<any> {
    try {
        let url = `${apiUrl}/tours/${tourId}`;
        if (lang) url += `?lang=${lang}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

async function fetchToursWithData(apiUrl: string, label: string, lang?: string): Promise<TourData[]> {
    let listUrl = `${apiUrl}/tours?per_page=200&_fields=id,slug,status,title,featured_image_url,tour_meta`;
    if (lang) listUrl += `&lang=${lang}`;

    console.log(`Fetching ${label} tours from ${listUrl}...`);

    const listResponse = await fetch(listUrl);
    if (!listResponse.ok) {
        throw new Error(`Failed to fetch: ${listResponse.status}`);
    }

    const tours = await listResponse.json();
    const toursWithData: TourData[] = [];

    let processed = 0;
    for (const tour of tours) {
        if (tour.status !== 'publish') continue;

        processed++;
        if (processed % 20 === 0) {
            console.log(`  ${label}: Processed ${processed}/${tours.length}...`);
        }

        try {
            const detail = await fetchTourDetails(apiUrl, tour.id, lang);
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

    const zhByCode = new Map<string, TourData>();
    const zhBySlug = new Map<string, TourData>();
    const zhByImage = new Map<string, TourData>();

    for (const zh of zhTours) {
        if (zh.tour_code) zhByCode.set(zh.tour_code, zh);
        zhBySlug.set(normalizeSlug(zh.slug), zh);
        const imgFilename = getImageFilename(zh.featured_image_url);
        if (imgFilename) zhByImage.set(imgFilename, zh);
    }

    // Strategy 1: Tour Code (100%)
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

    // Strategy 2: Slug (95%)
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

    // Strategy 3: Image (90%)
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

    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
}

async function main() {
    console.log('='.repeat(70));
    console.log('Tour Matching Analysis: LOCAL WordPress (qualitour.local)');
    console.log('='.repeat(70));
    console.log();

    const enTours = await fetchToursWithData(EN_API, 'EN');
    const zhTours = await fetchToursWithData(ZH_API, 'ZH', 'zh');

    console.log();
    console.log(`EN Tours: ${enTours.length} | ZH Tours: ${zhTours.length}`);

    const matches = findMatches(enTours, zhTours);

    console.log();
    console.log('='.repeat(70));
    console.log(`MATCHED TOURS: ${matches.length} pairs (90%+ confidence)`);
    console.log('='.repeat(70));

    for (const m of matches) {
        console.log();
        console.log(`✓ ${m.match_type} (${m.confidence}%)${m.tour_code ? ` | Code: ${m.tour_code}` : ''}`);
        console.log(`  EN [${m.en_tour.id}]: ${m.en_tour.title.slice(0, 50)}`);
        console.log(`  ZH [${m.zh_tour.id}]: ${m.zh_tour.title.slice(0, 50)}`);
    }

    // Output PHP array
    console.log();
    console.log('='.repeat(70));
    console.log('PHP ARRAY FOR PLUGIN:');
    console.log('='.repeat(70));
    console.log('$matched_pairs = array(');
    for (const m of matches) {
        const code = m.tour_code ? `'${m.tour_code}'` : "'-'";
        const name = m.en_tour.title.replace(/'/g, "\\'").slice(0, 50);
        console.log(`    array( 'en_id' => ${m.en_tour.id}, 'zh_id' => ${m.zh_tour.id}, 'match_type' => '${m.match_type} (${m.confidence}%)', 'code' => ${code}, 'name' => '${name}' ),`);
    }
    console.log(');');
}

main().catch(console.error);
