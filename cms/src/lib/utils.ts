/**
 * Decode HTML entities from a string
 */
export function decodeHtml(html: string): string {
    if (!html) return '';

    // For server-side rendering, we use a simple replacement for common entities
    // In a browser, we could use DOMParser or a textarea, but this is safer for SSG
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");
}
