export const i18n = {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const localeNames: Record<Locale, string> = {
    en: 'English',
    zh: '繁體中文',
};

export const localeLabels: Record<Locale, string> = {
    en: 'EN',
    zh: '繁',
};

// Helper to get the path prefix for a locale, including deployment base path.
// For Cloudflare (root): '' or '/zh'
// For cPanel staging:   '/staging' or '/staging/zh'
export function getLocalePrefix(locale: Locale): string {
    const base = (import.meta.env.BASE_URL || '').replace(/\/$/, '');
    return locale === i18n.defaultLocale ? base : `${base}/${locale}`;
}

// Helper to extract locale from pathname
export function getLocaleFromPathname(pathname: string): Locale {
    // Check if path starts with /zh
    if (pathname.startsWith('/zh/') || pathname === '/zh') {
        return 'zh';
    }
    // Default to English for root paths
    return 'en';
}

// Get current locale from Astro context
export function getCurrentLocale(url: URL): Locale {
    return getLocaleFromPathname(url.pathname);
}
