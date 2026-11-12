import { htmlToPortableText } from '@emdash-cms/gutenberg-to-portable-text';

const OVERVIEW_SECTIONS = new Set(['overview', 'details', 'detail', 'description']);
const INFO_SECTIONS = new Set(['info', 'information', 'info-section', 'additional-info', 'additional-information']);
const FAQ_SECTIONS = new Set(['faq', 'faqs', 'faq-section']);

function parseJsonish(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !['[', '{'].includes(trimmed[0])) return value;
  try { return JSON.parse(trimmed); } catch { return value; }
}

function firstMeta(meta, key) {
  const value = meta?.[key];
  if (!Array.isArray(value)) return parseJsonish(value);
  return parseJsonish(value[0]);
}

function builderValue(meta) {
  const raw = meta?.['gdlr-core-page-builder'];
  if (!Array.isArray(raw)) return parseJsonish(raw);
  if (raw.length === 1 && (Array.isArray(raw[0]) || typeof raw[0] === 'object')) return parseJsonish(raw[0]);
  if (raw.every(item => item && typeof item === 'object' && ('items' in item || 'value' in item))) return raw;
  return parseJsonish(raw[0]);
}

function builderSections(builder) {
  const parsed = parseJsonish(builder);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.sections)) return parsed.sections;
  return [];
}

function normalizeSectionId(section) {
  return String(section?.value?.id ?? section?.id ?? '')
    .trim().toLowerCase().replaceAll('_', '-').replaceAll(' ', '-');
}

function walkItems(items, visit) {
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || typeof item !== 'object') continue;
    visit(item);
    for (const container of [item.items, item.columns, item.children, item.value?.items, item.value?.columns, item.value?.children]) {
      walkItems(container, visit);
    }
  }
}

function sanitizeHtml(value, stats) {
  return String(value ?? '').replace(
    /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>|<(script|style|iframe|object|embed)\b[^>]*\/?\s*>/gi,
    () => {
      stats.unsafeHtml += 1;
      return '';
    },
  );
}

function createStats(seed) {
  let keyCounter = 0;
  const safeSeed = String(seed ?? 'unknown').replace(/[^a-zA-Z0-9_-]+/g, '-');
  return {
    unsafeHtml: 0,
    omittedPortableText: 0,
    flattenedTables: 0,
    conversionFailures: 0,
    inlineGalleryUrls: [],
    keyGenerator: () => `archived-${safeSeed}-pt-${++keyCounter}`,
  };
}

function textParagraph(text, stats) {
  return {
    _type: 'block',
    _key: stats.keyGenerator(),
    style: 'normal',
    children: [{ _type: 'span', _key: stats.keyGenerator(), text }],
  };
}

function convertHtml(value, stats) {
  const html = sanitizeHtml(value, stats);
  if (!html.trim()) return [];
  try {
    const converted = htmlToPortableText(html, { keyGenerator: stats.keyGenerator });
    const supported = [];
    for (const block of converted) {
      if (block?._type === 'block' && Array.isArray(block.children)) {
        supported.push(block);
      } else if (block?._type === 'table' && Array.isArray(block.rows)) {
        stats.flattenedTables += 1;
        for (const row of block.rows) {
          const text = (row?.cells || []).map(cell => (cell?.content || [])
            .map(span => typeof span?.text === 'string' ? span.text : '').join('').trim())
            .filter(Boolean).join(' | ');
          if (text) supported.push(textParagraph(text, stats));
        }
      } else if (block?._type === 'image') {
        const url = block.asset?.url || block.asset?._ref;
        if (isUrl(url)) stats.inlineGalleryUrls.push(url.trim());
        const caption = plainText(block.caption || block.alt || '');
        if (caption) supported.push(textParagraph(caption, stats));
      } else {
        stats.omittedPortableText += 1;
      }
    }
    return supported;
  } catch {
    stats.conversionFailures += 1;
    return [];
  }
}

function plainText(value) {
  const text = String(value ?? '');
  if (!text.trim()) return '';
  const stats = createStats('plain-text');
  const html = /<[^>]+>/.test(text) ? text : `<p>${text}</p>`;
  return convertHtml(html, stats)
    .flatMap(block => block.children.map(child => typeof child?.text === 'string' ? child.text : ''))
    .join('').trim();
}

