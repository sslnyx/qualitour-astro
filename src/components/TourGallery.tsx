/**
 * TourGallery - photo collage at the top of a tour page.
 *
 * - 1 photo: a single banner (a wide photo fills it; a poster or portrait is shown whole on a blurred backdrop).
 * - 2 photos: two halves. 3-4: one large photo and two stacked. 5 or more: one large and a 2x2 grid.
 * - On phones: a swipeable strip with a counter.
 * Every photo opens the shared lightbox; "all photos" opens it at the first photo.
 */

import { useCallback, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import PhotoLightbox from './PhotoLightbox';

export interface GalleryPhoto {
    thumb: string;
    full: string;
    width?: number;
    height?: number;
}

interface Props {
    photos: GalleryPhoto[];
    title: string;
    lang?: string;
}

const imageClass = '!m-0 !h-full !w-full object-cover';

export function TourGallery({ photos, title, lang = 'en' }: Props) {
    const zh = lang === 'zh';
    const [lightbox, setLightbox] = useState<{ index: number; trigger: HTMLButtonElement } | null>(null);
    const [slide, setSlide] = useState(0);
    const strip = useRef<HTMLDivElement>(null);
    const closeLightbox = useCallback(() => setLightbox(null), []);

    if (photos.length === 0) return null;

    const open = (index: number) => (event: MouseEvent<HTMLButtonElement>) =>
        setLightbox({ index, trigger: event.currentTarget });
    const altFor = (index: number) => (index === 0 ? title : `${title} ${index + 1}`);

    // One photo = one button that opens the lightbox. `className` sets its position and size.
    const tile = (index: number, className: string, src: string, eager = false, imgClass = imageClass) => (
        <button
            type="button"
            key={index}
            className={`group block overflow-hidden bg-gray-200 p-0 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-orange-500 ${className}`}
            onClick={open(index)}
            aria-label={`Open photo ${index + 1} of ${photos.length}`}
        >
            <img
                src={src}
                alt={altFor(index)}
                className={`${imgClass} motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105`}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : undefined}
                decoding="async"
            />
            <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
        </button>
    );

    const lightboxView = lightbox && (
        <PhotoLightbox
            images={photos.map(photo => photo.full)}
            imageDimensions={photos.map(photo => (photo.width && photo.height ? { width: photo.width, height: photo.height } : undefined))}
            authorName={title}
            initialIndex={lightbox.index}
            lang={lang}
            onClose={closeLightbox}
            returnFocusTo={lightbox.trigger}
        />
    );

    // ---- One photo: banner -------------------------------------------------------------------------------------
    if (photos.length === 1) {
        const [photo] = photos;
        const wide = photo.width && photo.height ? photo.width / photo.height >= 1.5 : true;
        return (
            <div className="relative h-[220px] overflow-hidden rounded-2xl bg-gray-900 sm:h-[320px] lg:h-[440px]">
                {!wide && (
                    <img
                        src={photo.thumb}
                        alt=""
                        aria-hidden="true"
                        className="!m-0 absolute inset-0 !h-full !w-full scale-110 object-cover opacity-50 blur-2xl"
                    />
                )}
                {tile(0, 'absolute inset-0 !bg-transparent', photo.full, true, wide ? imageClass : '!m-0 !h-full !w-full object-contain')}
                {lightboxView}
            </div>
        );
    }

    // ---- Several photos: collage on desktop, swipeable strip on phones -----------------------------------------
    const count = photos.length;
    const grid =
        count === 2
            ? 'grid-cols-2'
            : count < 5
              ? 'grid-cols-[2fr_1fr] grid-rows-2'
              : 'grid-cols-4 grid-rows-2';
    const small = count === 2 ? [1] : count < 5 ? [1, 2] : [1, 2, 3, 4];
    const firstClass = count === 2 ? '' : count < 5 ? 'row-span-2' : 'col-span-2 row-span-2';

    const onStripScroll = () => {
        const el = strip.current;
        if (!el) return;
        setSlide(Math.min(count - 1, Math.round(el.scrollLeft / (el.scrollWidth / count))));
    };

    return (
        <div className="relative">
            {/* Desktop collage */}
            <div className={`hidden h-[360px] gap-2 overflow-hidden rounded-2xl md:grid lg:h-[440px] ${grid}`}>
                {tile(0, `relative ${firstClass}`, photos[0].full, true)}
                {small.map(index => tile(index, 'relative', photos[index].thumb))}
            </div>
            <button
                type="button"
                onClick={open(0)}
                className="absolute bottom-3 right-3 hidden items-center gap-1.5 rounded-lg bg-white/95 px-3.5 py-2 text-sm font-semibold text-gray-900 shadow-md transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500 md:inline-flex"
            >
                <span className="material-icons text-lg" aria-hidden="true">photo_library</span>
                {zh ? `全部照片（${count}）` : `All photos (${count})`}
            </button>

            {/* Phone strip */}
            <div className="md:hidden">
                <div
                    ref={strip}
                    onScroll={onStripScroll}
                    className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4"
                >
                    {photos.map((photo, index) =>
                        tile(index, 'relative aspect-[4/3] w-[86%] shrink-0 snap-center rounded-xl', index === 0 ? photo.full : photo.thumb, index === 0),
                    )}
                </div>
                <span className="pointer-events-none absolute bottom-3 right-6 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                    {slide + 1} / {count}
                </span>
            </div>

            {lightboxView}
        </div>
    );
}

export default TourGallery;
