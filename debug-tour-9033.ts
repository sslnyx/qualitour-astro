
import fetch from 'node-fetch';

async function debugTour() {
    const baseUrl = 'https://qualitour.ca/wp-json/qualitour/v1';

    // 1. Try to find the tour by ID from the list
    console.log('Fetching tours to find ID 9033...');
    let page = 1;
    let foundTour = null;

    // We'll try fetching a few pages
    while (!foundTour && page <= 5) {
        // try fetching by ID directly if supported
        try {
            // Some custom APIs might implement ID directly
            const directResp = await fetch(`${baseUrl}/tours/9033`); // Try guessing endpoint
            if (directResp.ok) {
                const data = await directResp.json();
                if (data && data.id === 9033) {
                    foundTour = data;
                    console.log('Found tour by direct ID fetch!');
                    break;
                }
            }
        } catch (e) { }

        // Fallback to list
        const resp = await fetch(`${baseUrl}/tours?per_page=50&page=${page}`);
        if (!resp.ok) {
            console.error('Failed to fetch tours list', resp.status);
            break;
        }

        const tours = await resp.json();
        if (!Array.isArray(tours) || tours.length === 0) break;

        foundTour = tours.find((t: any) => t.id === 9033);
        if (foundTour) break;

        console.log(`Page ${page} checked, not found.`);
        page++;
    }

    if (!foundTour) {
        console.error('Tour 9033 not found in first 5 pages or direct endpoint.');

        // Try searching by slug if we can guess it? No.
        // Let's try to fetch via the standard WP API as a fallback to get the slug?
        // https://qualitour.ca/wp-json/wp/v2/tour/9033
        // Or tour-item? Custom post type name usually "tour" or "tour-item"
        try {
            console.log('Trying standard WP API to get slug...');
            const standardResp = await fetch('https://qualitour.ca/wp-json/wp/v2/tour/9033');
            if (standardResp.ok) {
                const stdData = await standardResp.json();
                console.log('Found via standard API, slug:', stdData.slug);
                // Now fetch via custom API slug endpoint which returns full data
                const slugResp = await fetch(`${baseUrl}/tours/slug/${stdData.slug}`);
                if (slugResp.ok) {
                    foundTour = await slugResp.json();
                }
            }
        } catch (e) { console.error(e); }
    }

    if (foundTour) {
        console.log(`Found Tour: ${foundTour.title?.rendered || foundTour.title}`);
        console.log(`Slug: ${foundTour.slug}`);

        if (foundTour.goodlayers_data) {
            // Traverse to find wrappers and images
            console.log('Scanning goodlayers_data for wrappers and images...');
            scanForImages(foundTour.goodlayers_data);
        } else {
            console.log('No goodlayers_data found on this tour object.');
        }
    } else {
        console.log('Could not locate tour 9033.');
    }
}

function scanForImages(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return;

    // Check for wrapper background
    if (obj.type === 'wrapper' || obj.type === 'color-wrapper' || (obj.value && (obj.value.type === 'wrapper' || obj.value.type === 'color-wrapper'))) {
        const val = obj.value || obj;
        if (val['background-image']) {
            console.log(`[WRAPPER IMAGE] Found at ${path}:`);
            console.log(`  - ID: ${val.id || 'N/A'}`);
            console.log(`  - Background Image: ${val['background-image']}`);
        }
        if (val['bg-image']) {
            console.log(`[WRAPPER IMAGE] Found at ${path}:`);
            console.log(`  - ID: ${val.id || 'N/A'}`);
            console.log(`  - BG Image: ${val['bg-image']}`);
        }
    }

    // Check for image items
    if (obj.url && (typeof obj.url === 'string')) {
        // Potential image
        // console.log(`[IMAGE URL] Found at ${path}: ${obj.url}`);
    }

    // Recursively check children
    for (const key in obj) {
        scanForImages(obj[key], `${path}.${key}`);
    }
}

debugTour();
