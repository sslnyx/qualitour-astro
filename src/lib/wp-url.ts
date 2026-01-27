

/**
 * Get WordPress base URL for API calls (not for media).
 */
export function getWpBaseUrl(): string {
    const apiUrl = import.meta.env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        import.meta.env.PUBLIC_WORDPRESS_API_URL ||
        import.meta.env.WORDPRESS_API_URL;

    if (apiUrl) {
        try {
            const parsed = new URL(apiUrl);
            return parsed.origin;
        } catch {
            // fallback
        }
    }

    // Development fallback - only use in DEV mode
    if (import.meta.env.DEV) {
        return 'http://qualitour.local';
    }

    // Final production fallback
    return 'https://qualitour.ca';
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
 * wpUrl('http://qualitour.local/wp-content/uploads/2021/02/photo.jpg')
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
        // Media paths and non-media paths both go to WordPress now
        return `${getWpBaseUrl()}${localUrl}`;
    }

    // Handle full URLs
    try {
        const parsed = new URL(localUrl);
        const path = parsed.pathname + parsed.search + parsed.hash;

        // If it matches YouTube pattern (common in WP sites)
        if (isYouTubeThumbnail(path)) {
            return `https://img.youtube.com${path}`;
        }

        // Return original URL for everything else
        return localUrl;
    } catch {
        return localUrl;
    }
}

/**
 * Process HTML content to replace local WordPress image URLs with R2 CDN URLs.
 * This is useful for content rendered via dangerouslySetInnerHTML.
 * Handles src, href, and CSS url().
 */
export function processHtmlContent(html: string): string {
    if (!html) return html;

    // Replace src="..." and src='...' and href="..." and href='...'
    // This also coincidentally handles data-src because 'src' matches the end of 'data-src'
    let processed = html.replace(/(?:src|href)=["']([^"']+)["']/g, (match, url) => {
        const newUrl = wpUrl(url);
        if (newUrl !== url) {
            return match.replace(url, newUrl);
        }
        return match;
    });

    // Handle srcset and data-srcset
    processed = processed.replace(/(?:srcset|data-srcset)=["']([^"']+)["']/g, (match, content) => {
        // defined separators for srcset (comma usually)
        // format: url width/density, url width/density
        const parts = content.split(',');
        const newParts = parts.map((part: string) => {
            // Trim whitespace
            const trimmed = part.trim();
            // Split by space to separate URL from descriptor
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
