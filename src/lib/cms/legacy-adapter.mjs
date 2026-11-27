import { createHash } from 'node:crypto';
import { CMS_ORIGIN, normalizeCmsMediaUrl } from './read-client.mjs';
import { hideFlaggedContent } from './tour-content-warnings.mjs';
import { claimPublicIdentities, claimsImport, importProblem, tourOwners } from './tour-identity.mjs';

export { claimsImport };

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).filter(key => key !== '_key').sort().map(key => [key, canonical(value[key])])) : value;
export const contentHash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const text = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const escape = value => text(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function safeUrl(value) {
  if (typeof value !== 'string' || !value || /[\\\u0000-\u0020]/.test(value) || value.startsWith('//')) return;
  try { const url = new URL(value, CMS_ORIGIN); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href; } catch { /* Reject invalid URLs. */ }
}
export function mediaUrl(value) {
  const key = value?.meta?.storageKey;
  if (typeof key === 'string' && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key) && !key.split('/').includes('..')) return `${CMS_ORIGIN}/_emdash/api/media/file/${key}`;
  const url = typeof value === 'string' ? value : value?.url;
  return typeof url === 'string' && /^(https?:\/\/|\/_emdash\/api\/media\/file\/)/.test(url)
    ? normalizeCmsMediaUrl(safeUrl(url)) : undefined;
}

/** Pure derived-copy normalization; the frozen compatibility source is never mutated. */
export function normalizeCmsMediaReferences(value, origin = CMS_ORIGIN) {
  if (typeof value === 'string') return normalizeCmsMediaUrl(value, origin);
  if (Array.isArray(value)) return value.map(item => normalizeCmsMediaReferences(item, origin));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(
      ([key, item]) => [key, normalizeCmsMediaReferences(item, origin)],
    ));
  }
  return value;
}

/** Explicit Portable Text renderer: no arbitrary HTML, styles, embeds or attributes. */
export function renderRichText(value) {
  if (!Array.isArray(value)) return '';
  let result = '', list;
  const close = () => { if (list) { result += `</${list}>`; list = undefined; } };
  for (const block of value) {
    if (block?._type !== 'block' || !Array.isArray(block.children) || block.children.some(span=>span?._type!=='span')) throw new Error('Unsupported CMS rich-text block; add an explicit safe renderer before publishing');
    const marks = new Map((Array.isArray(block.markDefs) ? block.markDefs : []).map(mark => [mark._key, mark]));
    const html = block.children.filter(span => span?._type === 'span').map(span => {
      let html = escape(span.text).replace(/\n/g, '<br>');
      for (const mark of Array.isArray(span.marks) ? span.marks : []) {
        const tag = { strong: 'strong', em: 'em', underline: 'u', 'strike-through': 's', code: 'code' }[mark];
        if (tag) html = `<${tag}>${html}</${tag}>`;
        else { const definition = marks.get(mark), href = definition?._type === 'link' && safeUrl(definition.href); if (href) html = `<a href="${escape(href)}" rel="noopener noreferrer">${html}</a>`; }
      }
      return html;
    }).join('');
    const nextList = block.listItem === 'bullet' ? 'ul' : block.listItem === 'number' ? 'ol' : undefined;
    if (nextList !== list) { close(); if (nextList) { list = nextList; result += `<${list}>`; } }
    const tag = nextList ? 'li' : /^h[1-6]$/.test(block.style) ? block.style : block.style === 'blockquote' ? 'blockquote' : 'p';
    result += `<${tag}>${html}</${tag}>`;
  }
  close(); return result;
}

