/**
 * TourDetail Component
 * 
 * React component for tour detail page with tabs for Overview, Itinerary, Photos, FAQ.
 * Used as an Astro island with client:load for interactivity.
 * Supports i18n for English and Chinese.
 */

import { useState, useMemo } from 'react';
import type { WPTour } from '../lib/wordpress/types';
import { wpUrl, processHtmlContent, getCfTransformUrl } from '../lib/wp-url';
import PhotoLightbox from './PhotoLightbox';

interface TourDetailProps {
    tour: WPTour;
    lang?: string;
}

type TabId = 'overview' | 'itinerary' | 'info' | 'photos' | 'faq' | 'brochure';

interface Tab {
    id: TabId;
    label: { en: string; zh: string };
    icon: string;
}

const tabs: Tab[] = [
    { id: 'overview', label: { en: 'Overview', zh: '行程概述' }, icon: 'info' },
    { id: 'itinerary', label: { en: 'Itinerary', zh: '每日行程' }, icon: 'route' },
    { id: 'info', label: { en: 'Additional Info', zh: '附加資訊' }, icon: 'article' },
    { id: 'photos', label: { en: 'Photos', zh: '照片' }, icon: 'photo_library' },
    { id: 'faq', label: { en: 'FAQ', zh: '常见问题' }, icon: 'help_outline' },
    { id: 'brochure', label: { en: 'Brochure', zh: '行程手冊' }, icon: 'picture_as_pdf' },
];

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
        tourDetails: '行程详情',
        duration: '行程天数',
        location: '地点',
        country: '国家',
        highlights: '行程亮点',
        whatsIncluded: '费用包含',
        whatsNotIncluded: '费用不包含',
        day: '第',
    },
};

