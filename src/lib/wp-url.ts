/**
 * Cloudflare R2 CDN URL for media assets.
 * This serves images directly from the edge without going through the Worker.
 */
const R2_MEDIA_URL = 'https://qualitour-assets.isquarestudio.com';

/**
 * Get WordPress base URL for API calls (not for media).
 */
export function getWpBaseUrl(): string {
    const apiUrl = import.meta.env.PUBLIC_WORDPRESS_API_URL || import.meta.env.WORDPRESS_API_URL;

    if (apiUrl) {
        try {
            const parsed = new URL(apiUrl);
            return parsed.origin;
        } catch {
            // fallback
        }
    }

    // Fallback - only use local dev URL in development
    if (import.meta.env.DEV) {
        return 'https://handsome-cellar.localsite.io';
    }

    return '';
}

/**
 * Check if a path is a WordPress media upload path.
 */
function isMediaPath(path: string): boolean {
    return path.startsWith('/wp-content/uploads/');
}

/**
 * Check if a path is a YouTube thumbnail path (simulated by some WP plugins).
 * Pattern: /vi/{video_id}/{quality}.jpg
 */
function isYouTubeThumbnail(path: string): boolean {
    return path.startsWith('/vi/');
}

/**
 * Convert a WordPress URL to use R2 CDN for media files.
 * Non-media URLs are passed through unchanged.
 * 
 * @param localUrl - URL like 'http://qualitour.local/wp-content/uploads/...' or '/wp-content/uploads/...'
 * @returns CDN URL for media, or original URL for non-media
 * 
 * @example
 * wpUrl('https://handsome-cellar.localsite.io/wp-content/uploads/2021/02/photo.jpg')
 * // Returns: 'https://qualitour-assets.isquarestudio.com/qualitour/wp-content/uploads/2021/02/photo.jpg'
 */
export function wpUrl(localUrl: string): string {
    if (!localUrl) return localUrl;

    // Handle relative paths
    if (localUrl.startsWith('/')) {
        if (isYouTubeThumbnail(localUrl)) {
            // Serve directly from YouTube CDN
            return `https://img.youtube.com${localUrl}`;
        }
        if (isMediaPath(localUrl)) {
            // Serve media from R2 CDN
            return `${R2_MEDIA_URL}${localUrl}`;
        }
        // Non-media paths go to WordPress
        return `${getWpBaseUrl()}${localUrl}`;
    }

    // Handle full URLs
    try {
        const parsed = new URL(localUrl);
        const path = parsed.pathname + parsed.search + parsed.hash;

        if (isYouTubeThumbnail(path)) {
            // Serve directly from YouTube CDN
            return `https://img.youtube.com${path}`;
        }

        if (isMediaPath(path)) {
            // Serve media from R2 CDN
            return `${R2_MEDIA_URL}${path}`;
        }
        // Non-media paths go to WordPress
        return `${getWpBaseUrl()}${path}`;
    } catch {
        return localUrl;
    }
}
