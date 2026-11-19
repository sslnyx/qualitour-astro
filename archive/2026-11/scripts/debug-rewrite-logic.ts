// Imports removed for self-contained test

// Mock import.meta.env for the test
// We need to override the behavior in wp-url.ts which checks import.meta.env
// Since we can't easily mock import.meta in node, we might need to adjust wp-url.ts to accept an optional env override or rely on process.env fallback if I add it.
// However, looking at wp-url.ts, it uses `import.meta.env`.

// A work around is to just modify wp-url.ts temporarily to default to process.env if import.meta.env is broken,
// OR just trust that I can read the source and manually simulate what's happening.

// Actually, let's verify what `wpUrl` produces given the inputs.
// I will create a modified version of the function here to test the logic exactly as it is in the source
// but with explicit mocked inputs.

function getAssetsBaseUrl(env: any): string | null {
    const assetsUrl = env.PUBLIC_ASSETS_URL;
    if (assetsUrl) {
        return assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl;
    }
    return null;
}

function getWpBaseUrl(env: any): string {
    const apiUrl = env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        env.PUBLIC_WORDPRESS_API_URL ||
        env.WORDPRESS_API_URL;

    if (apiUrl) {
        try {
            const parsed = new URL(apiUrl);
            return parsed.origin;
        } catch { }
    }
    return 'https://qualitour.isquarestudio.com';
}

function testWpUrl(url: string, env: any) {
    console.log('--- Testing URL:', url);
    console.log('Env:', JSON.stringify(env, null, 2));

    const isDev = !!env.DEV;
    const isBuild = !isDev; // In the code it is !isDev

    let processedUrl = url;

    if (isBuild) {
        const localDomainPattern = new RegExp('https?://qualitour' + '(-zh)?' + '\\\.local', 'g');
        const assetsBase = getAssetsBaseUrl(env);
        const wpBase = getWpBaseUrl(env);
        const prodWpDomain = 'https://qualitour.isquarestudio.com';

        console.log('isBuild: true');
        console.log('assetsBase:', assetsBase);
        console.log('wpBase:', wpBase);

        if (assetsBase && processedUrl.includes('/wp-content/uploads/')) {
            console.log('Matched uploads check');
            processedUrl = url.replace(localDomainPattern, assetsBase);
            processedUrl = processedUrl.replace(wpBase, assetsBase);
            processedUrl = processedUrl.replace(prodWpDomain, assetsBase);
        } else {
            console.log('Did not match uploads check');
            processedUrl = url.replace(localDomainPattern, wpBase);
        }
    } else {
        console.log('isBuild: false (DEV mode output would be unchanged)');
    }

    console.log('RESULT:', processedUrl);
    return processedUrl;
}

// SIMULATE THE SCENARIO
const mockEnv = {
    DEV: false, // Prod build
    PUBLIC_ASSETS_URL: 'https://qualitour-assets.isquarestudio.com',
    PUBLIC_WORDPRESS_CUSTOM_API_URL: 'http://qualitour.local/wp-json/qualitour/v1'
};

const problematicUrl = 'https://qualitour.isquarestudio.com/wp-content/uploads/2023/07/kaja-sariwating-0HptvJ68yxY-unsplash-1024x683.jpg';

testWpUrl(problematicUrl, mockEnv);