function textualFragments(section) {
  const fragments = [];
  walkItems(section?.items, item => {
    const type = String(item.type || '').toLowerCase();
    const value = item.value || {};
    if (type === 'text-box') {
      if (value.title) fragments.push(value.title);
      if (value.content) fragments.push(value.content);
    } else if (type === 'title') {
      const title = value.title ?? value.text ?? value.content;
      if (title) fragments.push(title);
    } else if (type === 'icon-list') {
      for (const tab of Array.isArray(value.tabs) ? value.tabs : []) {
        if (tab?.title) fragments.push(tab.title);
        if (tab?.caption) fragments.push(tab.caption);
        if (tab?.content) fragments.push(tab.content);
      }
    }
  });
  return fragments;
}

function tabsInSections(sections, acceptedIds) {
  const tabs = [];
  for (const section of sections) {
    if (!acceptedIds.has(normalizeSectionId(section))) continue;
    walkItems(section.items, item => {
      if (!['toggle-box', 'accordion'].includes(String(item.type || '').toLowerCase())) return;
      if (Array.isArray(item.value?.tabs)) tabs.push(...item.value.tabs);
    });
  }
  return tabs;
}

function mappedBlocks(tabs, kind, sourceId, stats) {
  return tabs.map((tab, index) => {
    const prefix = plainText(tab?.['head-text'] ?? tab?.head_text ?? '');
    const label = plainText(tab?.title ?? '');
    const title = prefix && label && prefix !== label
      ? `${prefix} — ${label}`
      : prefix || label || (kind === 'day' ? `Day ${index + 1}` : '');
    return {
      _type: 'day',
      _version: 1,
      _key: `archived-${sourceId}-${kind}-${index + 1}`,
      title,
      content: convertHtml(tab?.content ?? tab?.description ?? '', stats),
    };
  });
}

function isUrl(value) {
  return typeof value === 'string' && /^(?:https?:)?\/\/|^\//i.test(value.trim());
}

function addMediaValue(value, ids, urls) {
  const parsed = parseJsonish(value);
  if (Array.isArray(parsed)) {
    for (const item of parsed) addMediaValue(item, ids, urls);
    return;
  }
  if (parsed && typeof parsed === 'object') {
    for (const key of ['id', 'image', 'thumbnail', 'url', 'gallery', 'images']) {
      if (key in parsed) addMediaValue(parsed[key], ids, urls);
    }
    return;
  }
  if (typeof parsed === 'number' && Number.isInteger(parsed) && parsed >= 0) {
    ids.push(String(parsed));
    return;
  }
  if (typeof parsed !== 'string') return;
  const trimmed = parsed.trim();
  if (!trimmed) return;
  if (isUrl(trimmed)) {
    urls.push(trimmed);
    return;
  }
  if (trimmed.includes(',')) {
    for (const part of trimmed.split(',')) addMediaValue(part, ids, urls);
    return;
  }
  if (/^\d+$/.test(trimmed)) ids.push(trimmed);
}

function galleryMedia(sections, rawGallery) {
  const ids = [];
  const urls = [];
  for (const section of sections) {
    walkItems(section.items, item => {
      if (!['gallery', 'image'].includes(String(item.type || '').toLowerCase())) return;
      addMediaValue(item.value, ids, urls);
    });
  }
  addMediaValue(rawGallery, ids, urls);
  return { galleryIds: [...new Set(ids)], galleryUrls: [...new Set(urls)] };
}

function firstUrl(value) {
  const parsed = parseJsonish(value);
  if (isUrl(parsed)) return parsed.trim();
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const url = firstUrl(item);
      if (url) return url;
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const key of ['url', 'file', 'brochure']) {
      const url = firstUrl(parsed[key]);
      if (url) return url;
    }
  }
  return '';
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null);
}

function firstNonBlank(...values) {
  return values.find(value => typeof value === 'string' && value.trim()) || '';
}

