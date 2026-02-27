import { getLocalePrefix, type Locale } from "../i18n/config";
/**
 * TourCard Component - Reusable across homepage and tour listings
 * 
 * Features:
 * - Cleans up titles (removes "All rates..." and "(updated)")
 * - Handles various image URL formats from WordPress
 * - Rewrites image URLs if necessary
 * - Responsive card design with hover effects
 * - Shows price, duration, and optional excerpt
 */

import type { WPTour, WPTourFeaturedImage } from '../lib/wordpress/types';
import { wpUrl, getCfTransformUrl, extractTourImageUrl } from '../lib/wp-url';

interface TourCardProps {
    tour: WPTour;
    lang?: string;
    style?: 'grid' | 'compact' | 'featured';
    showExcerpt?: boolean;
    excerptWords?: number;
}

/**
 * Clean up tour title by removing common unwanted text
 */
function cleanTitle(title: string): string {
    return title
        // Remove HTML tags first
        .replace(/<[^>]*>/g, '')
        // Remove "(All rates are listed in USD.)" or similar variations
        .replace(/\(All\s+rates\s+are\s+listed\s+in\s+USD\.?\)/gi, '')
        // Remove "(updated)" or "(Updated)"
        .replace(/\(updated\)/gi, '')
        // Remove excessive whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract N words from HTML content
 */
function getExcerptWords(html: string, wordCount: number): string {
    if (wordCount === 0) return '';
    const text = html.replace(/<[^>]*>/g, '');
    const words = text.split(/\s+/).filter(Boolean).slice(0, wordCount);
    return words.join(' ') + (words.length >= wordCount ? '...' : '');
}

/**
 * Get the best available image URL from tour data,
 * applying Cloudflare transformations.
 */
function getImageUrl(tour: WPTour): string | null {
    const url = extractTourImageUrl(tour.featured_image_url);
    if (url) {
        // Apply default transformations for grid cards to avoid over-sized assets
        return getCfTransformUrl(url, { width: 600, height: 450, format: 'webp', quality: 80 });
    }
    return null;
}


/**
 * Get duration text from tour metadata or title
 */
function getDurationText(tour: WPTour): string | null {
    // Check tour_meta first
    if (tour.tour_meta?.duration_text) {
        return tour.tour_meta.duration_text;
    }

    // Try to extract from title
    const titleMatch = tour.title.rendered.match(/(\d+)\s*Days?(?:\s*\/?\s*(\d+)\s*Nights?)?/i);
    if (titleMatch) {
        const days = titleMatch[1];
        const nights = titleMatch[2];
        return nights ? `${days} Days / ${nights} Nights` : `${days} Days`;
    }

    return null;
}

export function TourCard({
    tour,
    lang = 'en',
    style = 'grid',
    showExcerpt = false,
    excerptWords = 14,
}: TourCardProps) {
    // Use pre-optimized image URL if available (from Astro build-time processing)
    // Falls back to extracting from featured_image_url for non-optimized contexts
    const imageUrl = tour.optimizedImageUrl || getImageUrl(tour);
    const localePrefix = getLocalePrefix(lang as Locale);
    const cleanedTitle = cleanTitle(tour.title.rendered);
    const durationText = getDurationText(tour);

    // Pricing
    const price = tour.tour_meta?.['tour-price-text'] || tour.tour_meta?.price;
    const currency = tour.tour_meta?.['tourmaster-tour-currency'];
    const discountPrice = tour.tour_meta?.['tour-price-discount-text'];
    const hasDiscount = tour.tour_meta?.['tourmaster-tour-discount'] === 'true' && discountPrice;

    // Ribbon/Badge
    const ribbon = tour.tour_meta?.ribbon;

    // Style variants
    const isCompact = style === 'compact';
    const isFeatured = style === 'featured';

    return (
        <a
            href={`${localePrefix}/tours/${tour.slug}`}
            className="group block bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100"
        >
            {/* Image */}
            <div className={`relative overflow-hidden bg-gray-100 ${isCompact ? 'aspect-[16/9]' : 'aspect-[4/3]'}`}>
                {imageUrl ? (
                    <img
                        src={imageUrl}
                        alt={cleanedTitle}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => { const t = e.currentTarget; t.onerror = null; t.src = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=600&h=400&fit=crop&q=80'; }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-amber-300">
                        <span className="material-icons text-white/50 text-6xl">landscape</span>
                    </div>
                )}

                {/* Discount Badge */}
                {hasDiscount && (
                    <div className="absolute top-4 right-4 z-10">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                            ${discountPrice} <span className="text-[10px] opacity-80 uppercase">{currency}</span>
                        </div>
                        <div className="bg-gray-800/80 text-white px-2 py-0.5 rounded text-xs line-through mt-1 text-right">
                            ${price}
                        </div>
                    </div>
                )}

                {/* Price Badge (when no discount) */}
                {price && !hasDiscount && (
                    <div className="absolute bottom-4 right-4 px-3 py-1.5 bg-white/95 backdrop-blur-sm rounded-full shadow-md">
                        <span className="text-sm text-gray-500">{lang === 'zh' ? '起价 ' : 'From '}</span>
                        <span className="font-bold text-orange-500">${price}</span>
                        {currency && <span className="ml-1 text-[10px] text-gray-400 font-bold uppercase">{currency}</span>}
                    </div>
                )}

                {/* Ribbon */}
                {ribbon && (
                    <div className="absolute top-4 left-4">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-3 py-1 text-xs font-bold rounded-full shadow-md">
                            {ribbon}
                        </div>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className={`p-5 ${isFeatured ? 'p-6' : ''}`}>
                {/* Title */}
                <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-orange-500 transition-colors line-clamp-2 text-lg">
                    {cleanedTitle}
                </h3>

                {/* Duration */}
                {durationText && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                        <span className="material-icons text-base text-orange-400">schedule</span>
                        <span>{durationText}</span>
                    </div>
                )}

                {/* Destination badges */}
                {tour.tour_terms?.destinations && tour.tour_terms.destinations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {tour.tour_terms.destinations.slice(0, 2).map((dest) => (
                            <span
                                key={dest.id}
                                className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full"
                            >
                                {dest.name}
                            </span>
                        ))}
                    </div>
                )}

                {/* Excerpt (optional) */}
                {showExcerpt && excerptWords > 0 && tour.excerpt?.rendered && (
                    <p className="text-gray-500 text-sm line-clamp-2 mt-2">
                        {getExcerptWords(tour.excerpt.rendered, excerptWords)}
                    </p>
                )}
            </div>
        </a>
    );
}

// Default export for easy importing
export default TourCard;
