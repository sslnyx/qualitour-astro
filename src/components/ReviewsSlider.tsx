/**
 * ReviewsSlider - Carousel slider for Google Reviews
 * Uses Embla Carousel for smooth sliding
 */

import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import type { GoogleReview } from '../lib/wordpress/types';
import PhotoLightbox from './PhotoLightbox';
import { getCfTransformUrl, wpUrl } from '../lib/wp-url';

interface ReviewsSliderProps {
    reviews: GoogleReview[];
    totalReviews?: number;
    lang?: string;
}

export default function ReviewsSlider({ reviews, totalReviews, lang = 'en' }: ReviewsSliderProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        align: 'start',
        slidesToScroll: 1,
    });

    const [currentIndex, setCurrentIndex] = useState(0);

    // Lightbox State
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [lightboxAuthor, setLightboxAuthor] = useState('');

    const scrollPrev = useCallback(() => {
        if (emblaApi) emblaApi.scrollPrev();
    }, [emblaApi]);

    const scrollNext = useCallback(() => {
        if (emblaApi) emblaApi.scrollNext();
    }, [emblaApi]);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setCurrentIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;

        onSelect();
        emblaApi.on('select', onSelect);

        return () => {
            emblaApi.off('select', onSelect);
        };
    }, [emblaApi, onSelect]);

    // Auto-play
    useEffect(() => {
        if (!emblaApi || lightboxOpen) return; // Pause auto-play when lightbox is open

        const interval = setInterval(() => {
            emblaApi.scrollNext();
        }, 5000); // Change slide every 5 seconds

        return () => clearInterval(interval);
    }, [emblaApi, lightboxOpen]);

    // Lightbox Handlers
    const openLightbox = (images: string[], index: number, author: string) => {
        setLightboxImages(images);
        setLightboxIndex(index);
        setLightboxAuthor(author);
        setLightboxOpen(true);
    };

    if (!reviews || reviews.length === 0) {
        return (
            <div className="text-center text-gray-500 py-12">
                <p>{lang === 'zh' ? '暂无评论' : 'No reviews available'}</p>
            </div>
        );
    }

    const totalCount = totalReviews || reviews.length;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Slider & Arrows Wrapper for proper alignment */}
            <div className="relative">
                {/* Embla Container */}
                <div className="overflow-hidden py-10 -my-10" ref={emblaRef}>
                    <div className="flex">
                        {reviews.map((review, index) => (
                            <div
                                key={index}
                                className="flex-[0_0_100%] min-w-0 md:flex-[0_0_50%] lg:flex-[0_0_33.333%] px-3"
                            >
                                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow h-full flex flex-col">
                                    {/* Header */}
                                    <div className="flex items-center gap-4 mb-4">
                                        {review.profile_photo_url ? (
                                            <img
                                                src={getCfTransformUrl(wpUrl(review.profile_photo_url), { width: 100, height: 100, format: 'webp' })}
                                                alt={review.author_name}
                                                className="w-12 h-12 rounded-full object-cover"
                                                referrerPolicy="no-referrer"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                {review.author_name.charAt(0)}
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-gray-900 truncate">
                                                {review.author_name}
                                            </div>
                                            <div className="flex gap-0.5 text-orange-400">
                                                {Array.from({ length: 5 }).map((_, i) => (
                                                    <span
                                                        key={i}
                                                        className={`material-icons text-sm ${i < review.rating ? 'text-orange-400' : 'text-gray-300'
                                                            }`}
                                                    >
                                                        star
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Review Text */}
                                    <p className="text-gray-700 text-sm leading-relaxed flex-1 line-clamp-6 mb-4">
                                        {review.text}
                                    </p>

                                    {review.images && review.images.length > 0 && (
                                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 clip-padding [&::-webkit-scrollbar]:hidden">
                                            {review.images.map((img, imgIndex) => (
                                                <button
                                                    key={imgIndex}
                                                    onClick={() => openLightbox(review.images!, imgIndex, review.author_name)}
                                                    className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-gray-200 hover:opacity-80 transition-opacity"
                                                >
                                                    <img
                                                        src={getCfTransformUrl(wpUrl(img), { width: 400, height: 400, format: 'webp' })}
                                                        alt={`Review photo ${imgIndex + 1}`}
                                                        className="w-full h-full object-cover"
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Time */}
                                    <div className="text-xs text-gray-400 mt-auto">
                                        {review.relative_time_description}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Navigation Buttons */}
                <button
                    onClick={scrollPrev}
                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10 hidden md:flex"
                    aria-label="Previous reviews"
                >
                    <span className="material-icons text-gray-600">chevron_left</span>
                </button>

                <button
                    onClick={scrollNext}
                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10 hidden md:flex"
                    aria-label="Next reviews"
                >
                    <span className="material-icons text-gray-600">chevron_right</span>
                </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex justify-center gap-2 mt-8">
                {reviews.map((_, index) => (
                    <button
                        key={index}
                        onClick={() => emblaApi?.scrollTo(index)}
                        className={`w-2 h-2 rounded-full transition-all ${index === currentIndex
                            ? 'bg-orange-500 w-8'
                            : 'bg-gray-300 hover:bg-gray-400'
                            }`}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            {/* Google Badge */}
            <div className="text-center mt-8">
                <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-full shadow-sm border border-gray-200">
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    <span className="font-semibold text-gray-900">{lang === 'zh' ? '谷歌评论' : 'Google Reviews'}</span>
                    <div className="flex gap-0.5 text-orange-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className="material-icons text-sm">star</span>
                        ))}
                    </div>
                    <span className="text-gray-600 text-sm">
                        {lang === 'zh'
                            ? `基于 ${totalCount}+ 条评论`
                            : `Based on ${totalCount}+ reviews`
                        }
                    </span>
                </div>
            </div>

            {/* Lightbox Portal */}
            {lightboxOpen && (
                <PhotoLightbox
                    images={lightboxImages}
                    authorName={lightboxAuthor}
                    initialIndex={lightboxIndex}
                    onClose={() => setLightboxOpen(false)}
                />
            )}
        </div>
    );
}
