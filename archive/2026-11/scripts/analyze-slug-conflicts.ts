
/**
 * Analyze Slug Conflicts
 * 
 * Compares slugs from English tours on the live site (qualitour.ca)
 * with Chinese tours on the local site (qualitour.local)
 * to identify potential conflicts during import.
 */

interface TourData {
    id: number;
    slug: string;
    title: string;
    status: string;
    link: string;
}

const LIVE_EN_API = 'https://qualitour.ca/wp-json/qualitour/v1';
const LOCAL_ZH_API = 'http://qualitour.local/wp-json/qualitour/v1';

function normalizeSlug(slug: string): string {
    return decodeURIComponent(slug)
        .toLowerCase()
        .replace(/-\d+$/, '') // Remove trailing numbers like -2, -3 used for duplicates
        .replace(/\/$/, '');
}

async function fetchTours(apiUrl: string, label: string, lang?: string): Promise<TourData[]> {
    let listUrl = `${apiUrl}/tours?per_page=100&_fields=id,slug,status,title,link`;
    if (lang) listUrl += `&lang=${lang}`;

    console.log(`Fetching ${label} tours from ${listUrl}...`);

    let allTours: TourData[] = [];
    let page = 1;

    while (true) {
        const pagedUrl = `${listUrl}&page=${page}`;
        try {
            const response = await fetch(pagedUrl);
            if (!response.ok) {
                if (page === 1) throw new Error(`Failed to fetch: ${response.status}`);
                break; // Assume no more pages
            }

            const tours = await response.json();
            if (!Array.isArray(tours) || tours.length === 0) break;

            const validTours = tours.map((t: any) => ({
                id: t.id,
                slug: t.slug,
                status: t.status || 'publish',
                title: typeof t.title === 'string' ? t.title : t.title?.rendered || '',
                link: t.link
            }));

            allTours = allTours.concat(validTours);

            if (tours.length < 100) break; // Last page
            page++;
        } catch (err) {
            console.error(`Error fetching page ${page}:`, err);
            break;
        }
    }

    console.log(`  ${label}: Found ${allTours.length} tours`);
    return allTours;
}

async function main() {
    console.log('='.repeat(70));
    console.log('Slug Conflict Analysis');
    console.log('Source (EN): Live Site (qualitour.ca)');
    console.log('Target (ZH): Local Site (qualitour.local)');
    console.log('='.repeat(70));
    console.log();

    try {
        const enTours = await fetchTours(LIVE_EN_API, 'Live EN');
        const zhTours = await fetchTours(LOCAL_ZH_API, 'Local ZH', 'zh');

        console.log();
        console.log('Analyzing conflicts...');

        const zhSlugs = new Map<string, TourData>();
        for (const zh of zhTours) {
            // Store both exact and normalized slug to catch different types of conflicts
            zhSlugs.set(zh.slug, zh); // Exact match is the most dangerous
        }

        const conflicts: { en: TourData, zh: TourData, type: string }[] = [];

        for (const en of enTours) {
            // Check for exact slug match
            if (zhSlugs.has(en.slug)) {
                const zhMatch = zhSlugs.get(en.slug)!;
                conflicts.push({
                    en: en,
                    zh: zhMatch,
                    type: 'EXACT_SLUG'
                });
            }
        }

        console.log();
        console.log('='.repeat(70));
        console.log(`CONFLICTS FOUND: ${conflicts.length}`);
        console.log('='.repeat(70));

        if (conflicts.length > 0) {
            console.log('These EN tours have the same slug as existing ZH tours.');
            console.log('Importing them might overwrite or conflict with the ZH tours.');
            console.log();

            for (const c of conflicts) {
                console.log(`[${c.type}] Slug: "${c.en.slug}"`);
                console.log(`  EN (Live):  ID=${c.en.id} | "${c.en.title}"`);
                console.log(`  ZH (Local): ID=${c.zh.id} | "${c.zh.title}"`);
                console.log('-'.repeat(50));
            }
        } else {
            console.log('No direct slug conflicts found!');
        }

    } catch (err) {
        console.error('Fatal error:', err);
    }
}

main();
