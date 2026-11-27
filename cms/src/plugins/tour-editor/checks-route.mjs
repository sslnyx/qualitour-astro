// Server side of the editor reminders: build the draft exactly as the public page would, then check it.
// The draft comes from the editor, so unsaved edits count and no content is read from the database.
import { buildCatalogue } from '../../../../src/lib/cms/legacy-adapter.mjs';
import { tourChecks } from '../../../../src/lib/cms/tour-checks.mjs';

// An imported tour must carry every one of these, even when empty.
const text = ['title', 'summary', 'price', 'currency', 'duration', 'location', 'tour_code'];
const lists = ['overview', 'itinerary', 'itinerary_continued', 'additional_info', 'faq', 'gallery'];
const unavailable = () => ({ ok: false, checks: [] });

export function checkDraft(input, compatibility, today) {
  const { id, locale, slug, publishedAt, data } = input || {};
  if (typeof id !== 'string' || !id || !['en', 'zh'].includes(locale) || !data || typeof data !== 'object' || Array.isArray(data)) return unavailable();
  const complete = { ...Object.fromEntries([...text, ...lists].map(field => [field, null])), ...structuredClone(data) };
  try {
    const entry = { id, locale, slug: slug || 'draft-preview', status: 'published', publishedAt: publishedAt || `${today}T00:00:00Z`, data: complete };
    const [tour] = buildCatalogue([entry], compatibility, locale, { allowEmpty: true }).tours;
    return { ok: true, checks: tour ? tourChecks(tour, data, today) : [] };
  } catch {
    return unavailable();
  }
}
