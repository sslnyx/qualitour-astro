import { escapeHTML, toHTML } from '@portabletext/to-html';
import type { WPTour } from '../wordpress/types';

/** Transitional boundary: existing staging components do not depend on the CMS API. */
export interface CmsTourEntry {
  id: string;
  slug?: string | null;
  locale?: string;
  data: Record<string, unknown>;
}

function text(value: unknown): string { return typeof value === 'string' ? value : ''; }

/** Astro collection IDs include a locale prefix; the database ID stays stable. */
export function cmsTourHref(entry: CmsTourEntry, locale: 'en' | 'zh'): string {
  const id = text(entry.data.id) || text(entry.slug) || entry.id.replace(new RegExp(`^${locale}/`), '');
  return `${locale === 'zh' ? '/zh' : ''}/cms-proof/tours/${encodeURIComponent(id)}`;
}

function mediaUrl(value: unknown): string | undefined {
	const media = value && typeof value === 'object' ? value as { url?: unknown; meta?: { storageKey?: unknown } } : undefined;
	const storageKey = text(media?.meta?.storageKey);
	const derived = storageKey && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(storageKey)
		&& !storageKey.split('/').includes('..') ? `/_emdash/api/media/file/${storageKey}` : '';
	const url = typeof value === 'string' ? value : text(media?.url) || derived;
  if (!url || /[\\\u0000-\u0020]/.test(url) || url.startsWith('//')) return;
  if (url.startsWith('/')) return url;
  try { if (['http:', 'https:'].includes(new URL(url).protocol)) return url; } catch { /* Invalid URL. */ }
}

function richText(value: unknown): string {
	if (!Array.isArray(value)) return '';
	// The legacy component accepts HTML, so only adapt ordinary Portable Text
	// blocks. EmDash HTML embeds, images and unknown custom blocks need an
	// explicit renderer rather than being passed through at this boundary.
	const blocks = value.filter(block => block && typeof block === 'object'
		&& (block as { _type?: unknown })._type === 'block'
		&& Array.isArray((block as { children?: unknown }).children));
	try { return toHTML(blocks, { onMissingComponent: false }); } catch { return ''; }
}

export function toLegacyTour(entry: CmsTourEntry): WPTour {
  const d = entry.data;
  const brochure = mediaUrl(d.brochure);
	const brochureData = d.brochure && typeof d.brochure === 'object' ? d.brochure as Record<string, unknown> : undefined;
	const brochureFilename = text(brochureData?.filename) || 'brochure.pdf';
	const brochureMime = text(brochureData?.mimeType) || text(brochureData?.mime_type) || 'application/pdf';
  const days = [...(Array.isArray(d.itinerary) ? d.itinerary : []), ...(Array.isArray(d.itinerary_continued) ? d.itinerary_continued : [])];
  const gallery = Array.isArray(d.gallery) ? d.gallery : [];
  const faq = Array.isArray(d.faq) ? d.faq : [];
  const additional = richText(d.additional_info);
  return {
    // The proof does not submit legacy enquiry forms or invent a WordPress record ID.
    id: 0,
    slug: entry.slug || entry.id,
    title: { rendered: escapeHTML(text(d.title)) },
    content: { rendered: richText(d.overview) },
    excerpt: { rendered: escapeHTML(text(d.summary)) },
    featured_media: 0,
    featured_image_url: mediaUrl(d.hero),
    tour_meta: {
      tour_code: text(d.tour_code), price: text(d.price), duration: text(d.duration),
      'tourmaster-tour-currency': text(d.currency), location: text(d.location),
			...(brochure ? { brochure: { ID: 0, id: 0, url: brochure, title: brochureFilename, filename: brochureFilename, mime_type: brochureMime } } : {}),
    },
    goodlayers_data: {
      tour_itinerary: days.map(day => ({ title: text(day.title), content: richText(day.content) })),
      tour_gallery: gallery.flatMap(item => {
        const url = mediaUrl(item?.image);
        return url ? [{ url, alt: text(item.alt), caption: text(item.caption) }] : [];
      }),
      tour_faq: faq.map(item => ({ title: text(item.title), content: richText(item.content) })),
      sections: additional ? [{ value: { id: 'info' }, items: [{ type: 'text-box', value: { content: additional } }] }] : [],
    },
  };
}
