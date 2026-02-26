import React, { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { WPTour } from "../lib/wordpress/types";
import TourInquiryModal from "./TourInquiryModal";
import { getCfTransformUrl, wpUrl } from "../lib/wp-url";
import { getTourImageUrl } from "../lib/wordpress/image";

interface FeaturedToursHeroProps {
    tours: WPTour[];
    lang: string;
    localePrefix: string;
}

export default function FeaturedToursHero({
    tours,
    lang,
    localePrefix,
}: FeaturedToursHeroProps) {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 40 });
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTour, setSelectedTour] = useState<WPTour | null>(null);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    // Custom Autoplay
    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on("select", onSelect);

        const interval = setInterval(() => {
            if (emblaApi.canScrollNext()) {
                emblaApi.scrollNext();
            } else {
                emblaApi.scrollTo(0);
            }
        }, 5000); // 5 seconds per slide

        return () => {
            clearInterval(interval);
            emblaApi.off("select", onSelect);
        };
    }, [emblaApi, onSelect]);

    const scrollTo = useCallback(
        (index: number) => emblaApi && emblaApi.scrollTo(index),
        [emblaApi]
    );

    const cleanTitle = (html: string) => {
        return html
            .replace(/&#8211;/g, "-")
            .replace(/&#8217;/g, "'")
            .replace(/&amp;/g, "&")
            .replace(/<[^>]+>/g, ""); // Strip tags
    };

    if (!tours || tours.length === 0) return null;

    return (
        <div className="relative min-h-[85vh] bg-gray-900 group">
            {/* Embla Viewport */}
            <div className="overflow-hidden h-full absolute inset-0" ref={emblaRef}>
                <div className="flex h-full">
                    {tours.map((tour, index) => {
                        let imageUrl = tour.optimizedImageUrl || getTourImageUrl(tour) || "";
                        if (imageUrl) {
                            imageUrl = getCfTransformUrl(wpUrl(imageUrl), {
                                width: 1920,
                                height: 1080,
                                format: "webp",
                                quality: 80
                            });
                        }
                        const price = tour.tour_meta?.["tour-price-text"];
                        const location = tour.tour_meta?.location;
                        const duration = tour.tour_meta?.duration_text;

                        return (
                            <div
                                key={tour.id}
                                className="relative flex-[0_0_100%] h-full min-w-0"
                            >
                                {/* Background Image */}
                                <div className="absolute inset-0">
                                    <img
                                        src={imageUrl}
                                        alt={cleanTitle(tour.title.rendered)}
                                        className="w-full h-full object-cover"
                                        loading={index === 0 ? "eager" : "lazy"}
                                    />
                                    {/* Hero Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent opacity-90" />
                                    <div className="absolute inset-0 bg-gradient-to-r from-gray-900/80 via-transparent to-transparent" />
                                </div>

                                {/* Content Container */}
                                <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-end pb-24 md:items-center md:pb-0">
                                    <div className="max-w-3xl animate-fade-in-up">
                                        {/* Badge */}
                                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 backdrop-blur-md rounded-full text-orange-400 text-sm font-bold tracking-widest mb-6 border border-orange-500/20">
                                            <span className="material-icons text-sm">star</span>
                                            {lang === "zh" ? "精選行程" : "FEATURED TOUR"}
                                        </span>

                                        {/* Title */}
                                        <h2 className="text-xl md:text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight drop-shadow-lg">
                                            {cleanTitle(tour.title.rendered)}
                                        </h2>

                                        {/* Meta Info */}
                                        <div className="flex flex-wrap gap-6 text-white/90 mb-8 text-lg font-medium">
                                            {location && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-500">
                                                        place
                                                    </span>
                                                    {location}
                                                </div>
                                            )}
                                            {duration && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-500">
                                                        schedule
                                                    </span>
                                                    {duration}
                                                </div>
                                            )}
                                            {price && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-500">
                                                        sell
                                                    </span>
                                                    {price}
                                                </div>
                                            )}
                                        </div>

                                        {/* Buttons */}
                                        <div className="flex flex-wrap gap-4">
                                            <button
                                                onClick={() => {
                                                    setSelectedTour(tour);
                                                    setIsModalOpen(true);
                                                }}
                                                className="inline-flex items-center gap-3 px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-full transition-all duration-300 shadow-lg shadow-orange-500/30 hover:scale-105 hover:shadow-orange-500/50"
                                            >
                                                {lang === "zh" ? "立即預訂" : "Book Now"}
                                                <span className="material-icons text-lg">
                                                    arrow_forward
                                                </span>
                                            </button>
                                            <a
                                                href={`${localePrefix}/tours/${tour.slug}`}
                                                className="inline-flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-md text-white font-bold rounded-full border border-white/20 hover:bg-white/20 transition-all duration-300"
                                            >
                                                {lang === "zh" ? "查看詳情" : "View Details"}
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Navigation Dots */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-3 z-10">
                {tours.map((_, index) => (
                    <button
                        key={index}
                        className={`w-3 h-3 rounded-full transition-all duration-500 ${index === selectedIndex
                            ? "bg-orange-500 w-8"
                            : "bg-white/30 hover:bg-white/50"
                            }`}
                        onClick={() => scrollTo(index)}
                        aria-label={`Go to slide ${index + 1}`}
                    />
                ))}
            </div>

            {/* Navigation Arrows (Desktop) */}
            <button
                onClick={() => emblaApi && emblaApi.scrollPrev()}
                className="hidden md:flex absolute top-1/2 left-8 transform -translate-y-1/2 w-14 h-14 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-full items-center justify-center text-white transition-all duration-300 hover:scale-110 group/nav"
                aria-label="Previous slide"
            >
                <span className="material-icons text-3xl opacity-70 group-hover/nav:opacity-100">
                    chevron_left
                </span>
            </button>
            <button
                onClick={() => emblaApi && emblaApi.scrollNext()}
                className="hidden md:flex absolute top-1/2 right-8 transform -translate-y-1/2 w-14 h-14 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-full items-center justify-center text-white transition-all duration-300 hover:scale-110 group/nav"
                aria-label="Next slide"
            >
                <span className="material-icons text-3xl opacity-70 group-hover/nav:opacity-100">
                    chevron_right
                </span>
            </button>

            {/* Inquiry Modal */}
            <TourInquiryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tour={selectedTour}
                lang={lang}
            />
        </div>
    );
}