// These two published entries are explicitly named CMS proof fixtures, not customer tours.
const PROOF_IDS = new Set(['01M75S22W89VBB2VD299MVP3TK', '01M75S913P35FB1Z6DP6MHG17G']);
const SECTION_IDS = { overview: ['overview','description','detail','details'], itinerary: ['itinerary'], additional_info: ['info','information','additional-info','additional-information'], faq: ['faq','faqs','faq-section'] };
const termsKeys = ['categories','tags','activities','destinations','durations','types'];
const termAliases = {
  categories: ['categories','category','tour_category'], tags: ['tags','tag','tour_tag'],
  activities: ['activities','activity','tour-activity'], destinations: ['destinations','destination','tour-destination'],
  durations: ['durations','duration','tour_duration'], types: ['types','type','tour_type'],
};
const reservedTourSlugs = new Set(['featured','activity','activities','category','categories','destination','destinations','duration','durations','tag','tags','type','types','style','styles']);
const mediaDimensionsKey = Symbol.for('qualitour:native-media-dimensions');
const compareIds = (a,b) => String(a).localeCompare(String(b), 'en', { numeric: true });
export function sortToursByPublishedAt(tours, order = 'desc') {
  return [...tours].sort((a,b)=>(Date.parse(a.date)-Date.parse(b.date)||compareIds(a.id,b.id))*(order==='asc'?1:-1));
}
function removeGallery(items) {
  return (Array.isArray(items) ? items : []).filter(item => item?.type !== 'gallery').map(item => ({ ...item, ...(item.items ? {items: removeGallery(item.items)} : {}) }));
}

