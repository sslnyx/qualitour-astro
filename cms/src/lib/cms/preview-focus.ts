export type DayRef = { field: 'itinerary' | 'itinerary_continued'; key: string };
export type PreviewSection = 'hero' | 'overview' | 'itinerary' | 'info' | 'photos' | 'faq' | 'brochure';
export type PreviewRequest = { type: 'qualitour:preview-focus'; requestId: string; entryId: string; locale: 'en' | 'zh'; revision: string; section: PreviewSection; day?: DayRef };
export type PreviewContext = { entryId: string; locale: 'en' | 'zh'; revision: string; days: Array<DayRef | null> };
const sections = new Set(['hero', 'overview', 'itinerary', 'info', 'photos', 'faq', 'brochure']);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512;
export function previewRevision(item: Record<string, unknown>): string | null {
  return identifier(item.draftRevisionId) ? item.draftRevisionId : identifier(item.liveRevisionId) ? item.liveRevisionId : null;
}
export function previewDayRefs(data: Record<string, unknown>): Array<DayRef | null> {
  return (['itinerary', 'itinerary_continued'] as const).flatMap(field => Array.isArray(data[field])
    ? data[field].map(day => record(day) && identifier(day._key) ? { field, key: day._key } : null) : []);
}
export function parsePreviewRequest(value: unknown): PreviewRequest | null {
  if (!record(value) || value.type !== 'qualitour:preview-focus' || !identifier(value.requestId)
    || !identifier(value.entryId) || !identifier(value.revision) || !['en', 'zh'].includes(String(value.locale))
    || !sections.has(String(value.section))) return null;
  if (value.day !== undefined && (!record(value.day) || !['itinerary', 'itinerary_continued'].includes(String(value.day.field)) || !identifier(value.day.key))) return null;
  return value as PreviewRequest;
}
export function matchesPreviewAck(value: unknown, expected: PreviewRequest): boolean {
  if (!record(value) || value.type !== 'qualitour:preview-ready' || value.isPreview !== true) return false;
  const focus = parsePreviewRequest({ ...value, type: 'qualitour:preview-focus' });
  return !!focus && focus.requestId === expected.requestId && focus.entryId === expected.entryId
    && focus.locale === expected.locale && focus.revision === expected.revision && focus.section === expected.section
    && (expected.section !== 'itinerary' || value.dayFound === true)
    && JSON.stringify(focus.day) === JSON.stringify(expected.day);
}
