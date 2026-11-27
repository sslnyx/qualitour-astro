// Turn one exported WordPress tour into numbered source lines. Later steps move lines by number, so no text is retyped.
import { createHash } from 'node:crypto';
import { parseDocument } from 'htmlparser2';

export const linesHash = lines => createHash('sha256').update(lines.map(line => `${line.origin}\t${line.text}`).join('\n')).digest('hex').slice(0, 16);

const blocks = new Set(['address', 'article', 'aside', 'blockquote', 'br', 'caption', 'dd', 'div', 'dl', 'dt', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'li', 'ol', 'p', 'section', 'table', 'tbody', 'thead', 'tr', 'ul']);
const hidden = new Set(['script', 'style', 'template', 'noscript', 'svg']);
const optionKeys = ['tour-price-text', 'duration-text', 'departure-location', 'return-location', 'minimum-age', 'promo-text'];
const dayPattern = /(^|\b)day\s*\d+|第\s*[0-9一二三四五六七八九十]+\s*[天日]/i;
const clean = text => text.replace(/\s+/g, ' ').trim();

export function htmlLines(html) {
  let out = '';
  const walk = node => {
    if (node.type === 'text') { out += node.data.replace(/\s+/g, ' '); return; }
    if (hidden.has(node.name)) return;
    if (node.name === 'img') { if (node.attribs.src) out += `\n\u0001${node.attribs.src}\n`; return; }
    if (!node.children) { if (blocks.has(node.name)) out += '\n'; return; }
    if (node.name === 'td' || node.name === 'th') {
      const row = node.parent.children.filter(child => child.name === 'td' || child.name === 'th');
      const start = out.length;
      node.children.forEach(walk);
      // A cell may hold several paragraphs; keep the whole row on one line.
      out = out.slice(0, start) + clean(out.slice(start)) + (row.at(-1) === node ? '' : ' | ');
      return;
    }
    if (blocks.has(node.name)) out += '\n';
    node.children.forEach(walk);
    if (blocks.has(node.name)) out += '\n';
  };
  parseDocument(String(html ?? '')).children.forEach(walk);
  return out.split('\n').map(clean).filter(Boolean)
    .map(line => line.startsWith('\u0001') ? { kind: 'image', text: line.slice(1) } : { kind: 'text', text: line });
}

export function sourceLines(record) {
  const lines = [];
  const add = (origin, html, extra = {}) => {
    for (const line of htmlLines(html)) lines.push({ n: lines.length + 1, origin, ...extra, ...line });
  };
  add('post_title', record.post.post_title);
  const option = record.decoded_meta['tourmaster-tour-option']?.[0] || {};
  for (const key of optionKeys) if (typeof option[key] === 'string') add(`option:${key}`, option[key]);

  let day = 0, section = '';
  const image = (origin, id, extra) => { if (/^\d+$/.test(String(id)) && String(id) !== '0') lines.push({ n: lines.length + 1, origin, ...extra, kind: 'image', text: String(id) }); };
  const walk = node => {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (!node || typeof node !== 'object') return;
    if (node.template === 'wrapper') { if (node.value?.id) section = String(node.value.id); walk(node.items || []); return; }
    const value = node.value || {}, type = node.type, at = { section };
    if (['content-navigation', 'tour_title', 'divider', 'space'].includes(type)) return;
    if (type === 'image') { image(type, value.image, at); return; }
    if (type === 'gallery') { for (const item of value.gallery || []) image(type, item.id, at); return; }
    if (Array.isArray(value.tabs)) {
      const days = type !== 'icon-list' && value.tabs.some(tab => dayPattern.test(`${tab['head-text'] ?? ''} ${tab.title ?? ''}`));
      for (const tab of value.tabs) {
        const tag = days ? ++day : undefined;
        for (const [key, part] of [['head-text', 'label'], ['title', 'title'], ['content', 'text']]) {
          add(type, tab[key], { ...at, ...(tag ? { day: tag, part } : {}) });
        }
      }
      return;
    }
    for (const key of ['title', 'caption', 'content', 'author']) if (typeof value[key] === 'string') add(type, value[key], at);
  };
  walk(record.decoded_meta['gdlr-core-page-builder']?.[0] || []);
  return lines;
}
