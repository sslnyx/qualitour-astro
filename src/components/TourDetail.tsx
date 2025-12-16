/**
 * TourDetail Component
 * 
 * React component for tour detail page with tabs for Overview, Itinerary, Photos, FAQ.
 * Used as an Astro island with client:load for interactivity.
 */

import { useState, useMemo } from 'react';
import type { WPTour } from '../lib/wordpress/types';

interface TourDetailProps {
    tour: WPTour;
}

type TabId = 'overview' | 'itinerary' | 'photos' | 'faq';

interface Tab {
    id: TabId;
    label: string;
    icon: string;
}

const tabs: Tab[] = [
    { id: 'overview', label: 'Overview', icon: 'info' },
    { id: 'itinerary', label: 'Itinerary', icon: 'route' },
    { id: 'photos', label: 'Photos', icon: 'photo_library' },
    { id: 'faq', label: 'FAQ', icon: 'help_outline' },
];

export function TourDetail({ tour }: TourDetailProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [expandedDay, setExpandedDay] = useState<number | null>(null);

    // Get page builder sections
    const sections = useMemo(() => {
        return tour.goodlayers_data?.sections ||
            (tour.goodlayers_data as any)?.page_builder ||
            [];
    }, [tour]);

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

        return sectionContent || content || excerpt;
    }, [tour, sections]);

    // Check for itinerary
    const itinerary = useMemo(() => {
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

        // Fallback to tour_itinerary field
        return tour.goodlayers_data?.tour_itinerary || [];
    }, [tour, sections]);

    // Check for photos
    const photos = useMemo(() => {
        const photoList: string[] = [];

        // Add featured image
        const featuredUrl = tour.featured_image_url?.full?.url || tour.featured_image_url?.full;
        if (featuredUrl) photoList.push(featuredUrl as string);

        // Look for gallery in sections
        sections.forEach((section: any) => {
            section.items?.forEach((item: any) => {
                if (item.type === 'gallery' && item.value?.gallery) {
                    item.value.gallery.forEach((img: any) => {
                        if (img.url) photoList.push(img.url);
                    });
                }
                if (item.type === 'image' && item.value?.url) {
                    photoList.push(item.value.url);
                }
            });
        });

        return photoList;
    }, [tour, sections]);

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

        return tour.goodlayers_data?.tour_faq || [];
    }, [tour, sections]);

    // Filter tabs based on available content
    const availableTabs = tabs.filter(tab => {
        if (tab.id === 'overview') return true;
        if (tab.id === 'itinerary') return itinerary.length > 0;
        if (tab.id === 'photos') return photos.length > 0;
        if (tab.id === 'faq') return faqItems.length > 0;
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
                            {tab.label}

                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500" />
                            )}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="p-6 md:p-8">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="animate-fadeIn">
                        <div
                            className="prose prose-gray max-w-none
                prose-headings:text-gray-900 prose-headings:font-bold
                prose-p:text-gray-600 prose-p:leading-relaxed
                prose-a:text-orange-500 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-gray-900
                prose-ul:text-gray-600 prose-li:marker:text-orange-500
              "
                            dangerouslySetInnerHTML={{ __html: overviewContent }}
                        />

                        {/* Tour Meta Info */}
                        {tour.tour_meta && (
                            <div className="mt-8 pt-8 border-t border-gray-100">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Tour Details</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {tour.tour_meta.duration_text && (
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <span className="material-icons text-orange-500">schedule</span>
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">Duration</div>
                                                <div className="font-medium text-gray-900">{tour.tour_meta.duration_text}</div>
                                            </div>
                                        </div>
                                    )}
                                    {tour.tour_meta.location && (
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <span className="material-icons text-orange-500">place</span>
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">Location</div>
                                                <div className="font-medium text-gray-900">{tour.tour_meta.location}</div>
                                            </div>
                                        </div>
                                    )}
                                    {tour.tour_meta.country && (
                                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                            <span className="material-icons text-orange-500">public</span>
                                            <div>
                                                <div className="text-xs text-gray-500 uppercase">Country</div>
                                                <div className="font-medium text-gray-900">{tour.tour_meta.country}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
                                        <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold">
                                            {index + 1}
                                        </div>
                                        <h4 className="font-semibold text-gray-900 text-left">
                                            {day.title || `Day ${index + 1}`}
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
                                            dangerouslySetInnerHTML={{ __html: day.content || day.caption || '' }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Photos Tab */}
                {activeTab === 'photos' && photos.length > 0 && (
                    <div className="animate-fadeIn">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {photos.map((photo, index) => (
                                <div
                                    key={index}
                                    className="relative aspect-[4/3] rounded-xl overflow-hidden group cursor-pointer"
                                >
                                    <img
                                        src={photo}
                                        alt={`Tour photo ${index + 1}`}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                </div>
                            ))}
                        </div>
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
                                        dangerouslySetInnerHTML={{ __html: item.content || item.caption || '' }}
                                    />
                                </div>
                            </details>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
