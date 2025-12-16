import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';

// Photo Lightbox with Embla Carousel slider
export default function PhotoLightbox({
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={onClose}>
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Close"
            >
                <span className="material-icons text-2xl">close</span>
            </button>

            {/* Carousel */}
            <div className="w-full h-full flex items-center justify-center" ref={emblaRef} onClick={(e) => e.stopPropagation()}>
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
                        onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Previous"
                    >
                        <span className="material-icons text-3xl">chevron_left</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Next"
                    >
                        <span className="material-icons text-3xl">chevron_right</span>
                    </button>
                </>
            )}

            {/* Counter and indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
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