export function TourDetail({ tour, lang = 'en' }: TourDetailProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [expandedDay, setExpandedDay] = useState<number | null>(null);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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
                        url: getCfTransformUrl(wpUrl(item.value.url), { width: 1200, format: 'webp' }),
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

    // Check for photos - collect from multiple sources and process URLs
    const photos = useMemo(() => {
        const photoList: string[] = [];

        // Add featured image first
        const featuredImg = tour.featured_image_url;
        if (featuredImg) {
            let featuredUrl: string | undefined;
            if (typeof featuredImg === 'string') {
                featuredUrl = featuredImg;
            } else if (typeof featuredImg === 'object') {
                const full = (featuredImg as any).full;
                featuredUrl = typeof full === 'string' ? full : full?.url;
            }
            if (featuredUrl) photoList.push(getCfTransformUrl(wpUrl(featuredUrl), { width: 1920, height: 1080, format: 'webp' }));
        }

        // Look for gallery in Goodlayers sections
        sections.forEach((section: any) => {
            section.items?.forEach((item: any) => {
                if (item.type === 'gallery' && item.value?.gallery) {
                    item.value.gallery.forEach((img: any) => {
                        if (img.url) photoList.push(getCfTransformUrl(wpUrl(img.url), { width: 1600, height: 1200, format: 'webp' }));
                        else if (typeof img === 'string') photoList.push(getCfTransformUrl(wpUrl(img), { width: 1600, height: 1200, format: 'webp' }));
                    });
                }
                if (item.type === 'image' && item.value?.url) {
                    photoList.push(getCfTransformUrl(wpUrl(item.value.url), { width: 1600, height: 1200, format: 'webp' }));
                }
            });
        });

        // Check for tour gallery in Goodlayers meta
        if (gd?.['tourmaster-tour-gallery']) {
            const gallery = gd['tourmaster-tour-gallery'];
            if (Array.isArray(gallery)) {
                gallery.forEach((img: any) => {
                    if (typeof img === 'string') {
                        photoList.push(getCfTransformUrl(wpUrl(img), { width: 1600, height: 1200, format: 'webp' }));
                    } else if (img.url) {
                        photoList.push(getCfTransformUrl(wpUrl(img.url), { width: 1600, height: 1200, format: 'webp' }));
                    }
                });
            }
        }

        // Check for tour_gallery field
        if (gd?.tour_gallery) {
            const gallery = gd.tour_gallery;
            if (Array.isArray(gallery)) {
                gallery.forEach((img: any) => {
                    if (typeof img === 'string') {
                        photoList.push(getCfTransformUrl(wpUrl(img), { width: 1600, height: 1200, format: 'webp' }));
                    } else if (img.url) {
                        photoList.push(getCfTransformUrl(wpUrl(img.url), { width: 1600, height: 1200, format: 'webp' }));
                    }
                });
            }
        }

        // Remove duplicates
        return [...new Set(photoList)];
    }, [tour, gd, sections]);

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

    // Filter tabs based on available content
    const availableTabs = tabs.filter(tab => {
        if (tab.id === 'overview') return true;
        if (tab.id === 'itinerary') return itinerary.length > 0;
        if (tab.id === 'info') return infoItems.length > 0;
        if (tab.id === 'photos') return photos.length > 0;
        if (tab.id === 'faq') return faqItems.length > 0;
        if (tab.id === 'brochure') return !!brochureUrl;
        return false;
    });

    return (
        <div className="overflow-hidden">
            {/* Tab Navigation */}
            <div className="bg-gray-50 border-b border-gray-200">
                <nav className="flex overflow-x-auto scrollbar-hide" aria-label="Tabs">
                    {availableTabs.map((tab, index) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                relative flex items-center gap-2 px-6 py-5 text-sm font-semibold whitespace-nowrap transition-all duration-300
                ${activeTab === tab.id
                                    ? 'text-orange-500 bg-white'
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                                }
                ${index === 0 ? 'rounded-tl-2xl' : ''}
              `}
                        >
                            <span className={`material-icons text-xl ${activeTab === tab.id ? 'text-orange-500' : 'text-gray-400'}`}>
                                {tab.icon}
                            </span>
                            {tab.label[lang as keyof typeof tab.label] || tab.label.en}

                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6 md:p-8 tour-detail-tabs-content">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="animate-fadeIn space-y-8">
                        {/* Main Content - only show if no text blocks in contentBlocks to avoid duplication */}
                        {overviewContent && !contentBlocks.some(b => b.type === 'text') && (
                            <div className="bg-orange-50 rounded-xl p-8 border border-orange-200">
                                <div
                                    className="prose prose-lg max-w-none text-gray-800 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: overviewContent }}
                                />
                            </div>
                        )}

                        {/* Content Blocks from detail/details section */}
                        {contentBlocks.map((block, idx) => {
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
                                                alt={block.content.alt}
                                                className="w-full h-auto block"
                                            />
                                        </div>
                                    );
                                default:
                                    return null;
                            }
                        })}

                        {/* Tour Highlights */}
                        {tourHighlights && (
                            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <span className="material-icons text-orange-500">star</span>
                                    {t.highlights}
                                </h3>
                                <div
                                    className="prose prose-sm max-w-none text-gray-700 prose-li:marker:text-orange-500"
                                    dangerouslySetInnerHTML={{ __html: tourHighlights }}
                                />
                            </div>
                        )}

                        {/* Includes / Excludes */}
                        {(tourIncludes || tourExcludes) && (
                            <div className="grid md:grid-cols-2 gap-6">
                                {tourIncludes && (
                                    <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <span className="material-icons text-green-500">check_circle</span>
                                            {t.whatsIncluded}
                                        </h3>
                                        <div
                                            className="prose prose-sm max-w-none text-gray-700 prose-li:marker:text-green-500"
                                            dangerouslySetInnerHTML={{ __html: tourIncludes }}
                                        />
                                    </div>
                                )}
                                {tourExcludes && (
                                    <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                            <span className="material-icons text-red-500">cancel</span>
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

                        {/* Tour Meta Info */}
                        {(() => {
                            // Extract tour meta from multiple sources
                            const duration = tour.tour_meta?.duration_text ||
                                tour.tour_meta?.duration ||
                                gd?.['tourmaster-tour-duration'] ||
                                gd?.tour_duration ||
                                '';
                            const location = tour.tour_meta?.location ||
                                gd?.['tourmaster-tour-location'] ||
                                gd?.tour_location ||
                                tour.tour_terms?.destinations?.[0]?.name ||
                                '';
                            const country = tour.tour_meta?.country ||
                                gd?.['tourmaster-tour-country'] ||
                                gd?.tour_country ||
                                '';

                            const hasAnyMeta = duration || location || country;

                            if (!hasAnyMeta) return null;

                            return (
                                <div className="pt-8 border-t border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4">{t.tourDetails}</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {duration && (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                                <span className="material-icons text-orange-500">schedule</span>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase">{t.duration}</div>
                                                    <div className="font-medium text-gray-900">{duration}</div>
                                                </div>
                                            </div>
                                        )}
                                        {location && (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                                <span className="material-icons text-orange-500">place</span>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase">{t.location}</div>
                                                    <div className="font-medium text-gray-900">{location}</div>
                                                </div>
                                            </div>
                                        )}
                                        {country && (
                                            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                                <span className="material-icons text-orange-500">public</span>
                                                <div>
                                                    <div className="text-xs text-gray-500 uppercase">{t.country}</div>
                                                    <div className="font-medium text-gray-900">{country}</div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Itinerary Tab */}
                {activeTab === 'itinerary' && itinerary.length > 0 && (
                    <div className="animate-fadeIn space-y-4">
                        {itinerary.map((day: any, index: number) => (
                            <div
                                key={index}
                                className="border border-gray-200 rounded-xl overflow-hidden"
                            >
                                <button
                                    onClick={() => setExpandedDay(expandedDay === index ? null : index)}
                                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="min-w-10 w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                                            {index + 1}
                                        </div>
                                        <h4 className="font-semibold text-gray-900 text-left">
                                            {day.title || (lang === 'zh' ? `${t.day}${index + 1}天` : `${t.day} ${index + 1}`)}
                                        </h4>
                                    </div>
                                    <span className={`material-icons text-gray-400 transition-transform ${expandedDay === index ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>

                                {expandedDay === index && (
                                    <div className="p-4 border-t border-gray-200">
                                        <div
                                            className="prose prose-sm max-w-none text-gray-600"
                                            dangerouslySetInnerHTML={{ __html: processHtmlContent(day.content || day.caption || '') }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Additional Info Tab */}
                {activeTab === 'info' && infoItems.length > 0 && (
                    <div className="animate-fadeIn space-y-6">
                        {infoItems.map((block, idx) => {
                            switch (block.type) {
                                case 'title':
                                    return (
                                        <h3 key={idx} className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                                            <span className="w-1 h-8 bg-orange-500 rounded-full"></span>
                                            {block.content}
                                        </h3>
                                    );
                                case 'text':
                                    return (
                                        <div
                                            key={idx}
                                            className="prose prose-base max-w-none text-gray-700 leading-relaxed bg-white rounded-xl p-6 border border-gray-200"
                                            dangerouslySetInnerHTML={{ __html: block.content }}
                                        />
                                    );
                                default:
                                    return null;
                            }
                        })}
                    </div>
                )}

                {/* Photos Tab */}
                {activeTab === 'photos' && photos.length > 0 && (
                    <div className="animate-fadeIn">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {photos.map((photo, index) => (
                                <div
                                    key={index}
                                    className="relative aspect-[4/3] rounded-xl overflow-hidden group cursor-pointer"
                                    onClick={() => setLightboxIndex(index)}
                                >
                                    <img
                                        src={photo}
                                        alt={`Tour photo ${index + 1}`}
                                        className="absolute inset-0 !w-full !h-full object-cover transition-transform duration-300 group-hover:scale-110 !m-0"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                        <span className="material-icons text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100 duration-300">
                                            zoom_in
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Photo Lightbox */}
                        {lightboxIndex !== null && (
                            <PhotoLightbox
                                images={photos}
                                authorName={tour.title?.rendered || 'Tour'}
                                initialIndex={lightboxIndex}
                                onClose={() => setLightboxIndex(null)}
                            />
                        )}
                    </div>
                )}

                {/* FAQ Tab */}
                {activeTab === 'faq' && faqItems.length > 0 && (
                    <div className="animate-fadeIn space-y-4">
                        {faqItems.map((item: any, index: number) => (
                            <details
                                key={index}
                                className="group border border-gray-200 rounded-xl overflow-hidden"
                            >
                                <summary className="flex items-center justify-between p-4 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors list-none">
                                    <span className="font-semibold text-gray-900">{item.title}</span>
                                    <span className="material-icons text-gray-400 group-open:rotate-180 transition-transform">
                                        expand_more
                                    </span>
                                </summary>
                                <div className="p-4 border-t border-gray-200">
                                    <div
                                        className="prose prose-sm max-w-none text-gray-600"
                                        dangerouslySetInnerHTML={{ __html: processHtmlContent(item.content || item.caption || '') }}
                                    />
                                </div>
                            </details>
                        ))}
                    </div>
                )}

                {/* Brochure Tab */}
                {activeTab === 'brochure' && brochureUrl && (
                    <div className="animate-fadeIn">
                        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                            {/* Preview Section */}
                            {(() => {
                                const brochureObj = typeof brochure === 'object' ? brochure : null;
                                const isPdf = brochureObj?.mime_type === 'application/pdf' || brochureUrl.toLowerCase().endsWith('.pdf');
                                const isImage = brochureObj?.mime_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(brochureUrl);

                                if (isPdf) {
                                    return (
                                        <div className="w-full h-[600px] mb-8 border border-gray-200 rounded-lg overflow-hidden">
                                            <iframe
                                                src={`${brochureUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                                                className="w-full h-full"
                                                title={brochureTitle}
                                            />
                                        </div>
                                    );
                                } else if (isImage) {
                                    return (
                                        <div className="mb-8 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
                                            <img
                                                src={brochureUrl}
                                                alt={brochureTitle}
                                                className="w-full h-auto max-h-[800px] object-contain mx-auto"
                                            />
                                        </div>
                                    );
                                }
                                return (
                                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <span className="material-icons text-4xl">picture_as_pdf</span>
                                    </div>
                                );
                            })()}

                            <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                {lang === 'zh' ? '預覽或下載完整行程詳細資訊。' : 'Preview or download the full tour itinerary and details.'}
                            </p>
                            <a
                                href={brochureUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-8 py-4 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition-colors shadow-lg hover:shadow-xl hover:-translate-y-1 transform duration-300"
                            >
                                <span className="material-icons">download</span>
                                {lang === 'zh' ? '下載手冊' : 'Download Brochure'}
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

