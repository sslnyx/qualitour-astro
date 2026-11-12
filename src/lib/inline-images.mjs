const imageTags = /<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const attributes = tag => [...tag.replace(/^<img\b/i, '').replace(/\/?\s*>$/, '').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(match => ({name:match[1].toLowerCase(),value:match[2] ?? match[3] ?? match[4],raw:match[0]}));
const sourceAttribute = tag => attributes(tag).find(attr => attr.name === 'src')?.value;
const decodeUrl = value => value.replace(/&amp;/g, '&').replace(/&#0*38;/g, '&');
const escapeAttribute = value => String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');

/** Collect display images from legacy rich text and nested builder items; links remain originals. */
export function collectInlineImageSources(tour) {
  const sources = new Set();
  function walk(value) {
    if (typeof value === 'string') {
      for (const tag of value.match(imageTags) || []) {
        const source = sourceAttribute(tag);
        if (source) sources.add(decodeUrl(source));
      }
    } else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (value.type === 'image' && typeof value.value?.url === 'string') sources.add(value.value.url);
      Object.values(value).forEach(walk);
    }
  }
  [tour.content,tour.excerpt,tour.goodlayers_data].forEach(walk);
  return [...sources].filter(src => /^(https?:\/\/|\/(?!\/))/.test(src));
}

/** Rewrite img tags only. Keep CMS data, captions, hyperlink targets and downloads intact. */
export function renderInlineImages(html, derivatives = {}, normalize = value => value) {
  if (!html) return html;
  return html.replace(imageTags, tag => {
    const source = sourceAttribute(tag);
    const image = source && derivatives[normalize(decodeUrl(source))];
    if (!image) return tag;
    const replaced = new Set(['src','srcset','sizes','width','height','loading','decoding']);
    const clean = '<img' + attributes(tag).filter(attr => !replaced.has(attr.name)).map(attr => ' '+attr.raw).join('');
    const attrs = {src:image.src, ...(image.srcSet ? {srcset:image.srcSet,sizes:image.sizes || '100vw'} : {}), width:image.width,height:image.height,loading:'lazy',decoding:'async'};
    return clean + Object.entries(attrs).filter(([,v])=>v!==undefined).map(([k,v])=>` ${k}="${escapeAttribute(v)}"`).join('') + '>';
  });
}
