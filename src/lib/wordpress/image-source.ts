import type { WPTour, WPTourFeaturedImage } from "./types";
import { wpUrl } from "../wp-url";

function extractUrl(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "object" && value !== null && "url" in value) {
        const obj = value as { url?: string };
        if (typeof obj.url === "string" && obj.url.trim()) return obj.url;
    }
    return null;
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
            extractUrl(img.full) ||
            extractUrl(img.medium_large) ||
            extractUrl(img.large) ||
            extractUrl(img.medium) ||
            extractUrl(img.thumbnail);
    }

    // Fallback: If featured_image_url failed but we have _embedded featured media
    if (!rawUrl && tour._embedded?.['wp:featuredmedia']?.[0]) {
        const media = tour._embedded['wp:featuredmedia'][0];
        // Try to get a large/medium_large size first, fallback to original source
        rawUrl =
            media.media_details?.sizes?.large?.source_url ||
            media.media_details?.sizes?.medium_large?.source_url ||
            media.media_details?.sizes?.full?.source_url ||
            media.source_url;
    }

    return rawUrl ? wpUrl(rawUrl) : null;
}
