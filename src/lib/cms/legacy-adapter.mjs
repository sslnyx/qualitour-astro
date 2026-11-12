import { createHash } from 'node:crypto';
import { CMS_ORIGIN } from './read-client.mjs';

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
  return typeof url === 'string' && /^(https?:\/\/|\/_emdash\/api\/media\/file\/)/.test(url) ? safeUrl(url) : undefined;
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
export function sortToursByPublishedAt(tours, order = 'desc') {
  return [...tours].sort((a,b)=>(Date.parse(a.date)-Date.parse(b.date)||a.id-b.id)*(order==='asc'?1:-1));
}
function removeGallery(items) {
  return (Array.isArray(items) ? items : []).filter(item => item?.type !== 'gallery').map(item => ({ ...item, ...(item.items ? {items: removeGallery(item.items)} : {}) }));
}

export function buildCatalogue(entries, compat, locale) {
  const source = compat.locales[locale]; if (!source) throw new Error('Missing locale compatibility manifest');
  const seen = new Set(), slugs = new Set(), excluded = [], tours = [];
  for (const entry of entries) {
    if (entry.status !== 'published') throw new Error('Non-published CMS entry');
    if (entry.locale !== locale) throw new Error('CMS locale mismatch');
    if (PROOF_IDS.has(entry.id)) { excluded.push(entry.id); continue; }
    const data = entry.data, key = data?.source_key, original = source.tours[key];
    if (!original || !new RegExp(`^wp-${locale}-[1-9]\\d*$`).test(key)) throw new Error(`Missing public compatibility identity for CMS entry ${entry.id}`);
    if (seen.has(key) || slugs.has(original.tour.slug)) throw new Error('Duplicate CMS source identity or legacy URL');
    seen.add(key); slugs.add(original.tour.slug);
    // Imported entries have this complete projection. Absence means an API or
    // schema mismatch; explicit null/empty values represent an editor's removal.
    for (const field of ['title','summary','price','currency','duration','location','tour_code']) {
      if (!Object.hasOwn(data,field) || data[field] !== null && !['string','number'].includes(typeof data[field])) throw new Error(`Missing or invalid CMS field ${field} for ${key}`);
    }
    for (const field of ['overview','itinerary','itinerary_continued','additional_info','faq','gallery']) {
      if (!Object.hasOwn(data,field) || data[field] !== null && !Array.isArray(data[field])) throw new Error(`Missing or invalid CMS field ${field} for ${key}`);
    }
    const tour = structuredClone(original.tour), baseline = original.baseline;
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
    tour.goodlayers_data.tour_gallery = (data.gallery || []).map(item => { const url=mediaUrl(item?.image); if(!url)throw new Error(`Invalid CMS gallery media for ${key}`);return {url,alt:text(item.alt),caption:text(item.caption)}; });
    tour.tour_terms = Object.fromEntries(termsKeys.map(name=>[name,(tour.tour_terms?.[name] || []).map(term=>({id:term.id,slug:term.slug,name:term.name}))]));
    tours.push(tour);
  }
  if (!tours.length) throw new Error(`Refusing an empty ${locale} CMS catalogue`);
  tours.sort((a,b)=>source.tours[`wp-${locale}-${b.id}`].date.localeCompare(source.tours[`wp-${locale}-${a.id}`].date)||b.id-a.id);
  const terms = Object.fromEntries(termsKeys.map(name=>{
    const counts = new Map();
    for (const tour of tours) for (const term of new Map(tour.tour_terms[name].map(term=>[term.id,term])).values()) counts.set(term.id,(counts.get(term.id)||0)+1);
    // This frozen vocabulary was already public. Keep its existing links and
    // navigation order, including empty categories; only counts use live tours.
    // Never merge unpublished/new CMS taxonomy evidence into this vocabulary.
    return [name,(source.terms[name]||[]).map(term=>({...term,count:counts.get(term.id)||0}))];
  }));
  return {tours,terms,excluded};
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
