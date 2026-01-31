

/**
 * Get WordPress base URL for API calls.
 */
export function getWpBaseUrl(): string {
    const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as any;

    // Use origin of the WordPress API URL
    const apiUrl = env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        env.PUBLIC_WORDPRESS_API_URL ||
        env.WORDPRESS_API_URL;

    if (apiUrl) {
        try {
            const parsed = new URL(apiUrl);
            // In PROD (build), we don't return local domains to prevent leakage.
            // We silent the warning if an R2 Assets URL is available to handle images.
            if (import.meta.env.PROD && parsed.hostname.endsWith('.local')) {
                // Silently fallback to production domain for non-image API calls
            } else {
                return parsed.origin;
            }
        } catch {
            // fallback
        }
    }

    // Production fallback
    return 'https://qualitour.isquarestudio.com';
}

/**
 * Get the Assets CDN (R2) URL if configured.
 */
export function getAssetsBaseUrl(): string | null {
    const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as any;
    // Prefer PUBLIC_ASSETS_URL if set
    const assetsUrl = env.PUBLIC_ASSETS_URL;

    if (assetsUrl) {
        return assetsUrl.endsWith('/') ? assetsUrl.slice(0, -1) : assetsUrl;
    }

    return null;
}

/**
 * Generate a Cloudflare Image Transformation URL.
 * See: https://developers.cloudflare.com/images/transform-images/
 */
export function getCfTransformUrl(url: string, options: { width?: number; height?: number; format?: string; quality?: number } = {}): string {
    if (!url) return url;

    const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as any;
    const isTransformEnabled = env.PUBLIC_CF_IMAGE_TRANSFORM === 'true' || env.PUBLIC_CF_IMAGE_TRANSFORM === true;
    const assetsBase = getAssetsBaseUrl();

    // Only apply transformation if enabled and we have an assets base (R2/CDN)
    if (!isTransformEnabled || !assetsBase || !url.includes(assetsBase)) {
        return url;
    }

    const { width, height, format = 'auto', quality = 80 } = options;
    const params = [];
    if (width) params.push(`width=${width}`);
    if (height) params.push(`height=${height}`);
    params.push(`format=${format}`);
    params.push(`quality=${quality}`);

    const paramsString = params.join(',');

    // Cloudflare Transformation syntax: <DOMAIN>/cdn-cgi/image/<PARAMS>/<PATH>
    // Note: The URL must be absolute or relative to the zone.
    // If it's already an absolute URL on our assets domain, we insert the cgi path.
    return url.replace(assetsBase, `${assetsBase}/cdn-cgi/image/${paramsString}`);
}

/**
 * Check if a path is a YouTube thumbnail path.
 */
function isYouTubeThumbnail(path: string): boolean {
    return path.startsWith('/vi/');
}

/**
 * Convert a WordPress URL to the correct base URL for the current environment.
 * Primarily handles local development URLs (qualitour.local) and ensures 
 * they point to the configured WordPress instance during builds.
 * @param url The WordPress URL to convert
 */
