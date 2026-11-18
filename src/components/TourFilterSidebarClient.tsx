import { getLocalePrefix, type Locale } from "../i18n/config";
/**
 * TourFilterSidebarClient - React version of filter sidebar
 * 
 * Updates URL params and dispatches events for client-side filtering.
 * Works with ToursGrid.tsx for seamless filtering without page reloads.
 * Supports the desktop sidebar and the mobile filter dialog.
 */

import { useCallback, useState, useEffect, useId, useRef, type KeyboardEvent } from 'react';
import type { CategoryTerm } from '../lib/wordpress/types';
import { decodeHtml } from '../lib/utils';
import TourDestinationPicker from './TourDestinationPicker';

interface Props {
    destinations: CategoryTerm[];
    styles: CategoryTerm[];
    lang: string;
}

interface FilterState {
    destination: string;
    style: string;
    q: string;
}

interface DrawerEventDetail {
    trigger?: HTMLElement;
}

function getFiltersFromUrl(): FilterState {
    if (typeof window === 'undefined') {
        return { destination: '', style: '', q: '' };
    }
    const params = new URLSearchParams(window.location.search);
    return {
        destination: params.get('destination') || '',
        style: params.get('style') || '',
        q: params.get('q') || '',
    };
}

type FilterFieldsProps = Props & {
    filters: FilterState;
    updateFilter: (key: keyof FilterState, value: string | null) => void;
    destinationOpen: boolean;
    setDestinationOpen: (open: boolean) => void;
};

