
// Mocking import.meta.env for the test
const MOCK_ENV = {
    DEV: false,
    PROD: true,
    PUBLIC_WORDPRESS_CUSTOM_API_URL: 'http://qualitour.local/wp-json/qualitour/v1',
    PUBLIC_ASSETS_URL: 'https://qualitour-assets.isquarestudio.com',
    PUBLIC_CF_IMAGE_TRANSFORM: 'true'
};

// Mocking the wp-url.ts module logic since we can't easily import it with ts-node due to import.meta
// This is a COPY of the relevant logic from src/lib/wp-url.ts for testing purposes.
// If the logic changes in the main file, this test needs update, but for now it verifies the current logic.

function getAssetsBaseUrl() {
    const assetsUrl = MOCK_ENV.PUBLIC_ASSETS_URL;
    if (assetsUrl) {
        return assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl;
    }
    return null;
}

function getWpBaseUrl() {
    // In actual code this has more fallback logic, but simplifies here
    return 'http://qualitour.local';
}

function wpUrl(url: string): string {
    if (!url) return url;

    // Environment detection
    const isDev = MOCK_ENV.DEV;
    const isBuild = !isDev;

    let processedUrl = url;

    // During BUILD, we MUST replace unreachable local domains with reachable sources.
    if (isBuild) {
        const localDomainPattern = new RegExp('https?://qualitour' + '(-zh)?' + '\\\.local', 'g');
        const assetsBase = getAssetsBaseUrl();
        const wpBase = getWpBaseUrl();
        const prodWpDomain = 'https://qualitour.isquarestudio.com';

        // Direct mapping to R2 for uploads if available
        if (assetsBase && processedUrl.includes('/wp-content/uploads/')) {
            processedUrl = url.replace(localDomainPattern, assetsBase!);
            // Also handle case where it was already production WP domain
            processedUrl = processedUrl.replace(wpBase, assetsBase!);
            // Explicitly replace known production domain
            processedUrl = processedUrl.replace(prodWpDomain, assetsBase!);
        } else {
            // Standard fallback to production WP for other paths
            processedUrl = url.replace(localDomainPattern, prodWpDomain);
        }
    }

    // Remove known domains to make paths relative
    const domains = [
        'https://qualitour.local',
        'https://qualitour.isquarestudio.com',
        'https://qualitour-fe.sslnyx.workers.dev'
    ];

    for (const domain of domains) {
        if (processedUrl.startsWith(domain)) {
            processedUrl = processedUrl.substring(domain.length);
            break;
        }
    }

    // Handle relative paths 
    if (processedUrl.startsWith('/')) {
        // ... (skipping some logic irrelevant to R2 domain check)
        if (processedUrl.startsWith('/_astro/') || processedUrl.startsWith('/public/')) {
            return processedUrl;
        }
        // Wait, if it's relative, it prepends WP base URL?
        // But if we want R2, it should remain absolute R2 URL.
        // Let's check the logic in the original file.
        // The original file returns: return `${getWpBaseUrl()}${processedUrl}`; for relative paths.
        // But wait! If we replaced it with assetsBase (R2), it is now an ABSOLUTE URL starting with https://qualitour-assets...
        // So it naturally falls through to "Handle absolute URLs" section?
        // Let's trace carefully.
    }

    // Logic for absolute URLs
    // logic ...

    // RE-EVALUATE: 
    // In the original code:
    // processedUrl = url.replace(localDomainPattern, assetsBase);
    // If url was "http://qualitour.local/wp-content/...", processedUrl is now "https://qualitour-assets.../wp-content/..."

    // Then checks: "Remove known domains to make paths relative"
    // domains array does NOT include the assetsBase.
    // So "https://qualitour-assets..." will NOT start with any of the domains in the list (unless assetsBase happens to be there).
    // The list is: 'https://qualitour.local', 'https://qualitour.isquarestudio.com', ...

    // So processedUrl REMAINS absolute: "https://qualitour-assets.../..."

    // Then check: if (processedUrl.startsWith('/')) -> FALSE.

    // Then falls to absolute URL handling:
    // try { const parsed = new URL(processedUrl); ... return url; }
    // It returns processedUrl (which is the R2 link).

    return processedUrl;
}

// Test Cases
const testCases = [
    "http://qualitour.local/wp-content/uploads/2024/01/image.jpg",
    "https://qualitour.local/wp-content/uploads/2024/01/image.jpg",
    "http://qualitour-zh.local/wp-content/uploads/2024/01/image.jpg",
    "https://qualitour.isquarestudio.com/wp-content/uploads/2024/01/image.jpg",
    "http://qualitour.local/some-other-path/file.pdf"
];

console.log("--- Testing URL Rewriting Logic (Simulating BUILD) ---");
testCases.forEach(input => {
    const output = wpUrl(input);
    console.log(`Input:  ${input}`);
    console.log(`Output: ${output}`);
    console.log(`Match?  ${output.startsWith('https://qualitour-assets.isquarestudio.com') && input.includes('uploads') ? '✅ YES' : (input.includes('uploads') ? '❌ NO' : 'Skipped (Not Upload)')}`);
    console.log('---');
});