function slugKey(value) {
  try { return decodeURIComponent(value).normalize('NFC').toLocaleLowerCase('en'); } catch { throw new Error('Invalid public tour slug encoding'); }
}
function nativeSlug(value) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\\/?#\u0000-\u0020]/.test(value)) throw new Error('Missing or invalid native public slug');
  const decoded = slugKey(value);
  if (!decoded || decoded === '.' || decoded === '..' || /[\\/?#\u0000-\u0020]/.test(decoded)) throw new Error('Missing or invalid native public slug');
  if (reservedTourSlugs.has(decoded.toLowerCase())) throw new Error(`Native public slug is reserved: ${value}`);
  return value;
}
function recordMediaDimensions(target, url, value) {
  const width=Number(value?.width),height=Number(value?.height);
  if (url && Number.isFinite(width) && width>0 && Number.isFinite(height) && height>0) target[url]={width:Math.round(width),height:Math.round(height)};
}
function attachMediaDimensions(tour, dimensions) {
  if (Object.keys(dimensions).length) Object.defineProperty(tour,mediaDimensionsKey,{value:dimensions,enumerable:false});
}
function termRows(data, bucket, sourceTerms = []) {
  const bySlug = new Map(sourceTerms.map(term => [term.slug, term]));
  const rows = termAliases[bucket].flatMap(name => Array.isArray(data?.terms?.[name]) ? data.terms[name] : []);
  const seen = new Set();
  return rows.map(term => {
    const slug = text(term?.slug).trim(), label = text(term?.label || term?.name).trim();
    if (!slug || !label || seen.has(slug)) return;
    seen.add(slug);
    const legacy = bySlug.get(slug);
    return legacy ? { id: legacy.id, slug: legacy.slug, name: legacy.name } : { id: text(term.id), slug, name: label };
  }).filter(Boolean);
}
function projectedTermRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Invalid projected CMS taxonomy bucket');
  const seen = new Set();
  return rows.map(term => {
    const id = text(term?.id).trim(), slug = text(term?.slug).trim(), name = text(term?.name).trim();
    if (!id || !slug || !name) throw new Error('Invalid projected CMS taxonomy term');
    if (seen.has(slug)) return;
    seen.add(slug);
    const translations = term?.translations && typeof term.translations === 'object'
      ? Object.fromEntries(Object.entries(term.translations).filter(([, value])=>typeof value==='string' && value))
      : undefined;
    return { id, slug, name, ...(translations && Object.keys(translations).length ? {translations} : {}) };
  }).filter(Boolean);
}
function nativeSeo(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const result = {};
  for (const field of ['title','description']) if (typeof value[field] === 'string' && value[field].trim()) result[field] = value[field].trim();
  if (typeof value.canonical === 'string' && value.canonical.trim()) {
    try { const url=new URL(value.canonical.trim());if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error();result.canonical=url.href; }
    catch { throw new Error('Invalid native CMS canonical URL'); }
  }
  // Only an absolute http(s) URL or an owned CMS media path survives; the data layer resolves bare media IDs first.
  if (typeof value.image === 'string') {
    const image = value.image.trim();
    if (/^https?:\/\//i.test(image) || /^\/_emdash\/api\/media\/file\/[A-Za-z0-9][A-Za-z0-9._%\/-]*$/.test(image) && !image.split('/').includes('..')) result.image = image;
  }
  if (value.noIndex === true) result.noIndex = true;
  return Object.keys(result).length ? result : undefined;
}
function nativeTour(entry, source, taxonomyOverride) {
  const data = entry.data || {}, id = text(entry.id).trim(), title = text(data.title).trim();
  if (!id) throw new Error('Native CMS entry is missing its stable ID');
  if (!title) throw new Error(`Missing CMS title for native entry ${id}`);
  const slug = nativeSlug(entry.slug);
  const published = typeof entry.publishedAt === 'string' ? Date.parse(entry.publishedAt) : NaN;
  if (!Number.isFinite(published)) throw new Error(`Missing or invalid CMS publication date for native entry ${id}`);
  const arrays = {};
  for (const field of ['overview','itinerary','itinerary_continued','additional_info','faq','gallery']) {
    const value = data[field] ?? [];
    if (!Array.isArray(value)) throw new Error(`Invalid CMS field ${field} for native entry ${id}`);
    arrays[field] = value;
  }
  for (const field of ['hero','brochure']) if (data[field] && !mediaUrl(data[field])) throw new Error(`Invalid CMS media ${field} for native entry ${id}`);
  const tourMeta = {};
  for (const [field, aliases] of Object.entries({price:['price','price_text','tour-price-text'],currency:['currency','tourmaster-tour-currency'],duration:['duration','duration_text'],location:['location'],tour_code:['tour_code','tour-code'],ribbon:['ribbon']})) {
    for (const alias of aliases) tourMeta[alias] = field === 'currency' ? currencyLabel(data[field]) : text(data[field]);
  }
  tourMeta.currency_code = currencyCode(data.currency);
  const brochure = mediaUrl(data.brochure);
  if (Object.hasOwn(data,'brochure')) tourMeta.brochure = brochure ? { ID:0,id:0,url:brochure,title:text(data.brochure?.filename)||'brochure.pdf',filename:text(data.brochure?.filename)||'brochure.pdf',mime_type:'application/pdf' } : false;
  const days = [...arrays.itinerary, ...arrays.itinerary_continued];
  const sections = arrays.additional_info.length ? [{value:{id:'info'},items:[{type:'text-box',value:{content:renderRichText(arrays.additional_info)}}]}] : [];
  const dimensions={},hero=mediaUrl(data.hero);recordMediaDimensions(dimensions,hero,data.hero);
  const gallery = arrays.gallery.map(item => { const url=mediaUrl(item?.image); if(!url)throw new Error(`Invalid CMS gallery media for native entry ${id}`);recordMediaDimensions(dimensions,url,item.image);return {url,alt:text(item.alt),caption:text(item.caption)}; });
  const tour = {
    id, status:'publish', date:new Date(published).toISOString(), slug,
    title:{rendered:escape(title)}, excerpt:{rendered:escape(data.summary)}, content:{rendered:renderRichText(arrays.overview)}, featured_media:0,
    featured_image_url:hero||'', tour_meta:tourMeta,
    tour_terms:Object.fromEntries(termsKeys.map(name=>[name,termRows(data,name,source.terms?.[name] || [])])),
    goodlayers_data:{sections,tour_itinerary:days.map(item=>({title:text(item.title),content:renderRichText(item.content)})),tour_faq:arrays.faq.map(item=>({title:text(item.title),content:renderRichText(item.content)})),tour_gallery:gallery},
  };
  if (taxonomyOverride) for (const bucket of termsKeys) if (Object.hasOwn(taxonomyOverride, bucket)) {
    tour.tour_terms[bucket] = projectedTermRows(taxonomyOverride[bucket]);
  }
  const seo = nativeSeo(data.seo); if (seo) tour.nativeSeo = seo;
  attachMediaDimensions(tour,dimensions);
  return tour;
}

/** Newest first by the catalogue's own sort key (the original public date for imports), ties by ID. */
export function sortCatalogueTours(tours, sortDates) {
  return tours.sort((a,b)=>String(sortDates.get(b.id)).localeCompare(String(sortDates.get(a.id)))||compareIds(b.id,a.id));
}
/** The site shows a currency only when a tour is priced in USD; no label at all means the default (CAD). */
export const currencyLabel = value => (/^\s*usd\s*$/i.test(String(value ?? '')) ? 'USD' : '');
/** The stored currency (CAD or USD, or empty). Kept for page descriptions, which already tell same-titled tours apart by "(price CAD)". */
export const currencyCode = value => { const code = String(value ?? '').trim().toUpperCase(); return code === 'CAD' || code === 'USD' ? code : ''; };
export function buildCatalogue(entries, compat, locale, { taxonomyOverrides = new Map(), allowEmpty = false, owners = tourOwners } = {}) {
  const source = compat.locales[locale]; if (!source) throw new Error('Missing locale compatibility manifest');
  const entryIds = new Set(), excluded = [], rejected = [], candidates = [];
  const known = key => Object.hasOwn(source.tours, key) && new RegExp(`^wp-${locale}-[1-9]\\d*$`).test(key);
  for (const entry of entries) {
    if (entry.status !== 'published') throw new Error('Non-published CMS entry');
    if (entry.locale !== locale) throw new Error('CMS locale mismatch');
    if (PROOF_IDS.has(entry.id)) { excluded.push(entry.id); continue; }
    // The same row twice means the read itself went wrong, which no single tour can explain.
    if (entryIds.has(entry.id)) throw new Error(`Duplicate published CMS tour ID ${entry.id}`);
    if (entry.id) entryIds.add(entry.id);
    const data = entry.data || {};
    // Decided before any field is read, so whatever else a copy holds cannot affect the other tours.
    const problem = importProblem(entry.id, data, { owners, known });
    if (problem) { rejected.push({ entryId: entry.id, ...problem }); continue; }
    const taxonomyOverride = taxonomyOverrides.get?.(entry.id);
    if (!claimsImport(data)) {
      const tour = nativeTour(entry, source, taxonomyOverride);
      candidates.push({ tour: hideFlaggedContent(tour, data.source_key), claim: { entryId: tour.id, identity: `cms:${entry.id}`, slug: slugKey(tour.slug), imported: false, publishedAt: tour.date, sortDate: tour.date } });
      continue;
    }
    const key = data.source_key, original = source.tours[key];
    const publicSlug = slugKey(original.tour.slug);
    // Imported entries have this complete projection. Absence means an API or
    // schema mismatch; explicit null/empty values represent an editor's removal.
    for (const field of ['title','summary','price','currency','duration','location','tour_code']) {
      if (!Object.hasOwn(data,field) || data[field] !== null && !['string','number'].includes(typeof data[field])) throw new Error(`Missing or invalid CMS field ${field} for ${key}`);
    }
    for (const field of ['overview','itinerary','itinerary_continued','additional_info','faq','gallery']) {
      if (!Object.hasOwn(data,field) || data[field] !== null && !Array.isArray(data[field])) throw new Error(`Missing or invalid CMS field ${field} for ${key}`);
    }
    const tour = normalizeCmsMediaReferences(original.tour), baseline = original.baseline;
    const published = typeof entry.publishedAt === 'string' ? Date.parse(entry.publishedAt) : NaN;
    if (!Number.isFinite(published)) throw new Error(`Missing or invalid CMS publication date for ${key}`);
    tour.date = new Date(published).toISOString();
    const changed = (field, value = data[field] ?? '') => contentHash(value) !== baseline[field];
    tour.status = 'publish'; delete tour.acf_fields; delete tour.optimizedImageUrl;
    tour.tour_meta ||= {}; tour.goodlayers_data ||= {};
    if (changed('title')) tour.title = {rendered: escape(data.title)};
    if (!text(data.title).trim()) throw new Error(`Missing CMS title for ${key}`);
    if (changed('summary')) tour.excerpt = {rendered: escape(data.summary)};
    for (const [field, aliases] of Object.entries({price:['price','price_text','tour-price-text'],currency:['currency','tourmaster-tour-currency'],duration:['duration','duration_text'],location:['location'],tour_code:['tour_code','tour-code']})) {
      if (changed(field)) for (const alias of aliases) tour.tour_meta[alias] = text(data[field]);
    }
    if (Object.hasOwn(baseline,'ribbon') && changed('ribbon')) tour.tour_meta.ribbon = text(data.ribbon);
    tour.tour_meta.currency_code = currencyCode(tour.tour_meta['tourmaster-tour-currency'] ?? tour.tour_meta.currency);
    for (const alias of ['currency','tourmaster-tour-currency']) if (Object.hasOwn(tour.tour_meta,alias)) tour.tour_meta[alias] = currencyLabel(tour.tour_meta[alias]);
    if (changed('price')) for (const alias of ['has_discount','tourmaster-tour-discount','tour-price-discount-text']) delete tour.tour_meta[alias];
    for(const field of ['hero','brochure']) if(data[field] && !mediaUrl(data[field])) throw new Error(`Invalid CMS media ${field} for ${key}`);
    if (Object.hasOwn(data,'hero')) tour.featured_image_url = mediaUrl(data.hero) || '';
    if (Object.hasOwn(data,'brochure')) { const url=mediaUrl(data.brochure); tour.tour_meta.brochure = url ? { ID:0,id:0,url,title:text(data.brochure?.filename)||'brochure.pdf',filename:text(data.brochure?.filename)||'brochure.pdf',mime_type:'application/pdf' } : false; }
    let sections = tour.goodlayers_data.sections || [];
    const days = [...(data.itinerary || []), ...(data.itinerary_continued || [])];
    for (const [field, ids] of Object.entries(SECTION_IDS)) {
      const value = field === 'itinerary' ? days : data[field] || [];
      if (!changed(field, value)) continue;
      sections = sections.filter(section => !ids.includes(section.value?.id || section.id));
      if (field === 'overview') tour.content = {rendered:renderRichText(value)};
      if (field === 'additional_info' && value.length) sections.push({value:{id:'info'},items:[{type:'text-box',value:{content:renderRichText(value)}}]});
      if (field === 'itinerary' || field === 'faq') tour.goodlayers_data[field === 'faq' ? 'tour_faq' : 'tour_itinerary'] = value.map(item=>({title:text(item.title),content:renderRichText(item.content)}));
    }
    // CMS gallery is authoritative; old gallery widgets must not override an editor's removal.
    sections = sections.map(section => ({...section,items:removeGallery(section.items)}));
    tour.goodlayers_data.sections = sections;
    delete tour.goodlayers_data['tourmaster-tour-gallery'];
    const dimensions={};recordMediaDimensions(dimensions,typeof tour.featured_image_url==='string'?tour.featured_image_url:undefined,data.hero);
    tour.goodlayers_data.tour_gallery = (data.gallery || []).map(item => { const url=mediaUrl(item?.image); if(!url)throw new Error(`Invalid CMS gallery media for ${key}`);recordMediaDimensions(dimensions,url,item.image);return {url,alt:text(item.alt),caption:text(item.caption)}; });
    tour.tour_terms = Object.fromEntries(termsKeys.map(name=>{
      const legacy=(tour.tour_terms?.[name] || []).map(term=>({id:term.id,slug:term.slug,name:term.name}));
      return [name,taxonomyOverride && Object.hasOwn(taxonomyOverride,name) ? projectedTermRows(taxonomyOverride[name]) : legacy];
    }));
    const seo=nativeSeo(data.seo);if(seo)tour.nativeSeo=seo;
    const shown=hideFlaggedContent(tour,key);
    attachMediaDimensions(shown,dimensions);
    candidates.push({ tour: shown, claim: { entryId: entry.id, identity: key, slug: publicSlug, imported: true, publishedAt: tour.date, sortDate: original.date } });
  }
  const lost = claimPublicIdentities(candidates.map(candidate => candidate.claim));
  rejected.push(...lost);
  const dropped = new Set(lost.map(row => row.entryId));
  const shownCandidates = candidates.filter(candidate => !dropped.has(candidate.claim.entryId));
  const tours = shownCandidates.map(candidate => candidate.tour);
  const sortDates = new Map(shownCandidates.map(candidate => [candidate.tour.id, candidate.claim.sortDate]));
  // A page of a larger collection may hold only excluded proof fixtures; the caller guards the merged result.
  if (!tours.length && !allowEmpty) throw new Error(`Refusing an empty ${locale} CMS catalogue`);
  sortCatalogueTours(tours,sortDates);
  const terms = Object.fromEntries(termsKeys.map(name=>{
    const counts = new Map();
    for (const tour of tours) for (const term of new Map(tour.tour_terms[name].map(term=>[term.slug,term])).values()) counts.set(term.slug,(counts.get(term.slug)||0)+1);
    // This frozen vocabulary was already public. Keep its existing links and
    // navigation order, including empty categories; only counts use live tours.
    const vocabulary = [...(source.terms[name]||[])];
    const known = new Set(vocabulary.map(term=>term.slug));
    for (const tour of tours) for (const term of tour.tour_terms[name]) if (!known.has(term.slug)) { known.add(term.slug); vocabulary.push({...term,parent:0}); }
    return [name,vocabulary.map(term=>({...term,count:counts.get(term.slug)||0}))];
  }));
  // Not serialized: lets a caller that builds a catalogue in pages re-sort the merged result identically, and
  // settle identities across pages. `claims` is keyed by CMS entry ID; `rejected` lists the tours left out and why.
  const catalogue = {tours,terms,excluded};
  Object.defineProperty(catalogue,'sortDates',{value:sortDates,enumerable:false});
  Object.defineProperty(catalogue,'claims',{value:new Map(shownCandidates.map(candidate=>[candidate.claim.entryId,candidate.claim])),enumerable:false});
  Object.defineProperty(catalogue,'rejected',{value:rejected,enumerable:false});
  return catalogue;
}

/** The imported tour whose old public address this slug would collide with, if any. */
export function importedTourAtSlug(compat, locale, slug) {
  let wanted;
  try { wanted = slugKey(slug); } catch { return; }
  return Object.entries(compat.locales[locale]?.tours || {}).find(([, original]) => slugKey(original.tour.slug) === wanted)?.[0];
}

/** Expose only verified reciprocal relationships whose two tours remain published. */
export function retainPublicTranslations(locales) {
  for (const [locale, catalogue] of Object.entries(locales)) for (const tour of catalogue.tours) {
    const other = locale === 'en' ? 'zh' : 'en'; const target = tour.translations?.[other];
    const translated = target && locales[other]?.tours.find(row=>row.id===target.id && row.slug===target.slug);
    const reciprocal=translated?.translations?.[locale];
    if (!translated || reciprocal?.id!==tour.id || reciprocal?.slug!==tour.slug) delete tour.translations;
  }
}