function FilterFields({ destinations, styles, lang, filters, updateFilter, destinationOpen, setDestinationOpen }: FilterFieldsProps) {
    const searchId = useId();
    const styleId = useId();
    const zh = lang === 'zh';
    const searchLabel = zh ? '搜尋行程' : 'Search tours';
    const fieldClass = 'min-h-11 w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 text-base text-gray-900 placeholder-gray-500 focus-visible:outline-2 focus-visible:outline-[#a8410b] sm:text-sm';
    const labelClass = 'mb-1.5 block text-sm font-semibold text-gray-900';

    return (
        <div className="space-y-4">
            <div>
                <label htmlFor={searchId} className={labelClass}>{searchLabel}</label>
                <input
                    id={searchId}
                    type="search"
                    placeholder={zh ? '輸入行程名稱' : 'Enter a tour name'}
                    value={filters.q}
                    onChange={(event) => updateFilter('q', event.target.value)}
                    className={fieldClass}
                />
            </div>

            <TourDestinationPicker
                destinations={destinations}
                value={filters.destination}
                lang={lang}
                open={destinationOpen}
                onOpenChange={setDestinationOpen}
                onChange={(value) => updateFilter('destination', value)}
            />

            {styles.length > 0 && (
                <div>
                    <label htmlFor={styleId} className={labelClass}>{zh ? '旅遊方式' : 'Travel style'}</label>
                    <select
                        id={styleId}
                        value={filters.style}
                        onChange={(event) => updateFilter('style', event.target.value)}
                        className={fieldClass}
                    >
                        <option value="">{zh ? '所有旅遊方式' : 'All travel styles'}</option>
                        {styles.map(style => (
                            <option key={style.id} value={style.slug}>{decodeHtml(style.name)}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );
}

export function TourFilterSidebarClient({ destinations, styles, lang }: Props) {
    const [filters, setFilters] = useState<FilterState>(getFiltersFromUrl);
    const [destinationOpen, setDestinationOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const desktopHeadingRef = useRef<HTMLHeadingElement>(null);
    const viewButtonRef = useRef<HTMLButtonElement>(null);
    const restoreFocusRef = useRef<HTMLElement | null>(null);

    // Sync with URL on mount and popstate
    useEffect(() => {
        const handleUrlChange = () => {
            setFilters(getFiltersFromUrl());
        };
        handleUrlChange();
        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('urlchange', handleUrlChange);
        return () => {
            window.removeEventListener('popstate', handleUrlChange);
            window.removeEventListener('urlchange', handleUrlChange);
        };
    }, []);

    const closeMobileFilters = useCallback(() => {
        setDestinationOpen(false);
        setMobileOpen(false);
    }, []);

    const handleDrawerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
            event.preventDefault();
            closeMobileFilters();
            return;
        }

        if (event.key !== "Tab") return;

        const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable?.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    // Listen for the mobile filter toggle emitted by the results island.
    useEffect(() => {
        const handleToggle = (event: Event) => {
            const detail = (event as CustomEvent<DrawerEventDetail>).detail;
            restoreFocusRef.current = detail?.trigger || (document.activeElement as HTMLElement | null);
            setMobileOpen(true);
        };
        window.addEventListener('toggle-mobile-filters', handleToggle);
        return () => {
            window.removeEventListener('toggle-mobile-filters', handleToggle);
        };
    }, []);

    useEffect(() => {
        if (!mobileOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previousOverflow; };
    }, [mobileOpen]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent('mobile-filter-state', { detail: { open: mobileOpen } }));
        if (mobileOpen) {
            closeButtonRef.current?.focus();
        } else {
            if (restoreFocusRef.current?.getClientRects().length) restoreFocusRef.current.focus({ preventScroll: true });
            restoreFocusRef.current = null;
        }
    }, [mobileOpen]);

    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 64rem)');
        const closeOnDesktop = (event: MediaQueryListEvent) => {
            if (event.matches) closeMobileFilters();
        };
        desktop.addEventListener('change', closeOnDesktop);
        return () => desktop.removeEventListener('change', closeOnDesktop);
    }, [closeMobileFilters]);

    const updateFilter = (key: keyof FilterState, value: string | null) => {
        const localePrefix = getLocalePrefix(lang as Locale);
        const params = new URLSearchParams(window.location.search);

        if (value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        const queryString = params.toString();
        const newUrl = queryString ? `${localePrefix}/tours?${queryString}` : `${localePrefix}/tours`;

        // Update URL without reload
        window.history.pushState({}, '', newUrl);

        // Update local state
        setFilters((prev) => ({
            ...prev,
            [key]: value || '',
        }));

        // Dispatch event for ToursGrid to pick up
        window.dispatchEvent(new Event('urlchange'));
    };

    const clearAllFilters = () => {
        const localePrefix = getLocalePrefix(lang as Locale);
        window.history.pushState({}, '', `${localePrefix}/tours`);
        setFilters({ destination: '', style: '', q: '' });
        setDestinationOpen(false);
        window.dispatchEvent(new Event('urlchange'));
    };

    const hasActiveFilters = Boolean(filters.destination || filters.style || filters.q);
    const activeFilterCount = Object.values(filters).filter(Boolean).length;
    const zh = lang === 'zh';
    const t = {
        filters: zh ? '篩選' : 'Filters',
        clearAll: zh ? '清除全部' : 'Clear all',
        viewResults: zh ? '查看行程' : 'View tours',
        close: zh ? '關閉' : 'Close',
    };
    const fieldProps = { destinations, styles, lang, filters, updateFilter, destinationOpen, setDestinationOpen };
    const clearClass = 'min-h-11 rounded-lg px-2 text-sm font-semibold text-[#a8410b] hover:bg-orange-50 focus-visible:outline-2 focus-visible:outline-[#a8410b]';

    return (
        <>
            <aside className="tour-filter-sidebar sticky top-24 hidden max-h-[calc(100dvh-7rem)] w-72 shrink-0 self-start overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:block">
                <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
                    <h2 ref={desktopHeadingRef} tabIndex={-1} className="flex items-center gap-2 text-lg font-bold text-gray-900">
                        <span className="material-icons text-[#a8410b]" aria-hidden="true">filter_list</span>
                        {t.filters}
                    </h2>
                    {hasActiveFilters && (
                        <button type="button" className={clearClass} onClick={() => {
                            clearAllFilters();
                            desktopHeadingRef.current?.focus({ preventScroll: true });
                        }}>{t.clearAll}</button>
                    )}
                </div>
                <FilterFields {...fieldProps} />
            </aside>

            {/* Mobile Drawer */}
            {mobileOpen && (
            <div className="lg:hidden fixed inset-0 z-50">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/50"
                    onClick={closeMobileFilters}
                    aria-hidden="true"
                />

                {/* Drawer Panel */}
                <div
                    ref={drawerRef}
                    id="tour-filter-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="tour-filter-heading"
                    onKeyDown={handleDrawerKeyDown}
                    className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[min(90dvh,46rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl"
                >
                    {/* Header */}
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 py-2.5 sm:px-6">
                        <h2 id="tour-filter-heading" className="font-bold text-lg text-gray-900 flex items-center gap-2">
                            <span className="material-icons text-[#f7941e]" aria-hidden="true">filter_list</span>
                            {t.filters}
                            {activeFilterCount > 0 && (
                                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-[#8a3309]" aria-hidden="true">
                                    {activeFilterCount}
                                </span>
                            )}
                        </h2>
                        <button
                            ref={closeButtonRef}
                            onClick={closeMobileFilters}
                            type="button"
                            className="grid size-11 place-items-center rounded-xl text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#a8410b]"
                            aria-label={t.close}
                        >
                            <span className="material-icons" aria-hidden="true">close</span>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:px-6">
                        <FilterFields {...fieldProps} />
                    </div>

                    <div className="flex shrink-0 items-center gap-3 border-t border-gray-200 bg-white px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        {hasActiveFilters && (
                            <button type="button" className={clearClass} onClick={() => {
                                clearAllFilters();
                                viewButtonRef.current?.focus({ preventScroll: true });
                            }}>{t.clearAll}</button>
                        )}
                        <button
                            ref={viewButtonRef}
                            onClick={closeMobileFilters}
                            type="button"
                            className="min-h-11 min-w-0 flex-1 rounded-xl bg-[#a8410b] px-4 py-3 font-semibold text-white hover:bg-[#883608] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8410b]"
                        >
                            {t.viewResults}
                        </button>
                    </div>
                </div>
            </div>
            )}

        </>
    );
}

export default TourFilterSidebarClient;
