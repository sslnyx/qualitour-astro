import { useState } from 'react';
import type { GoogleReview } from '../lib/wordpress/types';
import PhotoLightbox from './PhotoLightbox';

interface SimpleReviewsGridProps {
    reviews: GoogleReview[];
    initialCount?: number;
    showLoadMore?: boolean;
}

// Star rating component
function StarRating({ rating }: { rating: number }) {
    return (
        <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    className={`w-4 h-4 ${star <= rating ? 'text-yellow-400' : 'text-gray-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

// Avatar component
function Avatar({ src, name }: { src?: string; name: string }) {
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const colors = [
        'bg-blue-500',
        'bg-green-500',
        'bg-purple-500',
        'bg-pink-500',
        'bg-indigo-500',
        'bg-teal-500',
    ];
    const colorIndex = name.length % colors.length;

    if (src) {
        return (
            <img
                src={src}
                alt={name}
                className="w-10 h-10 rounded-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
            />
        );
    }

    return (
        <div className={`w-10 h-10 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-semibold text-sm`}>
            {initials}
        </div>
    );
}

// Individual review card with expand/collapse
function ReviewCard({ review }: { review: GoogleReview }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [lightboxData, setLightboxData] = useState<{ images: string[]; index: number } | null>(null);

    const text = review.text || '';
    const shouldTruncate = text.length > 200;
    const displayText = shouldTruncate && !isExpanded ? text.slice(0, 200) + '...' : text;
    const hasPhotos = review.images && review.images.length > 0;

    const openLightbox = (index: number) => {
        if (review.images) {
            setLightboxData({ images: review.images, index });
        }
    };

    return (
        <>
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                    <Avatar src={review.profile_photo_url} name={review.author_name} />
                    <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-900 truncate">{review.author_name}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={review.rating} />
                            <span className="text-xs text-gray-400">{review.relative_time_description}</span>
                        </div>
                    </div>
                    {/* Google logo */}
                    <svg className="w-5 h-5 flex-shrink-0 opacity-40" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                </div>

                {/* Review text */}
                <p className="text-gray-600 text-sm leading-relaxed">
                    "{displayText}"
                </p>

                {/* Read more/less button */}
                {shouldTruncate && (
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="text-[#f7941e] text-sm font-medium mt-2 hover:underline focus:outline-none"
                    >
                        {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                )}

                {/* Photo thumbnails - show when expanded or always if few */}
                {hasPhotos && (isExpanded || !shouldTruncate) && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                        {review.images!.slice(0, 4).map((img, idx) => (
                            <button
                                key={idx}
                                onClick={() => openLightbox(idx)}
                                className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:border-[#f7941e] transition-colors focus:outline-none focus:ring-2 focus:ring-[#f7941e] focus:ring-offset-2"
                            >
                                <img
                                    src={img}
                                    alt={`Review photo ${idx + 1}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                />
                            </button>
                        ))}
                        {review.images!.length > 4 && (
                            <button
                                onClick={() => openLightbox(4)}
                                className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium hover:bg-gray-200 transition-colors"
                            >
                                +{review.images!.length - 4}
                            </button>
                        )}
                    </div>
                )}

                {/* Photo count hint when collapsed */}
                {hasPhotos && shouldTruncate && !isExpanded && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>{review.images!.length} photo{review.images!.length > 1 ? 's' : ''}</span>
                    </div>
                )}

                {/* Verified badge */}
                <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Verified Google Review</span>
                </div>
            </div>

            {/* Photo Lightbox */}
            {lightboxData && (
                <PhotoLightbox
                    images={lightboxData.images}
                    authorName={review.author_name}
                    initialIndex={lightboxData.index}
                    onClose={() => setLightboxData(null)}
                />
            )}
        </>
    );
}

// Main grid component
export default function SimpleReviewsGrid({
    reviews,
    initialCount = 6,
    showLoadMore = true,
}: SimpleReviewsGridProps) {
    const [visibleCount, setVisibleCount] = useState(initialCount);

    if (!reviews || reviews.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p>No reviews available yet.</p>
            </div>
        );
    }

    const visibleReviews = reviews.slice(0, visibleCount);
    const hasMore = visibleCount < reviews.length;

    return (
        <div>
            {/* Reviews Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {visibleReviews.map((review, index) => (
                    <ReviewCard key={review.time || index} review={review} />
                ))}
            </div>

            {/* Load More Button */}
            {showLoadMore && hasMore && (
                <div className="text-center mt-8">
                    <button
                        onClick={() => setVisibleCount((prev) => prev + 6)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-full transition-colors"
                    >
                        <span>Load More Reviews</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <p className="text-sm text-gray-400 mt-2">
                        Showing {visibleReviews.length} of {reviews.length} reviews
                    </p>
                </div>
            )}
        </div>
    );
}
