/**
 * Contact Form 7 REST API Integration for Astro
 * 
 * Submits form data to WordPress Contact Form 7 via REST API.
 * 
 * Form IDs:
 * - Contact Form: 1979
 * - Tour Inquiry Form: 39288
 * - China Visa Inquiry Form: 39289
 */

export const CF7_FORM_IDS = {
    CONTACT: '1979',
    TOUR_INQUIRY: '39288',
    VISA_INQUIRY: '39289',
} as const;

export type CF7FormId = typeof CF7_FORM_IDS[keyof typeof CF7_FORM_IDS];

export interface CF7Response {
    status: 'mail_sent' | 'mail_failed' | 'validation_failed' | 'acceptance_missing' | 'spam' | 'aborted';
    message: string;
    invalid_fields?: Array<{
        field: string;
        message: string;
    }>;
}

/**
 * Get WordPress origin URL
 * In Astro, we submit directly to WordPress since we're a static site
 */
function getWordPressOrigin(): string {
    const apiUrl = import.meta.env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||
        import.meta.env.PUBLIC_WORDPRESS_API_URL ||
        import.meta.env.WORDPRESS_API_URL;

    if (apiUrl) {
        try {
            const parsed = new URL(apiUrl);
            return parsed.origin;
        } catch {
            // fallback
        }
    }

    // Development fallback - only use in DEV mode
    if (import.meta.env.DEV) {
        return 'http://qualitour.local';
    }

    // Final production fallback
    return 'https://qualitour.ca';
}

/**
 * Submit a form to Contact Form 7 REST API directly
 * 
 * @param formId - The CF7 form ID
 * @param formData - Form field data as key-value pairs
 * @returns CF7Response with status and message
 */
export async function submitCF7Form(
    formId: CF7FormId,
    formData: Record<string, string>
): Promise<CF7Response> {
    const wpOrigin = getWordPressOrigin();
    const endpoint = `${wpOrigin}/wp-json/contact-form-7/v1/contact-forms/${formId}/feedback`;

    // CF7 expects FormData, not JSON
    const body = new FormData();

    // Required CF7 internal fields
    body.append('_wpcf7', formId);
    body.append('_wpcf7_version', '6.0');
    body.append('_wpcf7_locale', 'en_US');
    body.append('_wpcf7_unit_tag', `wpcf7-f${formId}-o1`);
    body.append('_wpcf7_container_post', '0');

    // Add user form data
    for (const [key, value] of Object.entries(formData)) {
        body.append(key, value);
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body,
        });

        if (!response.ok) {
            console.error(`CF7 API Error: ${response.status} ${response.statusText}`);
            return {
                status: 'mail_failed',
                message: 'Failed to submit form. Please try again later.',
            };
        }

        const result: CF7Response = await response.json();
        return result;
    } catch (error) {
        console.error('CF7 Submission Error:', error);
        return {
            status: 'mail_failed',
            message: 'Network error. Please check your connection and try again.',
        };
    }
}

// ============================================
// Typed form submission helpers
// ============================================

export interface ContactFormData {
    name: string;
    email: string;
    subject: string;
    message: string;
}

export interface TourInquiryFormData {
    tourId: string;
    tourCode?: string;
    tourTitle: string;
    name: string;
    email: string;
    phone: string;
    travelDate: string;
    numTravelers: number;
    message?: string;
}

export interface VisaInquiryFormData {
    name: string;
    email: string;
    phone: string;
    destination: string;
    nationality: string;
    visaType: string;
    travelDate?: string;
    message?: string;
}

/**
 * Submit the general contact form
 */
export async function submitContactForm(data: ContactFormData): Promise<CF7Response> {
    return submitCF7Form(CF7_FORM_IDS.CONTACT, {
        'your-name': data.name,
        'your-email': data.email,
        'your-subject': data.subject,
        'your-message': data.message,
    });
}

/**
 * Submit a tour inquiry form
 */
export async function submitTourInquiryForm(data: TourInquiryFormData): Promise<CF7Response> {
    const subject = data.tourCode
        ? `Tour Inquiry: ${data.tourCode} - ${data.tourTitle}`
        : `Tour Inquiry: ${data.tourTitle}`;

    return submitCF7Form(CF7_FORM_IDS.TOUR_INQUIRY, {
        'tour-id': data.tourId,
        'tour-code': data.tourCode || '',
        'tour-title': data.tourTitle,
        'your-subject': subject,
        'your-name': data.name,
        'your-email': data.email,
        'your-phone': data.phone,
        'travel-date': data.travelDate,
        'num-travelers': String(data.numTravelers),
        'your-message': data.message || '',
    });
}

/**
 * Submit a visa inquiry form
 */
export async function submitVisaInquiryForm(data: VisaInquiryFormData): Promise<CF7Response> {
    const subject = `Visa Inquiry: ${data.destination} - ${data.name}`;

    return submitCF7Form(CF7_FORM_IDS.VISA_INQUIRY, {
        'your-subject': subject,
        'your-name': data.name,
        'your-email': data.email,
        'your-phone': data.phone,
        'destination': data.destination,
        'nationality': data.nationality,
        'visa-type': data.visaType,
        'travel-date': data.travelDate || '',
        'your-message': data.message || '',
    });
}
