import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useEmblaCarousel from 'embla-carousel-react';

// Photo Lightbox with Embla Carousel slider
export default function PhotoLightbox({
    images,
    imageDimensions,
    authorName,
    initialIndex = 0,
    lang = 'en',
    returnFocusTo,
    onClose
}: {
    images: string[];
    imageDimensions?: ({ width: number; height: number } | undefined)[];
    authorName: string;
    initialIndex?: number;
    lang?: string;
    returnFocusTo?: HTMLElement;
    onClose: () => void;
}) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const [emblaRef, emblaApi] = useEmblaCarousel({
        startIndex: initialIndex,
        loop: true,
        align: 'center'
    });
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const isChinese = lang === 'zh';

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
        const trigger = returnFocusTo ?? (document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null);

        const focusCloseButton = window.requestAnimationFrame(() => {
            dialogRef.current?.querySelector<HTMLButtonElement>('[data-lightbox-close]')?.focus();
        });

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                scrollPrev();
                return;
            }

            if (e.key === 'ArrowRight') {
                e.preventDefault();
                scrollNext();
                return;
            }

            if (e.key !== 'Tab' || !dialogRef.current) return;

            const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )].filter((element) => !element.hasAttribute('hidden'));
            if (!focusable.length) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        return () => {
            window.cancelAnimationFrame(focusCloseButton);
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = previousOverflow;
            trigger?.focus({ preventScroll: true });
        };
    }, [onClose, returnFocusTo, scrollPrev, scrollNext]);

    const dialog = (
        <div
            ref={dialogRef}
            className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/90"
            role="dialog"
            aria-modal="true"
            aria-label={isChinese ? "相簿" : "Photo gallery"}
            onClick={onClose}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-4 right-4 z-10 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label={isChinese ? "關閉相簿" : "Close photo gallery"}
                data-lightbox-close
            >
                <span className="material-icons text-2xl">close</span>
            </button>

            {/* Carousel - clicking on the container (outside image) closes lightbox */}
            <div
                className="w-full h-full overflow-hidden"
                ref={emblaRef}
            >
                <div className="flex h-full">
                    {images.map((src, idx) => (
                        <div
                            key={`${src}-${idx}`}
                            className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-4"
                        >
                            <img
                                src={src}
                                width={imageDimensions?.[idx]?.width}
                                height={imageDimensions?.[idx]?.height}
                                alt={isChinese ? `${authorName}的第 ${idx + 1} 張照片` : `${authorName}'s photo ${idx + 1}`}
                                className="!w-auto !h-auto !max-w-full !max-h-[85vh] !m-0 object-contain rounded-lg cursor-default"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onClick={(e) => e.stopPropagation()}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation arrows - properly centered with flex */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        aria-label={isChinese ? "上一張照片" : "Previous photo"}
                    >
                        <span className="material-icons text-3xl">chevron_left</span>
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); scrollNext(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                        aria-label={isChinese ? "下一張照片" : "Next photo"}
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
                <span className="text-white/80 text-sm" aria-live="polite">
                    {currentIndex + 1} / {images.length}
                </span>
            </div>
        </div>
    );

    return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}
