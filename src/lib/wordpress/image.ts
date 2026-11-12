import { collectInlineImageSources } from '../inline-images.mjs';
import { getImage, inferRemoteSize } from "astro:assets";
import { createImageDelivery, collectTourPhotoSources, mapWithConcurrency, inferImageDimensions } from '../image-delivery.mjs';
import { CMS_ORIGIN, normalizeCmsMediaUrl } from '../cms/read-client.mjs';
import type { WPTour } from "./types";
import { getTourImageUrl } from "./image-source";
export { getTourImageUrl } from "./image-source";
import { wpUrl, getCfTransformUrl } from "../wp-url";

/**
 * Extract the best available image URL from a tour object.
 */
// Global semaphore for limiting concurrent inferSize operations to prevent segfaults/memory exhaustion
const MAX_CONCURRENT_INFER_SIZE = 10;
let activeInferSizeOps = 0;
const inferSizeQueue: (() => void)[] = [];

async function acquireInferSizeSlot(): Promise<void> {
    if (activeInferSizeOps < MAX_CONCURRENT_INFER_SIZE) {
        activeInferSizeOps++;
        return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
        inferSizeQueue.push(resolve);
    });
}

function releaseInferSizeSlot() {
    activeInferSizeOps--;
    if (inferSizeQueue.length > 0) {
        const next = inferSizeQueue.shift();
        activeInferSizeOps++; // Re-acquire for the queued item
        next?.();
    }
}

const imageDelivery = createImageDelivery({
    transform: (src: string, options: any) => getCfTransformUrl(src, options),
    infer: async (src: string) => {
        await acquireInferSizeSlot();
        try { return await inferImageDimensions(() => inferRemoteSize(src)); }
        finally { releaseInferSizeSlot(); }
    },
    optimize: (options: any) => getImage(options),
});

export function getImageSafe(options: any): Promise<any> {
    return imageDelivery.image(options);
}

/** Same responsive WebP candidates are used by the visible hero and its preload. */
export function optimizeResponsiveImage(src: string) {
    return imageDelivery.responsive(wpUrl(normalizeCmsMediaUrl(src)));
}

/** Display-only copy: preserve CMS originals and brochure/download URLs. */
export async function optimizeTourPresentation(tour: WPTour): Promise<WPTour> {
    const source = getTourImageUrl(tour);
    const optimizedHero = source ? await optimizeResponsiveImage(source) : undefined;
    const optimizedPhotos: NonNullable<WPTour['optimizedPhotos']> = {};
    for (const raw of collectTourPhotoSources(tour)) {
        const url = wpUrl(normalizeCmsMediaUrl(raw));
        const [thumbnail, full] = await Promise.all([
            getImageSafe({ src: url, width: 600, height: 450, format: 'webp', quality: 80 }),
            imageDelivery.responsive(url, { widths: [1600], width: 1600 }),
        ]);
        optimizedPhotos[url] = { thumbnail: thumbnail.src, full: full.src, width: full.width, height: full.height };
    }
    const optimizedInlineImages: NonNullable<WPTour['optimizedInlineImages']> = {};
    for (const raw of collectInlineImageSources(tour)) {
        const url = wpUrl(normalizeCmsMediaUrl(raw));
        // Supplier-hosted maps retain their supported external URLs; bundle owned media only.
        if (!/^https:\/\/(?:[^/]+\.)?qualitour\.ca\//.test(url)
            && !url.startsWith(`${CMS_ORIGIN}/`)) continue;
        optimizedInlineImages[url] = await imageDelivery.responsive(url, { widths: [480, 960, 1200], width: 1200 });
    }
    return { ...tour, optimizedHero, optimizedPhotos, optimizedInlineImages };
}

export function optimizeTourPresentations(tours: WPTour[]): Promise<WPTour[]> {
    return mapWithConcurrency(tours, optimizeTourPresentation, 4);
}

/**
 * Optimize a list of tours with a concurrency limit.
 * Addresses build time concerns and server load.
 */
