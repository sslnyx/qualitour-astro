import { getLocalePrefix, type Locale } from "../i18n/config";
/**
 * TourFilterSidebarClient - React version of filter sidebar
 * 
 * Updates URL params and dispatches events for client-side filtering.
 * Works with ToursGrid.tsx for seamless filtering without page reloads.
 * Supports both desktop (sticky sidebar) and mobile (slide-in drawer) views.
 */

import { useState, useEffect, useMemo } from 'react';
import type { WPTourDestination, WPTourDuration, WPTourType } from '../lib/wordpress/types';
import { decodeHtml } from '../lib/utils';

interface Props {
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

interface FilterContentProps {
    filters: FilterState;
    updateFilter: (key: keyof FilterState, value: string | null) => void;
    clearAllFilters: () => void;
    t: any;
    durations: WPTourDuration[];
    types: WPTourType[];
    topLevelDestinations: WPTourDestination[];
    destinationChildren: Map<number, WPTourDestination[]>;
    collapsedSections: Set<string>;
    toggleSection: (section: string) => void;
    hasActiveFilters: boolean;
    isMobile?: boolean;
}

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

function buildDestinationTree(destinations: WPTourDestination[]) {
    const parentMap = new Map<number, WPTourDestination[]>();
    const topLevel: WPTourDestination[] = [];

    destinations.forEach((dest) => {
        if (dest.parent === 0) {
            topLevel.push(dest);
        } else {
            const children = parentMap.get(dest.parent) || [];
            children.push(dest);
            parentMap.set(dest.parent, children);
        }
    });

    return { topLevel, parentMap };
}

// Extracted FilterContent component to prevent re-renders losing focus
function FilterContent({
    filters,
    updateFilter,
    clearAllFilters,
    t,
    durations,
    types,
    topLevelDestinations,
    destinationChildren,
    collapsedSections,
    toggleSection,
    hasActiveFilters,
    isMobile = false
}: FilterContentProps) {
    return (
        <>
            {/* Search Input */}
            <div className="mb-6">
                <div className="relative">
                    <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder={t.searchPlaceholder}
                        value={filters.q}
                        onChange={(e) => updateFilter('q', e.target.value)}
                        className="w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f7941e]/30 focus:border-[#f7941e] transition-all duration-200"
                    />
                    {filters.q && (
                        <button
                            onClick={() => updateFilter('q', null)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <span className="material-icons text-lg">close</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
                <div className="p-3 bg-[#f7941e]/5 rounded-xl border border-[#f7941e]/20 mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">{t.activeFilters}</span>
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-[#f7941e] hover:text-[#d67a1a] font-medium"
                        >
                            {t.clearAll}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {filters.q && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border border-gray-200 text-gray-900">
                                <span className="material-icons text-xs">search</span>
                                "{filters.q}"
                                <button
                                    onClick={() => updateFilter('q', null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        {filters.duration && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border border-gray-200 text-gray-900">
                                <span className="material-icons text-xs">schedule</span>
                                {decodeHtml(durations.find((d) => d.slug === filters.duration)?.name || filters.duration)}
                                <button
                                    onClick={() => updateFilter('duration', null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        {filters.type && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border border-gray-200 text-gray-900">
                                <span className="material-icons text-xs">category</span>
                                {decodeHtml(types.find((t) => t.slug === filters.type)?.name || filters.type)}
                                <button
                                    onClick={() => updateFilter('type', null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                        {filters.destination && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-full text-xs border border-gray-200 text-gray-900">
                                <span className="material-icons text-xs">place</span>
                                {decodeHtml(topLevelDestinations.find((d) => d.slug === filters.destination)?.name ||
                                    [...destinationChildren.values()].flat().find(d => d.slug === filters.destination)?.name ||
                                    filters.destination)}
                                <button
                                    onClick={() => updateFilter('destination', null)}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    ×
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Tour Length Section */}
            {durations.length > 0 && (
                <div className="border-b border-gray-100 pb-4 mb-4">
                    <button
                        className="flex items-center justify-between w-full py-2 text-left group"
                        onClick={() => toggleSection('duration')}
                    >
                        <span className="font-semibold text-gray-900 flex items-center gap-2">
                            <span className="material-icons text-[#f7941e] text-lg">schedule</span>
                            {t.tourLength}
                        </span>
                        <span
                            className={`material-icons text-gray-500 transition-transform duration-200 ${collapsedSections.has('duration') ? '' : 'rotate-180'
                                }`}
                        >
                            expand_more
                        </span>
                    </button>
                    {!collapsedSections.has('duration') && (
                        <div className="mt-3 flex flex-wrap gap-2">
                            {durations.map((dur) => {
                                const isSelected = filters.duration === dur.slug;
                                return (
                                    <button
                                        key={dur.id}
                                        onClick={() => updateFilter('duration', isSelected ? null : dur.slug)}
                                        className={`px-3 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${isSelected
                                            ? 'bg-gradient-to-r from-[#f7941e] to-[#ffb347] text-white border-transparent shadow-md shadow-orange-200'
                                            : 'bg-white text-gray-700 border-gray-200 hover:border-[#f7941e] hover:text-[#f7941e] hover:shadow-sm'
                                            }`}
                                    >
                                        {decodeHtml(dur.name)}
                                        <span className={`ml-1.5 text-xs ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                            ({dur.count || 0})
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Tour Type Section */}
            {types.length > 0 && (
                <div className="border-b border-gray-100 pb-4 mb-4">
                    <button
                        className="flex items-center justify-between w-full py-2 text-left group"
                        onClick={() => toggleSection('types')}
                    >
                        <span className="font-semibold text-gray-900 flex items-center gap-2">
                            <span className="material-icons text-[#f7941e] text-lg">category</span>
                            {t.tourType}
                        </span>
                        <span
                            className={`material-icons text-gray-500 transition-transform duration-200 ${collapsedSections.has('types') ? '' : 'rotate-180'
                                }`}
                        >
                            expand_more
                        </span>
                    </button>
                    {!collapsedSections.has('types') && (
                        <div className="mt-2 space-y-1">
                            {types.map((type) => {
                                const isSelected = filters.type === type.slug;
                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => updateFilter('type', isSelected ? null : type.slug)}
                                        className="flex items-center gap-3 py-2 w-full text-left hover:text-[#f7941e] transition-colors"
                                    >
                                        <span
                                            className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[#f7941e] border-[#f7941e]' : 'border-gray-300'
                                                }`}
                                        >
                                            {isSelected && (
                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                                </svg>
                                            )}
                                        </span>
                                        <span className={`flex-1 text-sm ${isSelected ? 'text-[#f7941e] font-medium' : 'text-gray-700'}`}>
                                            {decodeHtml(type.name)}
                                        </span>
                                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                            {type.count || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Destinations Section */}
            {topLevelDestinations.length > 0 && (
                <div className="pb-4">
                    <button
                        className="flex items-center justify-between w-full py-2 text-left group"
                        onClick={() => toggleSection('destinations')}
                    >
                        <span className="font-semibold text-gray-900 flex items-center gap-2">
                            <span className="material-icons text-[#f7941e] text-lg">place</span>
                            {t.destinations}
                        </span>
                        <span
                            className={`material-icons text-gray-500 transition-transform duration-200 ${collapsedSections.has('destinations') ? '' : 'rotate-180'
                                }`}
                        >
                            expand_more
                        </span>
                    </button>
                    {!collapsedSections.has('destinations') && (
                        <div className={`mt-2 ${isMobile ? 'max-h-48' : 'max-h-64'} overflow-y-auto pr-2 custom-scrollbar`}>
                            {topLevelDestinations.map((dest) => {
                                const isSelected = filters.destination === dest.slug;
                                const children = destinationChildren.get(dest.id) || [];
                                return (
                                    <div key={dest.id}>
                                        <button
                                            onClick={() => updateFilter('destination', isSelected ? null : dest.slug)}
                                            className="flex items-center gap-3 py-2 w-full text-left hover:text-[#f7941e] transition-colors"
                                        >
                                            <span
                                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected ? 'bg-[#f7941e] border-[#f7941e]' : 'border-gray-300'
                                                    }`}
                                            >
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                                    </svg>
                                                )}
                                            </span>
                                            <span className={`flex-1 text-sm ${isSelected ? 'text-[#f7941e] font-medium' : 'text-gray-700'}`}>
                                                {decodeHtml(dest.name)}
                                            </span>
                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {dest.count || 0}
                                            </span>
                                        </button>
                                        {children.length > 0 && (
                                            <div className="border-l-2 border-gray-100 ml-2 pl-3">
                                                {children.map((child) => {
                                                    const isChildSelected = filters.destination === child.slug;
                                                    return (
                                                        <button
                                                            key={child.id}
                                                            onClick={() => updateFilter('destination', isChildSelected ? null : child.slug)}
                                                            className="flex items-center gap-3 py-1.5 w-full text-left hover:text-[#f7941e] transition-colors"
                                                        >
                                                            <span
                                                                className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${isChildSelected ? 'bg-[#f7941e] border-[#f7941e]' : 'border-gray-300'
                                                                    }`}
                                                            >
                                                                {isChildSelected && (
                                                                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                                                                    </svg>
                                                                )}
                                                            </span>
                                                            <span
                                                                className={`flex-1 text-xs ${isChildSelected ? 'text-[#f7941e] font-medium' : 'text-gray-600'
                                                                    }`}
                                                            >
                                                                {decodeHtml(child.name)}
                                                            </span>
                                                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full text-[10px]">
                                                                {child.count || 0}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </>
    );
}

export function TourFilterSidebarClient({ destinations, durations, types, lang }: Props) {
    const [filters, setFilters] = useState<FilterState>(getFiltersFromUrl);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [mobileOpen, setMobileOpen] = useState(false);

    const { topLevel: topLevelDestinations, parentMap: destinationChildren } = useMemo(
        () => buildDestinationTree(destinations),
        [destinations]
    );

    // Sync with URL on mount and popstate
    useEffect(() => {
        const handleUrlChange = () => {
            setFilters(getFiltersFromUrl());
        };
        handleUrlChange();
        window.addEventListener('popstate', handleUrlChange);
        return () => window.removeEventListener('popstate', handleUrlChange);
    }, []);

    // Listen for mobile filter toggle events
    useEffect(() => {
        const handleToggle = () => {
            setMobileOpen(prev => !prev);
        };

        // Wire up the mobile filter toggle button from ToursGrid
        const toggleBtn = document.getElementById('mobile-filter-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', handleToggle);
        }

        // Also listen for custom event
        window.addEventListener('toggle-mobile-filters', handleToggle);

        return () => {
            if (toggleBtn) {
                toggleBtn.removeEventListener('click', handleToggle);
            }
            window.removeEventListener('toggle-mobile-filters', handleToggle);
        };
    }, []);

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileOpen]);

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
        setFilters({ destination: '', type: '', duration: '', q: '' });
        window.dispatchEvent(new Event('urlchange'));
    };

    const toggleSection = (section: string) => {
        setCollapsedSections((prev) => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            } else {
                next.add(section);
            }
            return next;
        });
    };

    const hasActiveFilters = !!(filters.destination || filters.type || filters.duration || filters.q);
    const activeFilterCount = (filters.duration ? 1 : 0) + (filters.type ? 1 : 0) + (filters.destination ? 1 : 0) + (filters.q ? 1 : 0);

    const t = {
        filters: lang === 'zh' ? '筛选' : 'Filters',
        searchPlaceholder: lang === 'zh' ? '搜索行程...' : 'Search tours...',
        activeFilters: lang === 'zh' ? '已选筛选条件' : 'Active Filters',
        clearAll: lang === 'zh' ? '清除所有' : 'Clear All',
        tourLength: lang === 'zh' ? '行程天数' : 'Tour Length',
        tourType: lang === 'zh' ? '旅游类型' : 'Tour Type',
        destinations: lang === 'zh' ? '目的地' : 'Destinations',
        applyFilters: lang === 'zh' ? '应用筛选' : 'Apply Filters',
        close: lang === 'zh' ? '关闭' : 'Close',
    };

    const contentProps = {
        filters,
        updateFilter,
        clearAllFilters,
        t,
        durations,
        types,
        topLevelDestinations,
        destinationChildren,
        collapsedSections,
        toggleSection,
        hasActiveFilters
    };

    return (
        <>
            {/* Desktop Sidebar */}
            <aside className="tour-filter-sidebar w-72 flex-shrink-0 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-24 hidden lg:block">
                <h2 className="font-bold text-lg text-gray-900 mb-6 flex items-center gap-2">
                    <span className="material-icons text-[#f7941e]">filter_list</span>
                    {t.filters}
                </h2>
                <FilterContent {...contentProps} />
            </aside>

            {/* Mobile Drawer */}
            <div className={`lg:hidden fixed inset-0 z-50 ${mobileOpen ? 'visible' : 'invisible'}`}>
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
                    onClick={() => setMobileOpen(false)}
                />

                {/* Drawer Panel */}
                <div
                    className={`absolute left-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                        <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                            <span className="material-icons text-[#f7941e]">filter_list</span>
                            {t.filters}
                            {activeFilterCount > 0 && (
                                <span className="bg-[#f7941e] text-white text-xs px-2 py-0.5 rounded-full">
                                    {activeFilterCount}
                                </span>
                            )}
                        </h2>
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-colors"
                            aria-label={t.close}
                        >
                            <span className="material-icons text-gray-500">close</span>
                        </button>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        <FilterContent {...contentProps} isMobile={true} />
                    </div>

                    {/* Footer with Apply Button */}
                    <div className="p-4 border-t border-gray-100 bg-white">
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="w-full py-3 bg-gradient-to-r from-[#f7941e] to-[#ffb347] text-white font-semibold rounded-xl shadow-lg shadow-orange-200 hover:shadow-xl transition-all"
                        >
                            {t.applyFilters}
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #d1d5db;
                    border-radius: 2px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #9ca3af;
                }
            `}</style>
        </>
    );
}

export default TourFilterSidebarClient;
