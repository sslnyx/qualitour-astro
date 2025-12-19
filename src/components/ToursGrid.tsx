/**
 * ToursGrid - Client-side filterable tours grid with pagination
 * 
 * Reads URL query params and filters tours in the browser.
 * Works with static Astro pages by handling filtering client-side.
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import type { WPTour, WPTourDestination, WPTourDuration, WPTourType } from '../lib/wordpress/types';
import { TourCard } from './TourCard';

interface ToursGridProps {
    tours: WPTour[];
    destinations: WPTourDestination[];
    durations: WPTourDuration[];
    types: WPTourType[];
    lang: string;
}

interface FilterState {
    destination: string;
    type: string;
    duration: string;
    q: string;
}

const ITEMS_PER_PAGE = 12;

function getFiltersFromUrl(): FilterState {
    if (typeof window === 'undefined') {
        return { destination: '', type: '', duration: '', q: '' };
    }
    const params = new URLSearchParams(window.location.search);
    return {
        destination: params.get('destination') || '',
        type: params.get('type') || '',
        duration: params.get('duration') || '',
        q: params.get('q') || '',
    };
}

export function ToursGrid({ tours, destinations, durations, types, lang }: ToursGridProps) {
    const [filters, setFilters] = useState<FilterState>(getFiltersFromUrl);
    const [currentPage, setCurrentPage] = useState(1);
    const gridRef = useRef<HTMLDivElement>(null);

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

    // Map destination slugs to their descendant IDs for recursive filtering
    const destinationIdMap = useMemo(() => {
        const map = new Map<string, number[]>();

        const getDescendantIds = (parentId: number): number[] => {
            const children = destinations.filter(d => d.parent === parentId);
            let ids = children.map(c => c.id);
            children.forEach(c => {
                ids = [...ids, ...getDescendantIds(c.id)];
            });
            return ids;
        };

        destinations.forEach(dest => {
            map.set(dest.slug, [dest.id, ...getDescendantIds(dest.id)]);
        });

        return map;
    }, [destinations]);

    // Filter tours based on current filters
    const filteredTours = useMemo(() => {
        let result = tours;

        if (filters.duration) {
            result = result.filter((tour) => {
                // Check in durations taxonomy
                const hasDuration = tour.tour_terms?.durations?.some((d) => d.slug === filters.duration);
                if (hasDuration) return true;

                // Check in categories taxonomy (fallback for tours tagged with categories instead of durations)
                const hasCategory = tour.tour_terms?.categories?.some((c) => {
                    if (c.slug === filters.duration) return true;
                    // Special case for single-day duration which often maps to '1-day-tour' category
                    if (filters.duration === 'single-day' && c.slug === '1-day-tour') return true;
                    return false;
                });
                return hasCategory;
            });
        }

        if (filters.type) {
            result = result.filter((tour) =>
                tour.tour_terms?.types?.some((t) => t.slug === filters.type)
            );
        }

        if (filters.destination) {
            const allowedIds = destinationIdMap.get(filters.destination) || [];
            result = result.filter((tour) =>
                tour.tour_terms?.destinations?.some((d) => allowedIds.includes(d.id))
            );
        }

        if (filters.q) {
            const query = filters.q.toLowerCase();
            result = result.filter(
                (tour) =>
                    tour.title.rendered.toLowerCase().includes(query) ||
                    tour.excerpt.rendered.toLowerCase().includes(query)
            );
        }

        return result;
    }, [tours, filters, destinationIdMap]);

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

    const hasActiveFilters = filters.destination || filters.type || filters.duration || filters.q;
    const localePrefix = lang === 'en' ? '' : `/${lang}`;

    const t = {
        showing: lang === 'zh' ? '显示' : 'Showing',
        of: lang === 'zh' ? '共' : 'of',
        tours: lang === 'zh' ? '个行程' : 'tours',
        filters: lang === 'zh' ? '筛选' : 'Filters',
        previous: lang === 'zh' ? '上一页' : 'Previous',
        next: lang === 'zh' ? '下一页' : 'Next',
        noTours: lang === 'zh' ? '未找到相关行程' : 'No tours found',
        noToursDesc: lang === 'zh' ? '尝试调整您的筛选条件或搜索关键词' : 'Try adjusting your filters or search criteria',
        viewAll: lang === 'zh' ? '查看所有行程' : 'View All Tours'
    };

    return (
        <div className="flex-1" ref={gridRef}>
            {/* Results Count & Active Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <p className="text-gray-600">
                    {t.showing} <span className="font-semibold text-gray-900">{startIndex + 1}-{Math.min(endIndex, filteredTours.length)}</span> {t.of} <span className="font-semibold text-gray-900">{filteredTours.length}</span> {t.tours}
                </p>

                {/* Mobile Filter Button */}
                <button
                    id="mobile-filter-toggle"
                    className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                    <span className="material-icons text-lg">filter_list</span>
                    {t.filters}
                    {hasActiveFilters && (
                        <span className="bg-[#f7941e] text-white text-xs px-2 py-0.5 rounded-full">
                            {(filters.duration ? 1 : 0) + (filters.type ? 1 : 0) + (filters.destination ? 1 : 0)}
                        </span>
                    )}
                </button>
            </div>

            {/* Tour Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8 mb-12">
                {paginatedTours.map((tour) => (
                    <TourCard key={tour.id} tour={tour} lang={lang} />
                ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 py-8">
                    {/* Previous Button */}
                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <span className="material-icons text-sm">chevron_left</span>
                        <span className="hidden sm:inline">{t.previous}</span>
                    </button>

                    {/* Page Numbers */}
                    <div className="flex gap-1">
                        {getPageNumbers().map((page, index) => (
                            page === '...' ? (
                                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-400">
                                    ...
                                </span>
                            ) : (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page as number)}
                                    className={`px-4 py-2 rounded-lg border transition-colors ${currentPage === page
                                        ? 'bg-orange-500 text-white border-orange-500'
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
                        className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <span className="hidden sm:inline">{t.next}</span>
                        <span className="material-icons text-sm">chevron_right</span>
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