export async function optimizeTourImages(
    tours: WPTour[],
    options: {
        width?: number;
        height?: number;
        concurrency?: number
    } = {}
): Promise<WPTour[]> {
    const { width = 600, height = 450, concurrency = 10 } = options;

    // Create a copy of the tours array to avoid mutating the original
    const results: WPTour[] = tours.map(tour => ({ ...tour }));

    // Process in batches
    for (let i = 0; i < tours.length; i += concurrency) {
        const batch = tours.slice(i, i + concurrency);
        const batchIndex = i;

        await Promise.all(
            batch.map(async (tour, index) => {
                const imageUrl = getTourImageUrl(tour);
                if (!imageUrl) return;

                try {
                    const optimized = await getImageSafe({
                        src: imageUrl,
                        width,
                        height,
                        format: "webp",
                        quality: 80,
                    });
                    results[batchIndex + index].optimizedImageUrl = optimized.src;
                } catch (e) {
                    console.warn(`[Image Optimization] Failed for tour ${tour.id}:`, e);
                    throw new Error(`Tour ${tour.id} display image conversion failed`, { cause: e });
                }
            })
        );

        // Optional: Log progress for long builds
        if (tours.length > 50 && (i + concurrency) % 50 === 0) {
            console.log(`[Image Optimization] Processed ${i + concurrency}/${tours.length} tour images...`);
        }
    }

    return results;
}
/**
 * Deeply optimize all image URLs in an object/array.
 * Handles URLs in string fields and inside HTML content.
 * This is used to process Goodlayers data and other complex fields.
 */
export async function deepOptimizeTourData(tour: WPTour): Promise<WPTour> {
    if (!tour) return tour;

    // Create a deep copy to avoid mutating original
    const processed = JSON.parse(JSON.stringify(tour));

    async function recurse(obj: any): Promise<any> {
        if (!obj) return obj;

        if (typeof obj === "string") {
            // 1. Handle HTML content strings
            if (obj.includes("<img") || obj.includes("src=")) {
                const imgRegex = /src=["']([^"']+)["']/g;
                let match;
                let newValue = obj;
                const replacements: [string, string][] = [];

                while ((match = imgRegex.exec(obj)) !== null) {
                    const originalSrc = match[1];
                    // Skip if already an Astro optimized URL
                    if (originalSrc.startsWith("/_astro/")) continue;

                    const url = wpUrl(normalizeCmsMediaUrl(originalSrc));
                    try {
                        const opt = await getImageSafe({ src: url, width: 1200, format: "webp", inferSize: true });
                        replacements.push([originalSrc, opt.src]);
                    } catch {
                        replacements.push([originalSrc, wpUrl(originalSrc)]);
                    }
                }

                for (const [oldSrc, newSrc] of replacements) {
                    newValue = newValue.split(oldSrc).join(newSrc);
                }
                return newValue;
            }

            // 2. Handle standalone image URLs
            const isProbablyImageUrl = obj.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i) ||
                obj.includes("wp-content/uploads");

            if (isProbablyImageUrl && (obj.startsWith("http") || obj.startsWith("/") || obj.includes(".local"))) {
                // Skip if already an Astro optimized URL
                if (obj.startsWith("/_astro/")) return obj;

                const url = wpUrl(normalizeCmsMediaUrl(obj));
                try {
                    const opt = await getImageSafe({ src: url, width: 1200, format: "webp", inferSize: true });
                    return opt.src;
                } catch {
                    return wpUrl(obj);
                }
            }

            // 3. Fallback: sanitize any local domains
            return wpUrl(obj);
        }

        if (Array.isArray(obj)) {
            // Limit concurrency for array processing to prevent resource exhaustion
            // especially with inferSize: true triggering network requests
            const results = [];
            const BATCH_SIZE = 5;
            for (let i = 0; i < obj.length; i += BATCH_SIZE) {
                const batch = obj.slice(i, i + BATCH_SIZE);
                const batchResults = await Promise.all(batch.map(item => recurse(item)));
                results.push(...batchResults);
            }
            return results;
        }

        if (typeof obj === "object") {
            if (obj instanceof Date) return obj;
            const result: any = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    result[key] = await recurse(obj[key]);
                }
            }
            return result;
        }

        return obj;
    }

    return await recurse(processed);
}

/**
 * Optimize a single image URL.
 */
export async function optimizeImageUrl(url: string, width: number = 1920): Promise<string> {
    if (!url) return "";
    // Skip if already an Astro optimized URL
    if (url.startsWith("/_astro/")) return url;

    const sanitizedUrl = wpUrl(normalizeCmsMediaUrl(url));

    try {
        const optimized = await getImageSafe({ src: sanitizedUrl, width, format: "webp", inferSize: true });
        return optimized.src;
    } catch {
        return sanitizedUrl;
    }
}