export function wpUrl(url: string): string {
    if (!url) return url;

    // Environment detection
    const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as Record<string, any>;
    const isDev = !!env.DEV;
    const isBuild = !isDev;

    let processedUrl = url;

    // During BUILD, we MUST replace unreachable local domains with reachable sources.
    if (isBuild) {
        const localDomainPattern = new RegExp('https?://qualitour' + '(-zh)?' + '\\\.local', 'g');
        const assetsBase = getAssetsBaseUrl();
        const wpBase = getWpBaseUrl();

        // Direct mapping to R2 for uploads if available
        if (assetsBase && processedUrl.includes('/wp-content/uploads/')) {
            processedUrl = url.replace(localDomainPattern, assetsBase);
            // Also handle case where it was already production WP domain
            processedUrl = processedUrl.replace(wpBase, assetsBase);
        } else {
            // Standard fallback to production WP for other paths
            processedUrl = url.replace(localDomainPattern, wpBase);
        }
    }

    // Remove known domains to make paths relative
    const domains = [
        // 'http://qualitour.local', // Handled by direct replacement above
        'https://qualitour.local',
        'https://qualitour.isquarestudio.com',
        'https://qualitour-fe.sslnyx.workers.dev'
    ];

    for (const domain of domains) {
        if (processedUrl.startsWith(domain)) {
            processedUrl = processedUrl.substring(domain.length);
            break; // Assume only one domain prefix
        }
    }

    // Handle relative paths (after domain removal)
    if (processedUrl.startsWith('/')) {
        if (isYouTubeThumbnail(processedUrl)) {
            return `https://img.youtube.com${processedUrl}`;
        }
        // Don't prefix internal Astro assets or other common non-WordPress paths
        if (processedUrl.startsWith('/_astro/') || processedUrl.startsWith('/public/')) {
            return processedUrl;
        }
        return `${getWpBaseUrl()}${processedUrl}`;
    }

    // Handle absolute URLs (if still absolute after domain removal, or if it was never a known domain)
    try {
        const parsed = new URL(processedUrl);

        // 1. YouTube specialized handling
        if (isYouTubeThumbnail(parsed.pathname)) {
            return `https://img.youtube.com${parsed.pathname}`;
        }

        // 2. Local URL rewriting (Crucial for build-time optimization)
        // If the URL is absolute but points to a local domain, we MUST rewrite it 
        // to our target WordPress base URL so Astro can download/optimize it.
        const localDomains = ['qualitour.local', 'qualitour-zh.local', 'localhost'];
        if (localDomains.some(domain => parsed.hostname.includes(domain))) {
            const targetBase = getWpBaseUrl();
            return `${targetBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
        }

        // Return original URL if it's already an external/correct absolute URL
        return url;
    } catch {
        // Not a valid URL, return as-is
        return url;
    }
}

/**
 * Process HTML content to replace local WordPress image URLs with correct environment URLs.
 * This is useful for content rendered via dangerouslySetInnerHTML.
 * Handles src, href, and CSS url().
 */
export function processHtmlContent(html: string): string {
    if (!html) return html;

    // Replace src="..." and src='...' and href="..." and href='...'
    let processed = html.replace(/(?:src|href)=["']([^"']+)["']/g, (match, url) => {
        const newUrl = wpUrl(url);
        if (newUrl !== url) {
            return match.replace(url, newUrl);
        }
        return match;
    });

    // Handle srcset and data-srcset
    processed = processed.replace(/(?:srcset|data-srcset)=["']([^"']+)["']/g, (match, content) => {
        const parts = content.split(',');
        const newParts = parts.map((part: string) => {
            const trimmed = part.trim();
            const [url, ...descriptor] = trimmed.split(/\s+/);

            if (url) {
                const newUrl = wpUrl(url);
                if (descriptor.length > 0) {
                    return `${newUrl} ${descriptor.join(' ')}`;
                }
                return newUrl;
            }
            return part;
        });

        const newContent = newParts.join(', ');
        if (newContent !== content) {
            return match.replace(content, newContent);
        }
        return match;
    });

    // Replace url(...) for CSS
    processed = processed.replace(/url\(["']?([^"'\)]+)["']?\)/g, (match, url) => {
        const newUrl = wpUrl(url);
        if (newUrl !== url) {
            return `url(${newUrl})`;
        }
        return match;
    });

    return processed;
}

/**
 * Recursively sanitize an object or array, applying wpUrl to all string values
 * that look like they might be WordPress URLs.
 */
export function sanitizeUrls<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
        // In DEV mode, skip domain replacement to preserve local URLs for Astro image optimization
        if (import.meta.env.DEV) {
            return wpUrl(obj) as unknown as T;
        }
        // Aggressively replace local domain in any string (including HTML blocks)
        // Construct regex dynamically to prevent literal from being bundled
        const devDomain = new RegExp('https?://qualitour' + '(-zh)?' + '\\\.local', 'g');
        const prodDomain = 'https://qualitour.isquarestudio.com';
        const processed = obj.replace(devDomain, prodDomain);
        return wpUrl(processed) as unknown as T;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeUrls(item)) as unknown as T;
    }

    if (typeof obj === 'object') {
        const result = { ...obj } as any;
        for (const key in result) {
            if (Object.prototype.hasOwnProperty.call(result, key)) {
                result[key] = sanitizeUrls(result[key]);
            }
        }
        return result as T;
    }

    return obj;
}
