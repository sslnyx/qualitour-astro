// WordPress API Types - Simplified for Astro SSG

export interface WPPost {
    id: number;
    slug: string;
    title: { rendered: string };
    content: { rendered: string };
    excerpt: { rendered: string };
    date: string;
    modified: string;
    featured_media: number;
    featured_image_url?: string;
    categories?: number[];
    tags?: number[];
}

export interface WPPage {
    id: number;
    slug: string;
    title: { rendered: string };
    content: { rendered: string };
    excerpt: { rendered: string };
    date: string;
    modified: string;
    featured_media: number;
    featured_image_url?: string;
}

export interface WPTourFeaturedImage {
    full?: string | { url: string };
    large?: string;
    medium_large?: string; // WordPress default: 768px width
    medium?: string;
    thumbnail?: string;
}

export interface WPTour {
    id: number;
    slug: string;
    title: { rendered: string };
    content?: { rendered: string };
    excerpt: { rendered: string };
    featured_media: number;
    featured_image_url?: string | WPTourFeaturedImage;
    /** Pre-optimized image URL from Astro's getImage() - used for React components */
    optimizedImageUrl?: string | null;
    tour_category?: number[];
    tour_tag?: number[];
    tour_meta?: {
        price?: string;
        duration?: string;
        duration_text?: string;
        difficulty?: string;
        min_group?: string;
        max_group?: string;
        min_people?: string;
        max_people?: string;
        location?: string;
        country?: string;
        ribbon?: string;
        'tour-code'?: string;
        'tour-price-text'?: string;
        'tour-price-discount-text'?: string;
        'tourmaster-tour-discount'?: string;
        'tourmaster-tour-currency'?: string;
        guide_language?: 'en' | 'zh' | 'both';
        show_on_zh_site?: boolean;
        featured?: string | boolean;
        is_featured?: string | boolean;
        brochure?: {
            ID: number;
            id: number;
            title: string;
            filename: string;
            url: string;
            mime_type?: string;
        } | string | false;
    };
    tour_terms?: {
        categories?: { id: number; slug: string; name: string }[];
        tags?: { id: number; slug: string; name: string }[];
        activities?: { id: number; slug: string; name: string }[];
        destinations?: { id: number; slug: string; name: string }[];
        durations?: { id: number; slug: string; name: string }[];
        types?: { id: number; slug: string; name: string }[];
    };
    goodlayers_data?: Record<string, unknown>;
    acf_fields?: Record<string, unknown>;
    translations?: {
        en?: { id: number; slug: string };
        zh?: { id: number; slug: string };
    } | Record<string, never>;
}

export interface WPTourCategory {
    id: number;
    slug: string;
    name: string;
    description?: string;
    parent: number;
    count: number;
    taxonomy: string;
    link?: string;
    translations?: Record<string, string>;
}

export interface WPTourTag {
    id: number;
    slug: string;
    name: string;
    description?: string;
    count: number;
    taxonomy: string;
    link?: string;
    translations?: Record<string, string>;
}

export interface WPTourActivity {
    id: number;
    slug: string;
    name: string;
    description?: string;
    parent: number;
    count: number;
    taxonomy: string;
    link?: string;
    translations?: Record<string, string>;
}

export interface WPTourDestination {
    id: number;
    slug: string;
    name: string;
    description?: string;
    parent: number;
    count: number;
    taxonomy: string;
    link?: string;
    meta?: unknown[];
    acf?: unknown[];
    translations?: Record<string, string>;
}

export interface WPTourDuration {
    id: number;
    slug: string;
    name: string;
    description?: string;
    count: number;
    taxonomy: string;
    link?: string;
    translations?: Record<string, string>;
}

export interface WPTourType {
    id: number;
    slug: string;
    name: string;
    description?: string;
    count: number;
    taxonomy: string;
    link?: string;
    translations?: Record<string, string>;
}

export interface WPApiParams {
    page?: number;
    per_page?: number;
    search?: string;
    slug?: string;
    categories?: number[];
    tags?: number[];
    destinations?: number[];
    _fields?: string;
    _embed?: boolean;
    orderby?: string;
    order?: 'asc' | 'desc';
    lang?: string;
}

export interface GoogleReview {
    author_name: string;
    author_url?: string;
    language: string;
    original_language?: string;
    profile_photo_url?: string;
    rating: number;
    relative_time_description: string;
    text: string;
    time: number;
    translated?: boolean;
    // New fields
    images?: string[];
    local_guide?: boolean;
    reviewer_reviews?: number;
    reviewer_photos?: number;
    source?: 'google' | 'tripadvisor'; // Review source platform
    related_tours?: number | number[]; // Tour IDs associated with this review
}

export interface PlaceDetails {
    name?: string;
    formatted_address?: string;
    rating?: number;
    user_ratings_total?: number;
    reviews?: GoogleReview[];
    url?: string;
    website?: string;
}

