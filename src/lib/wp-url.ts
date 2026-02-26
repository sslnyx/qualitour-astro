

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
            // We return the origin even if it's .local during build
            // so that Astro's getImage() can fetch and bundle images.
            // Domain leakage to production is prevented by sanitization in lib/wp-url.ts
            return parsed.origin;
        } catch {
            // fallback
        }
    }

    // Production fallback - Real WordPress Domain
    return 'https://qualitour.ca';
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

    // Prevent double optimization: if URL already contains /cdn-cgi/image/, return it as is
    // matching strict path structure to avoid false positives in filenames
    if (url.includes('/cdn-cgi/image/')) {
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
 * WordPress is at qualitour.ca/app so /app/wp-content path is needed.
 */
export function wpUrl(url: string): string {
    if (!url) return url;

    const baseUrl = 'https://qualitour.ca/app';

    if (url.includes(baseUrl)) {
        return url;
    }

    let processedUrl = url
        .replace(/https?:\/\/qualitour\.local/g, baseUrl)
        .replace(/https?:\/\/qualitour-zh\.local/g, baseUrl)
        .replace(/https?:\/\/qualitour\.isquarestudio\.com/g, baseUrl)
        .replace(/https?:\/\/qualitour\.ca(?!\/app)/g, 'https://qualitour.ca/app');

    return processedUrl;
}

/**
 * Safely extract a URL string from an image size value.
 * WordPress can return either a string URL or an object with url property.
 */
function extractSizeUrl(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
        return value;
    }
    if (typeof value === 'object' && value !== null && 'url' in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === 'string' && obj.url.trim()) {
            return obj.url;
        }
    }
    return null;
}

/**
 * Get the best available image URL from tour featured_image_url data.
 * Centralized logic to handle various formats and prefer reliable sizes.
 */
export function extractTourImageUrl(featuredImage: any): string | null {
    if (!featuredImage) return null;

    let rawUrl: string | null = null;

    // 1. Handle string URL
    if (typeof featuredImage === 'string' && featuredImage.trim()) {
        rawUrl = featuredImage;
    }

    // 2. Handle object with size properties (WPTourFeaturedImage)
    else if (typeof featuredImage === 'object' && featuredImage !== null) {
        // Preference order: full -> medium_large -> large -> medium -> thumbnail
        // Use full first since intermediate sizes may not exist on production
        rawUrl = extractSizeUrl(featuredImage.full) ||
            extractSizeUrl(featuredImage.medium_large) ||
            extractSizeUrl(featuredImage.large) ||
            extractSizeUrl(featuredImage.medium) ||
            extractSizeUrl(featuredImage.thumbnail);
    }

    return rawUrl ? wpUrl(rawUrl) : null;
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
        let processed = obj.replace(devDomain, prodDomain);

        // Ensure R2 rewrite happens here too for robustness
        const assetsBase = getAssetsBaseUrl();
        if (assetsBase && processed.includes('/wp-content/uploads/')) {
            const prodUploads = new RegExp('https?://qualitour\.isquarestudio\.com/wp-content/uploads/', 'g');
            processed = processed.replace(prodUploads, `${assetsBase}/wp-content/uploads/`);
        }

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
