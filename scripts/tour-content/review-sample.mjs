// What a person checks in the converter's gate review: which tours, which lines, and which lines deserve a second look.
import { createHash } from 'node:crypto';
import { departureDates } from './check-tour.mjs';

/** Seeded shuffle by hashing, so the order of the input never changes the sample. */
export function pickReviewSample(candidates, { seed, quotas, exclude = [], perFamily = Infinity }) {
  const inFamily = new Map();
  const tuned = new Set(exclude.map(item => item.key));
  const seen = new Set(exclude.map(item => item.signature));
  const rank = item => createHash('sha256').update(`${seed}:${item.key}`).digest('hex');
  const ordered = candidates.filter(item => !tuned.has(item.key)).map(item => [rank(item), item]).sort(([a], [b]) => a.localeCompare(b));
  const left = { ...quotas }, picked = [];
  for (const [, item] of ordered) {
    const count = item.family ? inFamily.get(item.family) || 0 : 0;
    if (!(left[item.stratum] > 0) || seen.has(item.signature) || count >= perFamily) continue;
    if (item.family) inFamily.set(item.family, count + 1);
    seen.add(item.signature); left[item.stratum]--; picked.push(item);
  }
  return picked.sort((a, b) => Object.keys(quotas).indexOf(a.stratum) - Object.keys(quotas).indexOf(b.stratum) || a.key.localeCompare(b.key, 'en', { numeric: true }));
}

/** One row per placed line, in source order. Day-by-day lines are placed by the source itself and are left out. */
export function fieldEntries(doc) {
  const rows = [];
  const add = (field, entries, extra = () => ({})) => entries.forEach(entry => rows.push({ n: entry.n, field, text: entry.text, ...extra(entry) }));
  for (const table of doc.priceTables) {
    if (table.nameN) rows.push({ n: table.nameN, field: 'price', text: table.name, note: '價目分組名稱' });
    add('price', table.rows.map(row => ({ n: row.n, text: `${row.label}　→　${row.amount}` })), () => (table.name ? { note: table.name } : {}));
  }
  for (const field of ['priceNotes', 'requiredFees', 'departureRules', 'included', 'excluded', 'pickup', 'highlights', 'intro', 'facts', 'itineraryNotes']) add(field, doc[field]);
  add('departureDates', doc.departureDates, entry => (entry.status ? { note: `狀態：${entry.status}` } : {}));
  for (const group of doc.optionalGroups) {
    if (group.nameN) rows.push({ n: group.nameN, field: 'optional', text: group.name, note: '自費分組名稱' });
    add('optional', group.items, entry => (entry.limit ? { note: `參加限制（待確認）：${entry.limit}` } : {}));
  }
  for (const term of doc.terms) add(`term.${term.kind}`, term.lines);
  for (const entry of doc.faq) add('faq', [entry.question, ...entry.answer]);
  for (const block of doc.supplements) add('supplement', block.lines, () => ({ note: block.heading ? `小標題：${block.heading}` : block.reason }));
  add('heading', doc.headings);
  return rows.sort((a, b) => a.n - b.n);
}

const priceFields = ['price', 'priceNotes', 'requiredFees', 'included', 'excluded', 'optional'];
const termFields = field => field.startsWith('term.');
const checks = [
  ['有金額，但不在價目或費用欄', entry => !priceFields.includes(entry.field) && !termFields(entry.field) && !['pickup', 'faq', 'departureDates', 'heading'].includes(entry.field)
    && /(?:\$|CAD|USD|加幣|美金)\s?\d/i.test(entry.text)],
  ['提到取消或退款，但不在取消條款', entry => !['term.cancel', 'term.paymentAndCancel', 'heading', 'faq'].includes(entry.field) && /取消條款|取消手續費|退款|不可退|不退|\brefund|cancellation (?:policy|fee)/i.test(entry.text)],
  ['有出發日期，但不在日期欄', entry => !['departureDates', 'departureRules', 'optional', 'heading', 'faq'].includes(entry.field) && !termFields(entry.field)
    && departureDates(entry.text).length > 0 && /出發|啟航|抵達|depart|sailing/i.test(entry.text)],
  ['放在「費用包含」，但寫著另付或不包', entry => entry.field === 'included' && /不含|不包|另付|另收|自費|not included|extra (?:charge|cost)|surcharge/i.test(entry.text) && !/除外|\bexcept\b/i.test(entry.text)],
  ['放在「費用不包含」，但寫著已包含', entry => entry.field === 'excluded' && /(?<!未)已包含|費用已含|included in (?:the )?(?:tour|price|fare)/i.test(entry.text)],
  ['被當成小標題，但像一句內容', entry => entry.field === 'heading' && (/[。！]$|不退|退款|(?:\$|加幣|美金)\s?\d/.test(entry.text) || entry.text.length > 40)],
];

export const flagsFor = entries => entries.flatMap(entry => {
  const hit = checks.find(([, test]) => test(entry));
  return hit ? [{ n: entry.n, field: entry.field, reason: hit[0] }] : [];
});
