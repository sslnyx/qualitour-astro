
import { wpUrl } from '../src/lib/wp-url'; // Trying import, if fails I'll inline logic

const API_URL = 'http://qualitour.local/wp-json/qualitour/v1/tours?per_page=100';

async function main() {
    console.log(`Fetching tours from ${API_URL}...`);
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(res.statusText);
        const tours = await res.json();

        console.log(`Found ${tours.length} tours.`);

        const vikingTours = tours.filter((t: any) =>
            (t.title?.rendered || t.title).includes('Viking Oceans Cruises')
        );

        console.log(`Found ${vikingTours.length} Viking tours.`);

        for (const tour of vikingTours) {
            const title = tour.title?.rendered || tour.title;
            const featuredImage = tour.featured_image_url;
            console.log('------------------------------------------------');
            console.log(`ID: ${tour.id}`);
            console.log(`Title: ${title}`);
            console.log('Featured Image Raw:', JSON.stringify(featuredImage, null, 2));

            // Simmons logic from TourCardOptimized based on shape
            let rawUrl = null;
            if (typeof featuredImage === "string" && featuredImage.trim()) {
                rawUrl = featuredImage;
            } else if (typeof featuredImage === "object" && featuredImage !== null) {
                // Try to extract from sizes like in the component
                const extract = (val: any) => val?.url || (typeof val === 'string' ? val : null);
                rawUrl = extract(featuredImage.medium_large) ||
                    extract(featuredImage.large) ||
                    extract(featuredImage.medium) ||
                    extract(featuredImage.full) ||
                    extract(featuredImage.thumbnail);
            }

            console.log(`Extracted Raw URL: ${rawUrl}`);
            if (rawUrl) {
                // We can't import wpUrl easily if TS is strict about outside src imports without composite projects
                // So I will just print it and manually check, or try to import if environment allows.
                // But for now, let's see the Raw URL. 
                // If I can run this with ts-node/tsx it might work.
            }
        }

    } catch (e) {
        console.error(e);
    }
}

main();
