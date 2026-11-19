import { renderInlineImages } from '../lib/inline-images.mjs';
/**
 * TourDetail Component
 * 
 * React component for the tour detail body: a sticky section nav and stacked sections
 * (Overview, Pricing, Itinerary, Additional Info, FAQ, Brochure). Photos live in TourGallery.
 * Used as an Astro island with client:load for interactivity.
 * Supports i18n for English and Chinese.
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import type { WPTour } from '../lib/wordpress/types';
import { wpUrl, processHtmlContent as normalizeHtmlContent, getCfTransformUrl } from '../lib/wp-url';

interface TourDetailProps {
    tour: WPTour;
    lang?: string;
}

type TabId = 'overview' | 'pricing' | 'itinerary' | 'info' | 'faq' | 'brochure';

interface Tab {
    id: TabId;
    label: { en: string; zh: string };
    icon: string;
}

const tabs: Tab[] = [
    { id: 'overview', label: { en: 'Overview', zh: '行程概述' }, icon: 'info' },
    { id: 'pricing', label: { en: 'Pricing', zh: '費用說明' }, icon: 'sell' },
    { id: 'itinerary', label: { en: 'Itinerary', zh: '每日行程' }, icon: 'route' },
    { id: 'info', label: { en: 'Additional Info', zh: '附加資訊' }, icon: 'article' },
    { id: 'faq', label: { en: 'FAQ', zh: '常見問題' }, icon: 'help_outline' },
    { id: 'brochure', label: { en: 'Brochure', zh: '行程手冊' }, icon: 'picture_as_pdf' },
];

/**
 * The tour description is one flat list of blocks. Departure dates, rates and what the price covers all come after the
 * itinerary summary, so the first block that opens one of those parts starts the "Pricing" tab and everything after it
 * moves there. Matched on the block's own heading or opening words, in both languages.
 */