export function mapArchivedTour(record, snapshot, locale) {
  void locale;
  const post = record?.post || {};
  const meta = record?.decoded_meta || {};
  const option = firstMeta(meta, 'tourmaster-tour-option');
  const options = option && typeof option === 'object' && !Array.isArray(option) ? option : {};
  const warnings = [];
  const sourceId = String(post.ID ?? snapshot?.id ?? 'unknown');
  const stats = createStats(sourceId);

  if (snapshot?.id !== undefined && post.ID !== undefined && String(snapshot.id) !== String(post.ID)) {
    warnings.push({ code: 'source_mismatch', field: 'id', record: String(post.ID), snapshot: String(snapshot.id) });
  }

  const snapshotSections = builderSections(snapshot?.goodlayers_data?.sections);
  const rawBuilder = builderValue(meta);
  const rawSections = builderSections(rawBuilder);
  const sections = snapshotSections.length ? snapshotSections : rawSections;
  const tourMeta = snapshot?.tour_meta || {};

  const rawTitle = snapshot?.title?.rendered ?? post.post_title ?? '';
  const title = plainText(rawTitle) || `(Untitled source ${sourceId})`;
  const summary = plainText(snapshot?.excerpt?.rendered ?? post.post_excerpt ?? '');
  const price = String(firstDefined(
    tourMeta.price_text,
    tourMeta.price,
    options['tour-price-text'],
    firstMeta(meta, 'tourmaster-tour-price'),
    '',
  ));
  const currency = String(firstDefined(
    tourMeta.currency,
    tourMeta['tourmaster-tour-currency'],
    options['tourmaster-tour-currency'],
    options['tour-currency'],
    firstMeta(meta, 'tourmaster-tour-currency'),
    '',
  ));
  const duration = String(firstDefined(
    tourMeta.duration_text,
    options['duration-text'],
    firstMeta(meta, 'duration-text'),
    '',
  ));
  const departure = String(firstDefined(
    tourMeta.departure_location,
    options['departure-location'],
    firstMeta(meta, 'departure-location'),
    '',
  ));
  const destination = String(firstDefined(
    tourMeta.destination_location,
    options['destination-location'],
    firstMeta(meta, 'destination-location'),
    '',
  ));
  const location = departure && destination ? `${departure} → ${destination}` : departure || destination;

  const postContent = snapshot?.content?.rendered ?? post.post_content ?? '';
  const overviewFragments = postContent ? [postContent] : [];
  const additionalFragments = [];
  for (const section of sections) {
    const id = normalizeSectionId(section);
    if (OVERVIEW_SECTIONS.has(id)) overviewFragments.push(...textualFragments(section));
    if (INFO_SECTIONS.has(id)) additionalFragments.push(...textualFragments(section));
  }
  const overview = overviewFragments.flatMap(fragment => convertHtml(fragment, stats));
  const additional_info = additionalFragments.flatMap(fragment => convertHtml(fragment, stats));

  let itineraryTabs = tabsInSections(sections, new Set(['itinerary']));
  if (!itineraryTabs.length) {
    const fallback = snapshot?.goodlayers_data?.tour_itinerary ?? parseJsonish(rawBuilder)?.tour_itinerary;
    if (Array.isArray(fallback)) itineraryTabs = fallback;
  }
  if (itineraryTabs.length > 366) {
    throw new Error(`${itineraryTabs.length} itinerary days exceeds the 366-day cap`);
  }
  const itinerary = mappedBlocks(itineraryTabs, 'day', sourceId, stats);
  const faq = mappedBlocks(tabsInSections(sections, FAQ_SECTIONS), 'faq', sourceId, stats);

  const heroId = firstDefined(firstMeta(meta, '_thumbnail_id'), '');
  const heroUrl = typeof snapshot?.featured_image_url === 'string'
    ? snapshot.featured_image_url
    : snapshot?.featured_image_url?.full?.url || '';
  const brochureUrl = firstNonBlank(
    snapshot?.tour_meta?.brochure?.url,
    firstUrl(options.brochure),
    firstUrl(options['tour-brochure']),
    firstUrl(firstMeta(meta, 'tourmaster-tour-brochure')),
    firstUrl(firstMeta(meta, 'tour-brochure')),
    firstUrl(firstMeta(meta, 'brochure')),
    '',
  );
  const gallery = galleryMedia(sections, firstMeta(meta, 'tourmaster-tour-gallery'));
  gallery.galleryUrls = [...new Set([...gallery.galleryUrls, ...stats.inlineGalleryUrls])];

  if (stats.unsafeHtml) warnings.push({ code: 'unsafe_html_removed', count: stats.unsafeHtml });
  if (stats.flattenedTables) warnings.push({ code: 'table_format_flattened', count: stats.flattenedTables });
  if (stats.omittedPortableText) warnings.push({ code: 'omitted_unsupported_portable_text', count: stats.omittedPortableText });
  if (stats.conversionFailures) warnings.push({ code: 'rich_text_conversion_failed', count: stats.conversionFailures });

  return {
    data: { title, summary, price, currency, duration, location, overview, itinerary, additional_info, faq },
    media: {
      heroId: heroId === '' ? '' : String(heroId),
      heroUrl,
      brochureUrl: String(brochureUrl || ''),
      ...gallery,
    },
    warnings,
  };
}
