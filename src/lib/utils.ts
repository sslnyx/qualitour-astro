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

/**
 * Show a plain whole-dollar or cents amount with thousands separators ("122999" -> "122,999").
 * Anything that is not a bare number (a range, "Inquire", an already formatted "1,299") is returned unchanged.
 */
export function formatPrice(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    const match = /^(\d{4,})(\.\d+)?$/.exec(text);
    if (!match) return text;
    return match[1].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (match[2] ?? '');
}
