/**
 * TourDestinationChips - quick destination filter shown in the tours page header.
 *
 * Uses the same URL contract as TourFilterSidebarClient / ToursGrid:
 * it rewrites ?destination=<slug> with pushState and dispatches "urlchange"
 * so the grid and sidebar re-read the URL without a page reload.
 */

import { useEffect, useMemo, useState } from 'react';
import { getLocalePrefix, type Locale } from '../i18n/config';
import type { CategoryTerm } from '../lib/wordpress/types';
import { decodeHtml } from '../lib/utils';

interface Props {
    destinations: CategoryTerm[];
    lang: string;
    /** Max number of destination chips (besides "All"). */
    limit?: number;
}

function getDestinationFromUrl(): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('destination') || '';
}

export function TourDestinationChips({ destinations, lang, limit = 7 }: Props) {
    const [active, setActive] = useState('');

    // Continents (top level) that actually have tours, biggest first.
    const chips = useMemo(
        () =>
            destinations
                .filter((d) => !d.parentSlug && (d.count || 0) > 0)
                .sort((a, b) => (b.count || 0) - (a.count || 0))
                .slice(0, limit),
        [destinations, limit]
    );

    // A selected sub-destination should still highlight its parent chip.
    const parentSlugOf = useMemo(() => {
        const bySlug = new Map(destinations.map((d) => [d.slug, d]));
        return (slug: string) => {
            let current = bySlug.get(slug);
            if (!current) return slug;
            while (current.parentSlug && bySlug.get(current.parentSlug)) {
                current = bySlug.get(current.parentSlug)!;
            }
            return current.slug;
        };
    }, [destinations]);

    useEffect(() => {
        const sync = () => setActive(getDestinationFromUrl());
        sync();
        window.addEventListener('popstate', sync);
        window.addEventListener('urlchange', sync);
        return () => {
            window.removeEventListener('popstate', sync);
            window.removeEventListener('urlchange', sync);
        };
    }, []);

    const select = (slug: string | null) => {
        const localePrefix = getLocalePrefix(lang as Locale);
        const params = new URLSearchParams(window.location.search);
        if (slug) {
            params.set('destination', slug);
        } else {
            params.delete('destination');
        }
        const qs = params.toString();
        window.history.pushState({}, '', qs ? `${localePrefix}/tours?${qs}` : `${localePrefix}/tours`);
        setActive(slug || '');
        window.dispatchEvent(new Event('urlchange'));
    };

    if (chips.length === 0) return null;

    const activeTop = active ? parentSlugOf(active) : '';
    const base =
        'shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f7941e] focus-visible:ring-offset-2';
    const on = 'bg-gray-900 border-gray-900 text-white';
    const off = 'bg-white border-gray-200 text-gray-700 hover:border-[#f7941e] hover:text-[#f7941e]';

    return (
        <div
            role="group"
            aria-label={lang === 'zh' ? '依目的地快速篩選' : 'Quick filter by destination'}
            className="tour-chips -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0 lg:justify-end"
        >
            <button type="button" onClick={() => select(null)} aria-pressed={!active} className={`${base} ${!active ? on : off}`}>
                {lang === 'zh' ? '全部' : 'All'}
            </button>
            {chips.map((dest) => {
                const isOn = activeTop === dest.slug;
                return (
                    <button
                        key={dest.slug}
                        type="button"
                        onClick={() => select(isOn && active === dest.slug ? null : dest.slug)}
                        aria-pressed={isOn}
                        className={`${base} ${isOn ? on : off}`}
                    >
                        {decodeHtml(dest.name)}
                    </button>
                );
            })}
            <style>{`.tour-chips{scrollbar-width:none}.tour-chips::-webkit-scrollbar{display:none}`}</style>
        </div>
    );
}

export default TourDestinationChips;
