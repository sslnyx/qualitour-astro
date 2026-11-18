import { getLocalePrefix, type Locale } from "../i18n/config";
/**
 * ToursGrid - Client-side filterable tours grid with pagination
 * 
 * Reads URL query params and filters tours in the browser.
 * Works with static Astro pages by handling filtering client-side.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import type { WPTour } from '../lib/wordpress/types';
import { TourCard } from './TourCard';

interface ToursGridProps {
    tours: WPTour[];
    lang: string;
}

interface FilterState {
    destination: string;
    style: string;
    q: string;
}

const ITEMS_PER_PAGE = 12;

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

export function ToursGrid({ tours, lang }: ToursGridProps) {
    const [filters, setFilters] = useState<FilterState>(getFiltersFromUrl);
    const [currentPage, setCurrentPage] = useState(1);
    const gridRef = useRef<HTMLDivElement>(null);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

    // Listen for URL changes (popstate) and update filters
    useEffect(() => {
        const handleUrlChange = () => {
            setFilters(getFiltersFromUrl());
        };

        // Initial load
        handleUrlChange();

        // Listen for back/forward navigation
        window.addEventListener('popstate', handleUrlChange);

        // Listen for custom event when filters change via links
        window.addEventListener('urlchange', handleUrlChange);

        return () => {
            window.removeEventListener('popstate', handleUrlChange);
            window.removeEventListener('urlchange', handleUrlChange);
        };
    }, []);

    useEffect(() => {
        const handleFilterState = (event: Event) => {
            setMobileFiltersOpen(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
        };
        window.addEventListener('mobile-filter-state', handleFilterState);
        return () => window.removeEventListener('mobile-filter-state', handleFilterState);
    }, []);

    // Filter tours based on current filters
    const filteredTours = useMemo(() => {
        let result = tours;

        if (filters.style) {
            result = result.filter((tour) =>
                tour.tour_terms?.styles?.some((t) => t.slug === filters.style)
            );
        }

        // Tours are tagged at a city; destinationScope also lists every ancestor, so a country or continent matches.
        if (filters.destination) {
            result = result.filter((tour) =>
                tour.tour_terms?.destinationScope?.includes(filters.destination)
            );
        }

        if (filters.q) {
            const query = filters.q.toLowerCase();
            result = result.filter(
                (tour) =>
                    // Match against title (stripping only HTML tags)
                    tour.title.rendered
                        .replace(/<[^>]*>/g, '')
                        .toLowerCase()
                        .includes(query)
            );
        }

        return result;
    }, [tours, filters]);

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filters]);

    // Calculate pagination
    const totalPages = Math.ceil(filteredTours.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const paginatedTours = filteredTours.slice(startIndex, endIndex);

    // Scroll to grid top when page changes
    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const showPages = 5; // Show 5 page numbers max

        if (totalPages <= showPages) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage > 3) {
                pages.push('...');
            }

            // Show pages around current
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                pages.push(i);
            }

            if (currentPage < totalPages - 2) {
                pages.push('...');
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    };

    const hasActiveFilters = filters.destination || filters.style || filters.q;
    const localePrefix = getLocalePrefix(lang as Locale);

    const t = {
        showing: lang === 'zh' ? '顯示' : 'Showing',
        of: lang === 'zh' ? '共' : 'of',
        tours: lang === 'zh' ? '個行程' : 'tours',
        filters: lang === 'zh' ? '篩選' : 'Filters',
        previous: lang === 'zh' ? '上一頁' : 'Previous',
        next: lang === 'zh' ? '下一頁' : 'Next',
        noTours: lang === 'zh' ? '未找到相關行程' : 'No tours found',
        noToursDesc: lang === 'zh' ? '嘗試調整篩選條件或搜尋關鍵字' : 'Try adjusting your filters or search criteria',
        viewAll: lang === 'zh' ? '查看所有行程' : 'View All Tours',
        searchingFor: lang === 'zh' ? '正在搜尋' : 'Searching for',
        clearSearch: lang === 'zh' ? '清除搜尋' : 'Clear search'
    };

    const clearSearch = () => {
        const params = new URLSearchParams(window.location.search);
        params.delete('q');
        const queryString = params.toString();
        window.history.pushState({}, '', queryString ? `${localePrefix}/tours?${queryString}` : `${localePrefix}/tours`);
        window.dispatchEvent(new Event('urlchange'));
    };

    return (
        <div className="min-w-0 flex-1" ref={gridRef}>
            {/* Results Count & Active Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <p className="text-gray-600">
                    {t.showing} <span className="font-semibold text-gray-900">{filteredTours.length ? `${startIndex + 1}-${Math.min(endIndex, filteredTours.length)}` : '0'}</span> {t.of} <span className="font-semibold text-gray-900">{filteredTours.length}</span> {t.tours}
                </p>

                {/* Mobile Filter Button */}
                <button
                    id="mobile-filter-toggle"
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    aria-haspopup="dialog"
                    aria-controls="tour-filter-drawer"
                    aria-expanded={mobileFiltersOpen}
                    onClick={(event) => window.dispatchEvent(new CustomEvent("toggle-mobile-filters", { detail: { trigger: event.currentTarget } }))}
                >
                    <span className="material-icons text-lg" aria-hidden="true">filter_list</span>
                    {t.filters}
                    {hasActiveFilters && (
                        <span className="bg-[#f7941e] text-white text-xs px-2 py-0.5 rounded-full">
                        {(filters.style ? 1 : 0) + (filters.destination ? 1 : 0) + (filters.q ? 1 : 0)}
                        </span>
                    )}
                </button>
            </div>

            {filters.q && (
                <div className="mb-6 flex flex-wrap items-center gap-2 text-sm text-gray-700" aria-live="polite">
                    <span>{t.searchingFor}</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-medium text-gray-900">
                        “{filters.q}”
                    </span>
                    <button
                        type="button"
                        onClick={clearSearch}
                        className="text-sm font-medium text-orange-600 hover:text-orange-700 underline underline-offset-2"
                    >
                        {t.clearSearch}
                    </button>
                </div>
            )}

            {/* Tour Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-12">
                {paginatedTours.map((tour) => (
                    <TourCard key={tour.id} tour={tour} lang={lang} />
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-1 py-8 sm:gap-2">
                    {/* Previous Button */}
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label={t.previous}
                        className="flex min-h-11 min-w-8 shrink-0 items-center justify-center gap-1 px-1.5 sm:px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <span className="material-icons text-sm" aria-hidden="true">chevron_left</span>
                        <span className="hidden sm:inline">{t.previous}</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex min-w-0 flex-wrap justify-center gap-0.5 sm:gap-1">
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} aria-hidden="true" className="px-0.5 py-2 text-gray-500 sm:px-3">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page as number)}
                                    aria-current={currentPage === page ? "page" : undefined}
                                    className={`min-h-11 min-w-8 px-1.5 sm:px-4 rounded-lg border transition-colors ${currentPage === page
                                        ? 'bg-orange-800 text-white border-orange-800'
                                        : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}
                                >
                                    {page}
                                </button>
                            )
                        ))}
                    </div>

                    {/* Next Button */}
                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label={t.next}
                        className="flex min-h-11 min-w-8 shrink-0 items-center justify-center gap-1 px-1.5 sm:px-4 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <span className="hidden sm:inline">{t.next}</span>
                        <span className="material-icons text-sm" aria-hidden="true">chevron_right</span>
                    </button>
                </div>
            )}

            {/* Empty State */}
            {filteredTours.length === 0 && (
                <div className="text-center py-16">
                    <span className="material-icons text-6xl text-gray-300 mb-4 block">search_off</span>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{t.noTours}</h3>
                    <p className="text-gray-500 mb-6">{t.noToursDesc}</p>
                    <a
                        href={`${localePrefix}/tours`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white font-semibold rounded-full hover:bg-orange-600 transition-colors"
                    >
                        {t.viewAll}
                    </a>
                </div>
            )}
        </div>
    );
}

export default ToursGrid;