const PRICING_START = /^(departure\s+dates?\b|rates?\b|price\b|pricing\b|fares?\b|tour\s+fare|what['’]?s\s+included|出發日期|價格|收費|費用)/i;

function opensPricing(html: string): boolean {
    const text = String(html ?? '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;|\u00a0/g, ' ')
        .replace(/^[\s*•\-–—]+/, '')
        .trim();
    return PRICING_START.test(text);
}

function blockStartsPricing(block: { type: string; content: any }): boolean {
    return (block.type === 'title' || block.type === 'text') && opensPricing(block.content);
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr', 'col', 'source']);

/**
 * Splits one rich-text body at the first top-level element that opens the pricing part (see PRICING_START).
 * Only element boundaries at nesting depth 0 are used, so no tag is ever cut in half. Without a match everything stays
 * in the first part.
 */
function splitRichTextAtPricing(html: string): [string, string] {
    const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>/g;
    let depth = 0;
    let elementStart = -1;
    let match: RegExpExecArray | null;
    while ((match = tag.exec(html))) {
        const closing = match[1] === '/';
        const name = match[2].toLowerCase();
        const selfClosing = match[3] === '/' || VOID_TAGS.has(name);
        if (!closing) {
            if (depth === 0) elementStart = match.index;
            if (!selfClosing) depth += 1;
        } else {
            depth = Math.max(0, depth - 1);
        }
        if (depth === 0 && elementStart >= 0) {
            const elementEnd = match.index + match[0].length;
            if (opensPricing(html.slice(elementStart, elementEnd))) {
                return [html.slice(0, elementStart), html.slice(elementStart)];
            }
            elementStart = -1;
        }
    }
    return [html, ''];
}

// i18n translations
const translations = {
    en: {
        tourDetails: 'Tour Details',
        duration: 'Duration',
        location: 'Location',
        country: 'Country',
        highlights: 'Tour Highlights',
        whatsIncluded: "What's Included",
        whatsNotIncluded: "What's Not Included",
        day: 'Day',
    },
    zh: {
        tourDetails: '行程詳情',
        duration: '行程天數',
        location: '地點',
        country: '國家',
        highlights: '行程亮點',
        whatsIncluded: '費用包含',
        whatsNotIncluded: '費用不包含',
        day: '第',
    },
};

export function TourDetail({ tour, lang = 'en' }: TourDetailProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
    const navRef = useRef<HTMLElement>(null);
    const overviewRef = useRef<HTMLDivElement>(null);
    const [overviewTall, setOverviewTall] = useState(false);
    const [overviewOpen, setOverviewOpen] = useState(false);

    const processHtmlContent = (html: string) => renderInlineImages(normalizeHtmlContent(html), tour.optimizedInlineImages, wpUrl);

    const t = translations[lang as keyof typeof translations] || translations.en;

    // Get page builder sections from goodlayers_data
    const sections = useMemo(() => {
        const gd = tour.goodlayers_data as any;
        if (!gd) return [];

        // Try multiple possible structures
        return gd.sections || gd.page_builder || gd['gdlr-core-page-builder'] || [];
    }, [tour]);

    // Get Goodlayers data helper
    const gd = tour.goodlayers_data as any;

    // Extract additional tour content - check multiple possible field names
    const tourHighlights = useMemo(() => {
        const content = gd?.tour_highlight ||
            gd?.['tourmaster-tour-highlight'] ||
            gd?.['_tourmaster-tour-highlight'] ||
            gd?.highlight ||
            '';
        return processHtmlContent(content);
    }, [gd]);

    const tourIncludes = useMemo(() => {
        const content = gd?.tour_include ||
            gd?.['tourmaster-tour-include'] ||
            gd?.['_tourmaster-tour-include'] ||
            gd?.include ||
            '';
        return processHtmlContent(content);
    }, [gd]);

    const tourExcludes = useMemo(() => {
        const content = gd?.tour_exclude ||
            gd?.['tourmaster-tour-exclude'] ||
            gd?.['_tourmaster-tour-exclude'] ||
            gd?.exclude ||
            '';
        return processHtmlContent(content);
    }, [gd]);

    // Extract content blocks from detail/details section (like Next.js TourOverview)
    interface ContentBlock {
        type: 'title' | 'text' | 'icon-list' | 'image';
        content: any;
        order: number;
    }

    const contentBlocks = useMemo((): ContentBlock[] => {
        // Find ALL sections with id 'detail' or 'details' (not 'info' - that has its own tab)
        const detailSections = sections.filter(
            (s: any) => s.value?.id === 'detail' || s.value?.id === 'details'
        );

        const blocks: ContentBlock[] = [];

        // Recursive function to process items (handles nested columns)
        const processItem = (item: any) => {
            // Skip dividers and spacers
            if (item.type === 'tour_title' || item.type === 'divider' || item.type === 'space') return;

            // Recursively process nested items in columns and other containers
            if ((item.type === 'column' || item.type === 'row' || item.type === 'container') && item.items?.length > 0) {
                item.items.forEach((nestedItem: any) => processItem(nestedItem));
                return;
            }

            // Handle text boxes
            if (item.type === 'text-box' && item.value?.content) {
                blocks.push({
                    type: 'text',
                    content: processHtmlContent(item.value.content),
                    order: blocks.length,
                });
            }

            // Handle titles
            if (item.type === 'title' && (item.value?.title || item.value?.caption)) {
                blocks.push({
                    type: 'title',
                    content: item.value?.title || item.value?.caption,
                    order: blocks.length,
                });
            }

            // Handle icon lists
            if (item.type === 'icon-list' && item.value?.tabs?.length > 0) {
                blocks.push({
                    type: 'icon-list',
                    content: item.value.tabs,
                    order: blocks.length,
                });
            }

            // Handle images
            if (item.type === 'image' && item.value?.url) {
                blocks.push({
                    type: 'image',
                    content: {
                        url: tour.optimizedInlineImages?.[wpUrl(item.value.url)]?.src || getCfTransformUrl(wpUrl(item.value.url), { width: 1200, format: 'webp' }),
                        width: tour.optimizedInlineImages?.[wpUrl(item.value.url)]?.width,
                        height: tour.optimizedInlineImages?.[wpUrl(item.value.url)]?.height,
                        srcSet: tour.optimizedInlineImages?.[wpUrl(item.value.url)]?.srcSet,
                        alt: item.value.alt || '',
                    },
                    order: blocks.length,
                });
            }
        };

        // Process ALL matching sections
        detailSections.forEach((detailSection: any) => {
            if (detailSection?.items) {
                detailSection.items.forEach((item: any) => processItem(item));
            }
        });

        return blocks;
    }, [sections]);


    // Overview keeps the itinerary summary; dates, rates and inclusions go to their own tab.
    const pricingStartIndex = useMemo(() => contentBlocks.findIndex(blockStartsPricing), [contentBlocks]);
    const overviewBlocks = pricingStartIndex >= 0 ? contentBlocks.slice(0, pricingStartIndex) : contentBlocks;
    const pricingBlocks = pricingStartIndex >= 0 ? contentBlocks.slice(pricingStartIndex) : [];

    // Extract content by section type
    const overviewContent = useMemo(() => {
        // Try to get from excerpt or content
        const excerpt = tour.excerpt?.rendered || '';
        const content = tour.content?.rendered || '';

        // Also check for overview section in page builder
        const overviewSection = sections.find(
            (s: any) => s.value?.id === 'overview' || s.value?.id === 'description'
        );

        const sectionContent = overviewSection?.items
            ?.filter((item: any) => item.type === 'text-box')
            ?.map((item: any) => item.value?.content)
            ?.join('') || '';

        return processHtmlContent(sectionContent || content || excerpt);
    }, [tour, sections]);

    // The same split for a tour whose description is a single rich-text body instead of separate blocks.
    const [overviewHtml, pricingHtml] = useMemo(
        () => (overviewContent && !contentBlocks.some(b => b.type === 'text') ? splitRichTextAtPricing(overviewContent) : [overviewContent, '']),
        [overviewContent, contentBlocks],
    );

    // Check for itinerary
    const itinerary = useMemo(() => {
        // Try to find itinerary section in page builder
        const itinerarySection = sections.find(
            (s: any) => s.value?.id === 'itinerary'
        );

        if (itinerarySection?.items) {
            const toggleBox = itinerarySection.items.find(
                (item: any) => item.type === 'toggle-box'
            );
            if (toggleBox?.value?.tabs) {
                return toggleBox.value.tabs;
            }
        }

        // Fallback to tour_itinerary field from Goodlayers
        return gd?.tour_itinerary || gd?.['tourmaster-tour-itinerary'] || [];
    }, [gd, sections]);

    // Check for FAQ
    const faqItems = useMemo(() => {
        const faqSection = sections.find(
            (s: any) => s.value?.id === 'faq'
        );

        if (faqSection?.items) {
            const toggleBox = faqSection.items.find(
                (item: any) => item.type === 'toggle-box' || item.type === 'accordion'
            );
            if (toggleBox?.value?.tabs) {
                return toggleBox.value.tabs;
            }
        }

        return gd?.tour_faq || [];
    }, [gd, sections]);

    // Check for Additional Info section
    const infoItems = useMemo((): ContentBlock[] => {
        const infoSection = sections.find(
            (s: any) => s.value?.id === 'info'
        );

        const blocks: ContentBlock[] = [];

        if (infoSection?.items) {
            infoSection.items.forEach((item: any) => {
                if (item.type === 'divider') return;

                if (item.type === 'title' && (item.value?.title || item.value?.caption)) {
                    blocks.push({
                        type: 'title',
                        content: item.value?.title || item.value?.caption,
                        order: blocks.length,
                    });
                }

                if (item.type === 'text-box' && item.value?.content) {
                    blocks.push({
                        type: 'text',
                        content: processHtmlContent(item.value.content),
                        order: blocks.length,
                    });
                }
            });
        }

        return blocks;
    }, [sections]);

    // Check for Brochure
    const brochure = tour.tour_meta?.brochure;
    const brochureUrl = typeof brochure === 'object' && brochure ? brochure.url : (typeof brochure === 'string' ? brochure : null);
    const brochureTitle = typeof brochure === 'object' && brochure ? (brochure.title || brochure.filename) : 'Tour Brochure';

    const renderBlock = (block: ContentBlock, idx: number) => {
        switch (block.type) {
            case 'title':
                return (
                    <h3 key={idx} className="text-2xl font-bold text-gray-900 mt-8 mb-4 flex items-center gap-3">
                        <span className="w-1 h-8 bg-orange-500 rounded-full"></span>
                        {block.content}
                    </h3>
                );
            case 'text':
                return (
                    <div
                        key={idx}
                        className="prose prose-base max-w-none text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                );
            case 'icon-list':
                return (
                    <div key={idx} className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                        <ul className="grid md:grid-cols-2 gap-4">
                            {block.content.map((listItem: any, listIdx: number) => (
                                <li key={listIdx} className="flex items-start gap-3 group">
                                    <span className="text-orange-500 shrink-0 text-lg group-hover:scale-110 transition-transform">
                                        {listItem.icon === 'icon_clock' ? (
                                            <span className="material-icons">schedule</span>
                                        ) : listItem.icon ? (
                                            <i className={listItem.icon} style={{ fontSize: '20px' }} />
                                        ) : (
                                            <span className="material-icons">check_circle</span>
                                        )}
                                    </span>
                                    <span className="text-gray-700 flex-1">{listItem.title}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            case 'image':
                return (
                    <div key={idx} className="overflow-hidden">
                        <img
                            src={block.content.url}
                            width={block.content.width}
                            height={block.content.height}
                            srcSet={block.content.srcSet}
                            sizes="(min-width: 1024px) 66vw, 100vw"
                            loading="lazy"
                            decoding="async"
                            alt={block.content.alt}
                            className="w-full h-auto block"
                            data-original-src={block.content.url}
                            onError={(e) => {
                                console.error('Image failed to load:', block.content.url);
                                // Prevent infinite fallback loop
                                e.currentTarget.dataset.fallbackTried = 'true';
                            }}
                        />
                    </div>
                );
            default:
                return null;
        }
    };

    // Show only the sections that have content
    const availableTabs = tabs.filter(tab => {
        if (tab.id === 'overview') return true;
        if (tab.id === 'pricing') return !!pricingHtml || pricingBlocks.length > 0 || !!tourIncludes || !!tourExcludes;
        if (tab.id === 'itinerary') return itinerary.length > 0;
        if (tab.id === 'info') return infoItems.length > 0;
        if (tab.id === 'faq') return faqItems.length > 0;
        if (tab.id === 'brochure') return !!brochureUrl;
        return false;
    });
    const sectionIds = availableTabs.map(tab => tab.id).join(',');

    const OVERVIEW_COLLAPSE_AT = 640;
    const ui = lang === 'zh'
        ? { nav: '行程內容導覽', more: '展開全部內容', less: '收合內容', expandAll: '展開全部', collapseAll: '收合全部' }
        : { nav: 'Tour sections', more: 'Show more', less: 'Show less', expandAll: 'Expand all', collapseAll: 'Collapse all' };

    // Long single-body descriptions start collapsed (the full text stays in the page for search engines and without JavaScript).
    useEffect(() => {
        const el = overviewRef.current;
        if (el && el.scrollHeight > OVERVIEW_COLLAPSE_AT + 160) setOverviewTall(true);
    }, []);
    const overviewCollapsed = overviewTall && !overviewOpen;

    // The nav follows the section the reader is in.
    useEffect(() => {
        const elements = sectionIds
            .split(',')
            .filter(Boolean)
            .map(id => document.getElementById(`tour-${id}`))
            .filter((el): el is HTMLElement => !!el);
        if (elements.length < 2 || typeof IntersectionObserver === 'undefined') return;
        const visible = new Set<string>();
        const observer = new IntersectionObserver(
            entries => {
                for (const entry of entries) {
                    if (entry.isIntersecting) visible.add(entry.target.id);
                    else visible.delete(entry.target.id);
                }
                const current = elements.find(el => visible.has(el.id));
                if (current) setActiveTab(current.id.replace('tour-', '') as TabId);
            },
            { rootMargin: '-150px 0px -55% 0px' },
        );
        elements.forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, [sectionIds]);

    // Keep the active nav item in view on narrow screens (scrolls the nav only, never the page).
    useEffect(() => {
        const nav = navRef.current;
        const active = nav?.querySelector<HTMLElement>('[aria-current="true"]');
        if (nav && active) nav.scrollTo({ left: active.offsetLeft - nav.clientWidth / 2 + active.clientWidth / 2, behavior: 'smooth' });
    }, [activeTab]);

    const goTo = (id: TabId) => (event: MouseEvent<HTMLAnchorElement>) => {
        const target = document.getElementById(`tour-${id}`);
        if (!target) return;
        event.preventDefault();
        setActiveTab(id);
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    };

    const toggleDay = (index: number) =>
        setExpandedDays(previous => {
            const next = new Set(previous);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    const allDaysOpen = itinerary.length > 0 && expandedDays.size === itinerary.length;

    const card = 'scroll-mt-36 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-8';
    const heading = (id: TabId, action?: ReactNode) => {
        const tab = tabs.find(item => item.id === id)!;
        return (
            <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 text-xl font-bold text-gray-900 md:text-2xl">
                    <span className="material-icons text-orange-500" aria-hidden="true">{tab.icon}</span>
                    {tab.label[lang as keyof typeof tab.label] || tab.label.en}
                </h2>
                {action}
            </div>
        );
    };

    return (
        <div className="tour-detail-tabs-content space-y-4">
            {/* Section nav */}
            {availableTabs.length > 1 && (
                <nav
                    ref={navRef}
                    aria-label={ui.nav}
                    className="scrollbar-hide sticky top-[72px] z-30 -mx-4 flex overflow-x-auto border-y border-gray-200 bg-white/95 px-4 shadow-sm backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-2"
                >
                    {availableTabs.map(tab => (
                        <a
                            key={tab.id}
                            href={`#tour-${tab.id}`}
                            onClick={goTo(tab.id)}
                            aria-current={activeTab === tab.id ? 'true' : undefined}
                            className={`relative whitespace-nowrap px-4 py-3.5 text-sm font-semibold transition-colors ${
                                activeTab === tab.id ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            {tab.label[lang as keyof typeof tab.label] || tab.label.en}
                            {activeTab === tab.id && (
                                <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-orange-500" />
                            )}
                        </a>
                    ))}
                </nav>
            )}

            {/* Overview */}
            <section id="tour-overview" data-tour-panel="overview" className={card}>
                {heading('overview')}
                <div
                    ref={overviewRef}
                    className="relative space-y-8"
                    style={overviewCollapsed ? { maxHeight: OVERVIEW_COLLAPSE_AT, overflow: 'hidden' } : undefined}
                >
                    {/* Tour highlights first, like a "what you'll love" summary */}
                    {tourHighlights && (
                        <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-5 md:p-6">
                            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                                <span className="material-icons text-orange-500" aria-hidden="true">star</span>
                                {t.highlights}
                            </h3>
                            <div
                                className="prose prose-sm max-w-none text-gray-700 prose-li:marker:text-orange-500"
                                dangerouslySetInnerHTML={{ __html: tourHighlights }}
                            />
                        </div>
                    )}

                    {/* Description as one rich-text body (no separate blocks) */}
                    {overviewHtml && !contentBlocks.some(b => b.type === 'text') && (
                        <div
                            className="prose prose-base max-w-none text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: overviewHtml }}
                        />
                    )}

                    {/* Content blocks from the detail section */}
                    {overviewBlocks.map(renderBlock)}

                    {overviewCollapsed && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/90 to-transparent" />
                    )}
                </div>
                {overviewTall && (
                    <button
                        type="button"
                        onClick={() => setOverviewOpen(open => !open)}
                        aria-expanded={overviewOpen}
                        className="mt-4 inline-flex items-center gap-1 rounded-lg px-1 py-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500"
                    >
                        {overviewOpen ? ui.less : ui.more}
                        <span className={`material-icons text-lg transition-transform ${overviewOpen ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
                    </button>
                )}
            </section>

            {/* Pricing: departure dates, rates and what the price covers */}
            {(pricingHtml || pricingBlocks.length > 0 || tourIncludes || tourExcludes) && (
                <section id="tour-pricing" data-tour-panel="pricing" className={`${card} space-y-8`}>
                    {heading('pricing')}
                    {pricingHtml && (
                        <div
                            className="prose prose-base max-w-none text-gray-700 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: pricingHtml }}
                        />
                    )}

                    {pricingBlocks.map(renderBlock)}

                    {(tourIncludes || tourExcludes) && (
                        <div className="grid gap-6 md:grid-cols-2">
                            {tourIncludes && (
                                <div className="rounded-2xl border border-green-100 bg-green-50 p-5 md:p-6">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                                        <span className="material-icons text-green-500" aria-hidden="true">check_circle</span>
                                        {t.whatsIncluded}
                                    </h3>
                                    <div
                                        className="prose prose-sm max-w-none text-gray-700 prose-li:marker:text-green-500"
                                        dangerouslySetInnerHTML={{ __html: tourIncludes }}
                                    />
                                </div>
                            )}
                            {tourExcludes && (
                                <div className="rounded-2xl border border-red-100 bg-red-50 p-5 md:p-6">
                                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                                        <span className="material-icons text-red-500" aria-hidden="true">cancel</span>
                                        {t.whatsNotIncluded}
                                    </h3>
                                    <div
                                        className="prose prose-sm max-w-none text-gray-700 prose-li:marker:text-red-500"
                                        dangerouslySetInnerHTML={{ __html: tourExcludes }}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* Itinerary */}
            {itinerary.length > 0 && (
                <section id="tour-itinerary" data-tour-panel="itinerary" className={`${card} space-y-3`}>
                    {heading(
                        'itinerary',
                        itinerary.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setExpandedDays(allDaysOpen ? new Set() : new Set(itinerary.map((_: unknown, index: number) => index)))}
                                className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-semibold text-orange-600 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500"
                            >
                                {allDaysOpen ? ui.collapseAll : ui.expandAll}
                            </button>
                        ),
                    )}
                    {itinerary.map((day: any, index: number) => (
                        <div key={index} className="overflow-hidden rounded-xl border border-gray-200">
                            <button
                                type="button"
                                aria-expanded={expandedDays.has(index)}
                                onClick={() => toggleDay(index)}
                                className="flex w-full items-center justify-between bg-gray-50 p-4 transition-colors hover:bg-gray-100"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex h-10 w-10 min-w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 font-bold text-white">
                                        {index + 1}
                                    </div>
                                    <h3 className="text-left font-semibold text-gray-900">
                                        {day.title || (lang === 'zh' ? `${t.day}${index + 1}天` : `${t.day} ${index + 1}`)}
                                    </h3>
                                </div>
                                <span className={`material-icons text-gray-400 transition-transform ${expandedDays.has(index) ? 'rotate-180' : ''}`}>
                                    expand_more
                                </span>
                            </button>

                            <div hidden={!expandedDays.has(index)} data-itinerary-body className="border-t border-gray-200 p-4">
                                <div
                                    className="prose prose-sm max-w-none text-gray-600"
                                    dangerouslySetInnerHTML={{ __html: processHtmlContent(day.content || day.caption || '') }}
                                />
                            </div>
                        </div>
                    ))}
                </section>
            )}

            {/* Additional info */}
            {infoItems.length > 0 && (
                <section id="tour-info" data-tour-panel="info" className={`${card} space-y-6`}>
                    {heading('info')}
                    {infoItems.map((block, idx) => {
                        switch (block.type) {
                            case 'title':
                                return (
                                    <h3 key={idx} className="flex items-center gap-3 text-xl font-bold text-gray-900">
                                        <span className="h-7 w-1 rounded-full bg-orange-500"></span>
                                        {block.content}
                                    </h3>
                                );
                            case 'text':
                                return (
                                    <div
                                        key={idx}
                                        className="prose prose-base max-w-none rounded-xl border border-gray-200 bg-white p-5 text-gray-700 leading-relaxed md:p-6"
                                        dangerouslySetInnerHTML={{ __html: block.content }}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                </section>
            )}

            {/* FAQ */}
            {faqItems.length > 0 && (
                <section id="tour-faq" data-tour-panel="faq" className={`${card} space-y-3`}>
                    {heading('faq')}
                    {faqItems.map((item: any, index: number) => (
                        <details key={index} className="group overflow-hidden rounded-xl border border-gray-200">
                            <summary className="flex cursor-pointer list-none items-center justify-between bg-gray-50 p-4 transition-colors hover:bg-gray-100">
                                <span className="font-semibold text-gray-900">{item.title}</span>
                                <span className="material-icons text-gray-400 transition-transform group-open:rotate-180">
                                    expand_more
                                </span>
                            </summary>
                            <div className="border-t border-gray-200 p-4">
                                <div
                                    className="prose prose-sm max-w-none text-gray-600"
                                    dangerouslySetInnerHTML={{ __html: processHtmlContent(item.content || item.caption || '') }}
                                />
                            </div>
                        </details>
                    ))}
                </section>
            )}

            {/* Brochure */}
            {brochureUrl && (
                <section id="tour-brochure" data-tour-panel="brochure" className={card}>
                    {heading('brochure')}
                    <div className="rounded-xl border border-gray-200 bg-white p-6 text-center md:p-8">
                        {(() => {
                            const brochureObj = typeof brochure === 'object' ? brochure : null;
                            const isPdf = brochureObj?.mime_type === 'application/pdf' || brochureUrl.toLowerCase().endsWith('.pdf');
                            const isImage = brochureObj?.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(brochureUrl);

                            if (isPdf) {
                                return (
                                    <div className="mb-8 h-[600px] w-full overflow-hidden rounded-lg border border-gray-200">
                                        <iframe
                                            loading="lazy"
                                            src={`${brochureUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                            className="h-full w-full"
                                            title={brochureTitle}
                                        />
                                    </div>
                                );
                            } else if (isImage) {
                                return (
                                    <div className="mb-8 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                                        <img
                                            src={brochureUrl}
                                            alt={brochureTitle}
                                            className="mx-auto h-auto max-h-[800px] w-full object-contain"
                                        />
                                    </div>
                                );
                            }
                            return (
                                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-500">
                                    <span className="material-icons text-4xl">picture_as_pdf</span>
                                </div>
                            );
                        })()}

                        <p className="mx-auto mb-8 max-w-md text-gray-500">
                            {lang === 'zh' ? '預覽或下載完整行程詳細資訊。' : 'Preview or download the full tour itinerary and details.'}
                        </p>
                        <a
                            href={brochureUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex transform items-center gap-2 rounded-xl bg-orange-500 px-8 py-4 font-bold text-white shadow-lg transition-colors duration-300 hover:-translate-y-1 hover:bg-orange-600 hover:shadow-xl"
                        >
                            <span className="material-icons">download</span>
                            {lang === 'zh' ? '下載手冊' : 'Download Brochure'}
                        </a>
                    </div>
                </section>
            )}
        </div>
    );
}
