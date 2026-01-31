import { getImage } from "astro:assets";
import type { WPTour, WPTourFeaturedImage } from "./types";
import { wpUrl, getCfTransformUrl } from "../wp-url";

/**
 * Extract the best available image URL from a tour object.
 */
function extractUrl(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string" && obj.url.trim()) return obj.url;
    }
    return null;
}

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

async function getImageSafe(options: any) {
    const env = (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}) as any;
    const useCf = env.PUBLIC_CF_IMAGE_TRANSFORM === 'true' || env.PUBLIC_CF_IMAGE_TRANSFORM === true;

    // Extract raw src
    const srcValue = typeof options.src === 'object' ? options.src.src : options.src;

    if (useCf && typeof srcValue === 'string') {
        const { width, height, format, quality } = options;

        // Construct transformation options
        const transformOptions = {
            width: width || (typeof options.src === 'object' ? options.src.width : undefined),
            height: height || (typeof options.src === 'object' ? options.src.height : undefined),
            format: format || 'webp',
            quality: quality || 80
        };

        const transformed = getCfTransformUrl(srcValue, transformOptions);

        // Return object shape expected by callers of getImage
        return { src: transformed };
    }

    // Fallback to Astro's getImage if not using CF or if src is not a string
    if (options.inferSize) {
        await acquireInferSizeSlot();
        try {
            return await getImage(options);
        } finally {
            releaseInferSizeSlot();
        }
    }
    return getImage(options);
}

export function getTourImageUrl(tour: WPTour): string | null {
    const featuredImage = tour.featured_image_url;
    let rawUrl: string | null = null;

    if (typeof featuredImage === "string" && featuredImage.trim()) {
        rawUrl = featuredImage;
    }

    if (!rawUrl && typeof featuredImage === "object" && featuredImage !== null) {
        const img = featuredImage as WPTourFeaturedImage;
        rawUrl =
            extractUrl(img.medium_large) ||
            extractUrl(img.large) ||
            extractUrl(img.medium) ||
            extractUrl(img.full) ||
            extractUrl(img.thumbnail);
    }

    return rawUrl ? wpUrl(rawUrl) : null;
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
    const results: WPTour[] = [...tours];

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
                    results[batchIndex + index].optimizedImageUrl = imageUrl;
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

                    const url = wpUrl(originalSrc);
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

                const url = wpUrl(obj);
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

    const sanitizedUrl = wpUrl(url);

    try {
        const optimized = await getImageSafe({ src: sanitizedUrl, width, format: "webp", inferSize: true });
        return optimized.src;
    } catch {
        return sanitizedUrl;
    }
}
