
const API_URL = 'http://qualitour.local/wp-json/qualitour/v1';
const AUTH_USER = 'narwal';
const AUTH_PASS = 'skillful';

async function fetchTour(idOrSlug: string, lang = 'en') {
    const credentials = btoa(`${AUTH_USER}:${AUTH_PASS}`);
    const url = idOrSlug.match(/^\d+$/)
        ? `${API_URL}/tours/${idOrSlug}?lang=${lang}`
        : `${API_URL}/tours/slug/${idOrSlug}?lang=${lang}`;

    const response = await fetch(url, {
        headers: { 'Authorization': `Basic ${credentials}` }
    });
    return response.ok ? await response.json() : null;
}

async function debugZHTranslations() {
    const credentials = btoa(`${AUTH_USER}:${AUTH_PASS}`);
    const url = `${API_URL}/tours?lang=zh&per_page=3&_fields=id,slug,title,translations`;

    console.log(`Fetching ZH tours with translations from: ${url}`);
    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Basic ${credentials}` }
        });

        const tours = await response.json();

        for (const t of tours) {
            console.log(`\n--- ZH Tour: ${t.title.rendered} (ID: ${t.id}) ---`);
            console.log(`Translations:`, JSON.stringify(t.translations, null, 2));

            if (t.translations && t.translations.en) {
                const enTour = await fetchTour(t.translations.en.id.toString(), 'en');
                if (enTour) {
                    console.log(`Found EN Tour: ${enTour.title?.rendered || enTour.slug} (ID: ${enTour.id})`);
                    console.log(`EN Featured Media ID: ${enTour.featured_media}`);
                    console.log(`EN Featured Image URL:`, JSON.stringify(enTour.featured_image_url, null, 2));
                } else {
                    console.log(`Could not find EN tour for ID: ${t.translations.en.id}`);
                }
            } else {
                console.log(`No English translation linked.`);
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

debugZHTranslations();
