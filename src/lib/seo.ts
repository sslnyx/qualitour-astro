import type { WPTour } from './wordpress/types';

function safeEncodeSegment(segment: string): string {
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }
  return encodeURIComponent(decoded);
}

function extractPathname(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '/';

  // Absolute URLs and protocol-relative URLs: keep only the pathname so an
  // external host can never leak into a public (canonical) path.
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) || trimmed.startsWith('//')) {
    try {
      const url = trimmed.startsWith('//') ? new URL(`https:${trimmed}`) : new URL(trimmed);
      return url.pathname;
    } catch {
      // Fall through to manual stripping below.
    }
  }

  const cut = trimmed.search(/[?#]/);
  return cut === -1 ? trimmed : trimmed.slice(0, cut);
}

export function normalizePublicPath(input: string): string {
  let pathname = extractPathname(input);

  if (!pathname.startsWith('/')) pathname = `/${pathname}`;

  // Remove trailing slashes (except root), then terminal index/.html suffixes.
  while (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const lower = pathname.toLowerCase();
  if (lower === '/index.html') {
    pathname = '/';
  } else if (lower.endsWith('/index.html')) {
    pathname = pathname.slice(0, -'/index.html'.length) || '/';
  } else if (lower.endsWith('.html')) {
    pathname = pathname.slice(0, -'.html'.length) || '/';
  }

  while (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  const segments = pathname.split('/').filter(Boolean).map(safeEncodeSegment);
  return segments.length ? `/${segments.join('/')}` : '/';
}

export function absolutePublicUrl(origin: string, path: string): string {
  const base = new URL(origin);
  return `${base.origin}${normalizePublicPath(path)}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#(?:x|X)[0-9a-fA-F]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (match, body: string) => {
      if (body.startsWith('#')) {
        const isHex = body[1] === 'x' || body[1] === 'X';
        const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (
          !Number.isFinite(codePoint) ||
          codePoint <= 0 ||
          codePoint > 0x10ffff ||
          (codePoint >= 0xd800 && codePoint <= 0xdfff)
        ) {
          return '\uFFFD';
        }
        return String.fromCodePoint(codePoint);
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    },
  );
}

export function plainText(input: string): string {
  const source = typeof input === 'string' ? input : '';
  const withoutScripts = source
    .replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?(?:<\/style\s*>|$)/gi, ' ');
  const withoutTags = withoutScripts.replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags).replace(/\s+/g, ' ').trim();
}

function limitCodePoints(text: string, limit: number): string {
  return Array.from(text).slice(0, limit).join('');
}

function imageCandidate(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (value && typeof value === 'object') {
    const url = (value as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return undefined;
}

function tourImage(tour: WPTour): string | undefined {
  const featured = tour.featured_image_url;
  if (!featured) return undefined;
  if (typeof featured === 'string') return imageCandidate(featured);
  for (const key of ['full', 'large', 'medium_large', 'medium', 'thumbnail'] as const) {
    const candidate = imageCandidate(featured[key]);
    if (candidate) return candidate;
  }
  return undefined;
}

function firstBuilderText(value: unknown, depth = 0): string {
  if (!value || depth > 16) return '';
  if (Array.isArray(value)) {
    for (const item of value) { const text = firstBuilderText(item, depth + 1); if (text) return text; }
  } else if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    if (typeof item.content === 'string' && plainText(item.content)) return plainText(item.content);
    for (const child of Object.values(item)) { const text = firstBuilderText(child, depth + 1); if (text) return text; }
  }
  return '';
}

export function tourMetadata(tour: WPTour): { title: string; description: string; image?: string } {
  const titleText = plainText(tour.title?.rendered ?? '');
  const title = titleText ? `${titleText} | Qualitour` : 'Qualitour';

  const excerptText = plainText(tour.excerpt?.rendered ?? '');
  const contentText = excerptText ? '' : plainText(tour.content?.rendered ?? '');
  const summary = excerptText || contentText || firstBuilderText(tour.goodlayers_data);
  const points = Array.from(titleText);
  const shortTitle = points.length > 100 ? points.slice(0, 62).join('') + '…' + points.slice(-35).join('') : titleText;
  const price = tour.tour_meta?.['tour-price-text'] || tour.tour_meta?.price;
  const currency = tour.tour_meta?.['tourmaster-tour-currency'];
  const identity = shortTitle + (price && currency ? ` (${price} ${currency})` : '');
  const description = limitCodePoints(identity + (summary && summary !== titleText ? `. ${summary}` : ''), 160);

  const image = tourImage(tour);
  return image ? { title, description, image } : { title, description };
}

export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? '';
  return json
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
