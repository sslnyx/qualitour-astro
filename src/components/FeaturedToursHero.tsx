import React, { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { WPTour } from "../lib/wordpress/types";
import TourInquiryModal from "./TourInquiryModal";
import { getCfTransformUrl } from "../lib/wp-url";
import { getTourImageUrl, tourHeroImageSizes } from "../lib/wordpress/image-source";
import { applyImageFallback } from '../lib/image-delivery.mjs';

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
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPointerOver, setIsPointerOver] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedTour, setSelectedTour] = useState<WPTour | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setSelectedIndex(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on("select", onSelect);
        return () => { emblaApi.off("select", onSelect); };
    }, [emblaApi, onSelect]);

    useEffect(() => {
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        setIsPlaying(!motion.matches);
        const pauseForReducedMotion = (event: MediaQueryListEvent) => {
            if (event.matches) setIsPlaying(false);
        };
        motion.addEventListener("change", pauseForReducedMotion);
        return () => motion.removeEventListener("change", pauseForReducedMotion);
    }, []);

    useEffect(() => {
        if (!emblaApi || !isPlaying || isModalOpen || isPointerOver || tours.length < 2) return;
        const interval = window.setInterval(() => {
            if (document.hidden) return;
            if (emblaApi.canScrollNext()) emblaApi.scrollNext();
            else emblaApi.scrollTo(0);
        }, 5000);
        return () => window.clearInterval(interval);
    }, [emblaApi, isPlaying, isModalOpen, isPointerOver, tours.length]);

    const scrollTo = useCallback(
        (index: number) => {
            setIsPlaying(false);
            emblaApi?.scrollTo(index);
        },
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

    const isChinese = lang === "zh";
    const rotationLabel = isPlaying
        ? (isChinese ? "暫停輪播" : "Pause slideshow")
        : (isChinese ? "播放輪播" : "Play slideshow");

    return (
        <section
            aria-label={isChinese ? "精選行程輪播" : "Featured tours slideshow"}
            className="bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800"
            onPointerEnter={(event) => {
                if (event.pointerType === "mouse") setIsPointerOver(true);
            }}
            onPointerLeave={() => setIsPointerOver(false)}
            onFocusCapture={(event) => {
                if (!event.target.closest("[data-carousel-rotation]")) setIsPlaying(false);
            }}
        >
            {/* Embla Viewport */}
            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex touch-pan-y">
                    {tours.map((tour, index) => {
                        const source = getTourImageUrl(tour);
                        const imageUrl = tour.optimizedHero?.src || (source
                            ? getCfTransformUrl(source, { width: 1280, format: "webp", quality: 80 })
                            : undefined);
                        const price = tour.tour_meta?.["tour-price-text"];
                        const location = tour.tour_meta?.location;
                        const duration = tour.tour_meta?.duration_text;

                        return (
                            <div
                                key={tour.id}
                                inert={index !== selectedIndex}
                                className="flex flex-[0_0_100%] min-w-0"
                            >
                                <div className={`mx-auto grid w-full max-w-7xl content-start items-center gap-6 px-4 pt-7 pb-4 sm:px-6 lg:content-center lg:gap-12 lg:px-8 lg:pt-10 lg:pb-6 ${imageUrl ? "lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" : ""}`}>
                                    <div className="min-w-0 max-w-3xl">
                                        {/* Badge */}
                                        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1.5 text-xs font-bold tracking-wide text-orange-200 sm:mb-4">
                                            <span className="material-icons text-sm" aria-hidden="true">star</span>
                                            {lang === "zh" ? "精選行程" : "FEATURED TOUR"}
                                        </span>

                                        {/* Title */}
                                        <h2 className="break-words text-2xl leading-tight font-bold text-white sm:text-3xl lg:text-4xl">
                                            {cleanTitle(tour.title.rendered)}
                                        </h2>

                                        {/* Meta Info */}
                                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-gray-200 empty:hidden sm:text-base">
                                            {location && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-400" aria-hidden="true">
                                                        place
                                                    </span>
                                                    {location}
                                                </div>
                                            )}
                                            {duration && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-400" aria-hidden="true">
                                                        schedule
                                                    </span>
                                                    {duration}
                                                </div>
                                            )}
                                            {price && (
                                                <div className="flex items-center gap-2">
                                                    <span className="material-icons text-orange-400" aria-hidden="true">
                                                        sell
                                                    </span>
                                                    {price}
                                                </div>
                                            )}
                                        </div>

                                        {/* Buttons */}
                                        <div className="mt-4 flex flex-wrap gap-2 sm:mt-6 sm:gap-3">
                                            <button
                                                type="button"
                                                onClick={(event) => {
                                                    triggerRef.current = event.currentTarget;
                                                    setSelectedTour(tour);
                                                    setIsModalOpen(true);
                                                }}
                                                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#a8410b] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#883608] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-6 sm:text-base"
                                            >
                                                {isChinese ? "查詢行程" : "Enquire about this tour"}
                                                <span className="material-icons text-lg" aria-hidden="true">
                                                    arrow_forward
                                                </span>
                                            </button>
                                            <a
                                                href={`${localePrefix}/tours/${tour.slug}`}
                                                className="inline-flex min-h-11 items-center rounded-full border border-white/40 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-6 sm:text-base"
                                            >
                                                {lang === "zh" ? "查看詳情" : "View Details"}
                                            </a>
                                        </div>
                                    </div>
                                    {imageUrl && (
                                        <div className="flex min-w-0 justify-center">
                                            <img
                                                src={imageUrl}
                                                srcSet={tour.optimizedHero?.srcSet || undefined}
                                                sizes={tour.optimizedHero?.srcSet ? tourHeroImageSizes : undefined}
                                                width={tour.optimizedHero?.width}
                                                height={tour.optimizedHero?.height}
                                                alt={cleanTitle(tour.title.rendered)}
                                                className="tour-hero-cover rounded-xl"
                                                loading={index === 0 ? "eager" : "lazy"}
                                                fetchPriority={index === 0 ? "high" : "low"}
                                                decoding="async"
                                                onError={(event) => applyImageFallback(event.currentTarget, "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1280&fit=max&q=80")}
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {tours.length > 1 && (
                <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-1 px-4 pb-5 sm:gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setIsPlaying(false);
                            emblaApi?.scrollPrev();
                        }}
                        className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                        aria-label={isChinese ? "上一張" : "Previous slide"}
                    >
                        <span className="material-icons" aria-hidden="true">chevron_left</span>
                    </button>
                    <div className="flex">
                        {tours.map((_, index) => (
                            <button
                                key={index}
                                type="button"
                                className="grid h-11 w-6 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white sm:w-8"
                                onClick={() => scrollTo(index)}
                                aria-label={isChinese ? `切換至第 ${index + 1} 張` : `Go to slide ${index + 1}`}
                                aria-current={index === selectedIndex ? "true" : undefined}
                            >
                                <span aria-hidden="true" className={`h-2.5 rounded-full ${index === selectedIndex ? "w-5 bg-orange-400" : "w-2.5 bg-white/70"}`} />
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setIsPlaying(false);
                            emblaApi?.scrollNext();
                        }}
                        className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                        aria-label={isChinese ? "下一張" : "Next slide"}
                    >
                        <span className="material-icons" aria-hidden="true">chevron_right</span>
                    </button>
                    <button
                        type="button"
                        data-carousel-rotation
                        className="grid size-10 shrink-0 place-items-center rounded-full border border-white/30 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
                        aria-label={rotationLabel}
                        onClick={() => setIsPlaying((playing) => !playing)}
                    >
                        <span className="material-icons" aria-hidden="true">{isPlaying ? "pause" : "play_arrow"}</span>
                    </button>
                </div>
            )}

            {/* Inquiry Modal */}
            <TourInquiryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                tour={selectedTour}
                lang={lang}
                returnFocusTo={triggerRef.current}
            />
        </section>
    );
}
