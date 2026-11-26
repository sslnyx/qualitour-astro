// Content known to be on the wrong tour. The site hides it; the tour editor tells staff why. Rules live in the data file.
import published from '../../data/tour-content-warnings.json' with { type: 'json' };

const decoded = value => { try { return decodeURIComponent(value); } catch { return value; } };
const matches = (value, tokens) => typeof value === 'string' && tokens.some(token => decoded(value).includes(token));
const rulesFor = (sourceKey, rules) => (typeof sourceKey === 'string' ? rules.filter(rule => rule.tours.includes(sourceKey)) : []);

function without(value, tokens) {
  if (typeof value === 'string') {
    return value.includes('<img') ? value.replace(/<img\b[^>]*>/gi, tag => (matches(/\ssrc=["']([^"']*)["']/i.exec(tag)?.[1] ?? '', tokens) ? '' : tag)) : value;
  }
  if (Array.isArray(value)) return value.filter(item => !(item?.type === 'image' && matches(item.value?.url, tokens)) && !matches(item?.url, tokens)).map(item => without(item, tokens));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, without(item, tokens)]));
  return value;
}

/** A copy of the tour without the flagged pictures; the same object when no rule names this tour. */
export function hideFlaggedContent(tour, sourceKey, rules = published.warnings) {
  const tokens = rulesFor(sourceKey, rules).flatMap(rule => rule.hide);
  if (!tokens.length) return tour;
  const result = { ...tour };
  for (const key of ['content', 'goodlayers_data']) if (result[key] !== undefined) result[key] = without(result[key], tokens);
  if (matches(result.featured_image_url, tokens)) result.featured_image_url = '';
  return result;
}

/** What the tour editor should show, with the number of flagged pictures still saved in this tour's CMS gallery. */
export function tourWarnings(data, rules = published.warnings) {
  return rulesFor(data?.source_key, rules).map(rule => ({
    id: rule.id, title: rule.title, message: rule.message, action: rule.action,
    inGallery: (Array.isArray(data.gallery) ? data.gallery : []).filter(item => [item?.image?.meta?.storageKey, item?.image?.url, item?.image?.id].some(value => matches(value, rule.hide))).length,
  }));
}
