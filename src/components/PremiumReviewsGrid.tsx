/**
 * Premium Reviews Grid Component for Astro
 * Displays all reviews in a responsive masonry-style grid with modal viewing
 * Uses Embla Carousel for photo slider functionality
 */

import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { GoogleReview } from '../lib/wordpress/types';

// Premium star rating with filled gradient stars
function PremiumStars({ rating }: { rating: number }) {
    const rounded = Math.max(0, Math.min(5, Math.round(rating)));
    return (
        <div className="flex items-center gap-0.5" aria-label={`${rounded} out of 5 stars`}>
            {Array.from({ length: 5 }).map((_, idx) => (
                <svg
                    key={idx}
                    className={`w-5 h-5 ${idx < rounded ? 'text-amber-400' : 'text-gray-200'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
            ))}
        </div>
    );
}

// Premium avatar with gradient border
function PremiumAvatar({ src, name }: { src?: string; name: string }) {
    const initials = name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    if (!src) {
        return (
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#f7941e] to-[#ff6b35] flex items-center justify-center text-white font-bold text-lg shadow-lg">
                {initials}
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-[#f7941e] to-[#ff6b35] rounded-full animate-pulse opacity-50 blur-sm" />
            <img
                src={src}
                alt={name ? `${name} profile photo` : 'Reviewer profile photo'}
                className="relative w-14 h-14 rounded-full border-2 border-white object-cover shadow-lg"
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />
        </div>
    );
}

// Photo Lightbox with Embla Carousel slider
function PhotoLightbox({
    images,
    authorName,
    initialIndex = 0,
    onClose
}: {
    images: string[];
    authorName: string;
    initialIndex?: number;
    onClose: () => void;
}) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        startIndex: initialIndex,
        loop: true,
        align: 'center'
    });
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    // Update current index on scroll
    useEffect(() => {
        if (!emblaApi) return;

        const updateIndex = () => {
            setCurrentIndex(emblaApi.selectedScrollSnap());
        };

        emblaApi.on('select', updateIndex);
        updateIndex();

        return () => {
            emblaApi.off('select', updateIndex);
        };
    }, [emblaApi]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') scrollPrev();
            if (e.key === 'ArrowRight') scrollNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose, scrollPrev, scrollNext]);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90">
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
            >
                <span className="material-icons text-2xl">close</span>
            </button>

            {/* Carousel */}
            <div className="w-full h-full flex items-center justify-center" ref={emblaRef}>
                <div className="flex h-full">
                    {images.map((src, idx) => (
                        <div
                            key={`${src}-${idx}`}
                            className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-4"
                        >
                            <img
                                src={src}
                                alt={`${authorName}'s photo ${idx + 1}`}
                                className="max-w-full max-h-[85vh] object-contain rounded-lg"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation arrows */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={scrollPrev}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Previous"
                    >
                        <span className="material-icons text-3xl">chevron_left</span>
                    </button>
                    <button
                        onClick={scrollNext}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Next"
                    >
                        <span className="material-icons text-3xl">chevron_right</span>
                    </button>
                </>
            )}

            {/* Counter and indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-1">
                    {images.map((_, idx) => (
                        <div
                            key={idx}
                            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-white w-4' : 'bg-white/40'
                                }`}
                        />
                    ))}
                </div>
                <span className="text-white/80 text-sm">
                    {currentIndex + 1} / {images.length}
                </span>
            </div>
        </div>
    );
}

// Single premium review card
function PremiumReviewCard({
    review,
    onClick
}: {
    review: GoogleReview;
    onClick: () => void;
}) {
    const text = review.text || '';
    const shouldTruncate = text.length > 220;
    const displayText = shouldTruncate ? text.slice(0, 220) + '...' : text;

    return (
        <div
            className="group bg-white rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100 cursor-pointer hover:-translate-y-1"
            onClick={onClick}
        >
            {/* Header: Avatar and reviewer info */}
            <div className="flex items-start gap-4 mb-4">
                <PremiumAvatar src={review.profile_photo_url} name={review.author_name} />
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-900 truncate text-lg">{review.author_name}</h4>
                    <div className="flex items-center gap-3 mt-1">
                        <PremiumStars rating={review.rating} />
                        <span className="text-xs text-gray-400">{review.relative_time_description}</span>
                    </div>
                </div>
                {/* Google logo badge */}
                <div className="flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                </div>
            </div>

            {/* Review text */}
            <div>
                <p className="text-gray-600 leading-relaxed text-sm">
                    &ldquo;{displayText}&rdquo;
                </p>
                {shouldTruncate && (
                    <span className="text-[#f7941e] font-semibold text-sm mt-2 inline-block group-hover:underline">
                        Read more →
                    </span>
                )}
            </div>

            {/* Photos preview */}
            {review.images && review.images.length > 0 && (
                <div className="mt-4 flex items-center gap-2">
                    <span className="material-icons text-gray-400 text-sm">photo_library</span>
                    <span className="text-xs text-gray-400">{review.images.length} photo{review.images.length > 1 ? 's' : ''}</span>
                </div>
            )}

            {/* Verified badge */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Verified Google Review</span>
            </div>
        </div>
    );
}

// Premium Review Modal
function PremiumReviewModal({
    review,
    onClose,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
    currentIndex,
    totalReviews,
}: {
    review: GoogleReview;
    onClose: () => void;
    onNext: () => void;
    onPrev: () => void;
    hasNext: boolean;
    hasPrev: boolean;
    currentIndex: number;
    totalReviews: number;
}) {
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // Close on ESC key and handle arrow navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't handle keys when lightbox is open (it has its own handlers)
            if (lightboxIndex !== null) return;

            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && hasPrev) onPrev();
            if (e.key === 'ArrowRight' && hasNext) onNext();
        };

        window.addEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'hidden';

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [onClose, onNext, onPrev, hasNext, hasPrev, lightboxIndex]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                onClick={onClose}
                style={{ animation: 'fadeIn 0.2s ease-out' }}
            />

            {/* Modal */}
            <div
                className="relative bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                style={{ animation: 'scaleIn 0.3s ease-out' }}
            >
                {/* Header with gradient */}
                <div className="bg-gradient-to-r from-[#f7941e] to-[#ff6b35] p-6 relative overflow-hidden">
                    {/* Pattern overlay */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,#fff_1px,transparent_1px)] [background-size:16px_16px]" />

                    <div className="relative flex items-center gap-4">
                        <PremiumAvatar src={review.profile_photo_url} name={review.author_name} />
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-white truncate">{review.author_name}</h3>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, idx) => (
                                        <svg
                                            key={idx}
                                            className={`w-5 h-5 ${idx < review.rating ? 'text-white' : 'text-white/30'}`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                        >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                    ))}
                                </div>
                                <span className="text-white/80 text-sm">{review.relative_time_description}</span>
                            </div>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            aria-label="Close"
                        >
                            <span className="material-icons">close</span>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Photos - clickable to open lightbox */}
                    {review.images && review.images.length > 0 && (
                        <div className="mb-6">
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {review.images.map((src, idx) => (
                                    <button
                                        key={`${src}-${idx}`}
                                        onClick={() => setLightboxIndex(idx)}
                                        className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer"
                                    >
                                        <img
                                            src={src}
                                            alt={`${review.author_name} review photo ${idx + 1}`}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                            loading="lazy"
                                            referrerPolicy="no-referrer"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                                            }}
                                        />
                                        {/* Hover overlay with zoom icon */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                            <span className="material-icons text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                                                zoom_in
                                            </span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Review text */}
                    <p className="text-gray-700 leading-relaxed text-lg whitespace-pre-wrap">
                        &ldquo;{review.text}&rdquo;
                    </p>

                    {/* Verified badge */}
                    <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
                        <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span>Verified Google Review</span>
                        <span className="mx-2">•</span>
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        <span>Powered by Google</span>
                    </div>
                </div>

                {/* Footer with navigation */}
                <div className="border-t bg-gray-50 px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${hasPrev
                            ? 'bg-gradient-to-r from-[#f7941e] to-[#ff6b35] text-white hover:shadow-lg hover:scale-105'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <span className="material-icons text-sm">arrow_back</span>
                        Previous
                    </button>

                    <div className="text-sm text-gray-500">
                        {currentIndex + 1} of {totalReviews}
                    </div>

                    <button
                        onClick={onNext}
                        disabled={!hasNext}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-all ${hasNext
                            ? 'bg-gradient-to-r from-[#f7941e] to-[#ff6b35] text-white hover:shadow-lg hover:scale-105'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        Next
                        <span className="material-icons text-sm">arrow_forward</span>
                    </button>
                </div>
            </div>

            {/* Animation styles */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { 
                        opacity: 0; 
                        transform: scale(0.95);
                    }
                    to { 
                        opacity: 1; 
                        transform: scale(1);
                    }
                }
            `}</style>

            {/* Photo Lightbox */}
            {lightboxIndex !== null && review.images && (
                <PhotoLightbox
                    images={review.images}
                    authorName={review.author_name}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                />
            )}
        </div>
    );
}

// Main component
export default function PremiumReviewsGrid({
    reviews,
    lang = 'en'
}: {
    reviews: GoogleReview[];
    lang?: string;
}) {
    const [selectedReviewIndex, setSelectedReviewIndex] = useState<number | null>(null);
    const [visibleCount, setVisibleCount] = useState(9);

    const handleLoadMore = useCallback(() => {
        setVisibleCount(prev => Math.min(prev + 9, reviews.length));
    }, [reviews.length]);

    const visibleReviews = reviews.slice(0, visibleCount);
    const hasMore = visibleCount < reviews.length;

    return (
        <>
            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleReviews.map((review, index) => (
                    <PremiumReviewCard
                        key={`${review.author_name}-${review.time}-${index}`}
                        review={review}
                        onClick={() => setSelectedReviewIndex(index)}
                    />
                ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
                <div className="text-center mt-12">
                    <button
                        onClick={handleLoadMore}
                        className="inline-flex items-center gap-2 px-10 py-4 bg-white border-2 border-[#f7941e] text-[#f7941e] hover:bg-[#f7941e] hover:text-white rounded-full font-bold text-lg transition-all duration-300 shadow-sm hover:shadow-lg hover:scale-105"
                    >
                        <span className="material-icons">expand_more</span>
                        {lang === 'zh' ? `加载更多 (${reviews.length - visibleCount} 条)` : `Load More (${reviews.length - visibleCount} remaining)`}
                    </button>
                </div>
            )}

            {/* Modal */}
            {selectedReviewIndex !== null && (
                <PremiumReviewModal
                    review={reviews[selectedReviewIndex]}
                    onClose={() => setSelectedReviewIndex(null)}
                    onNext={() => setSelectedReviewIndex(prev => prev !== null && prev < reviews.length - 1 ? prev + 1 : prev)}
                    onPrev={() => setSelectedReviewIndex(prev => prev !== null && prev > 0 ? prev - 1 : prev)}
                    hasNext={selectedReviewIndex < reviews.length - 1}
                    hasPrev={selectedReviewIndex > 0}
                    currentIndex={selectedReviewIndex}
                    totalReviews={reviews.length}
                />
            )}
        </>
    );
}
