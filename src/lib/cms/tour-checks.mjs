// Reminders for the tour editor, worked out from what the public page shows. The site keeps the source wording where
// the source put it; these only point out what a person should look at. Nothing here changes a tour.
import { sourceLines } from '../../../scripts/tour-content/source-lines.mjs';
import { convertTour } from '../../../scripts/tour-content/convert-tour.mjs';
import { departureDates } from '../../../scripts/tour-content/check-tour.mjs';
import { fieldEntries, flagsFor } from '../../../scripts/tour-content/review-sample.mjs';

const overviewIds = ['overview', 'description', 'detail', 'details'];
const element = (type, value) => ({ template: 'element', type, value });
const wrapper = (id, items) => ({ template: 'wrapper', type: 'background', value: { id }, items });
const block = node => (Array.isArray(node?.items) && (!node.type || node.template === 'wrapper')
  ? { ...node, template: 'wrapper', items: node.items.map(block) }
  : { ...node, template: 'element' });

/** The site's tour in the shape of an exported WordPress record, so both are read by the same rules. */
export function siteRecord(tour) {
  const data = tour.goodlayers_data || {};
  const sections = (data.sections || []).map(block);
  const overview = tour.content?.rendered;
  if (overview && !sections.some(section => overviewIds.includes(section.value?.id))) sections.unshift(wrapper('details', [element('text-box', { content: overview })]));
  if (data.tour_itinerary?.length) sections.push(wrapper('itinerary', [element('toggle-box', {
    // The label only marks each entry as one day.
    tabs: data.tour_itinerary.map((day, index) => ({ 'head-text': `Day ${index + 1}`, title: day.title, content: day.content })),
  })]));
  if (data.tour_faq?.length) sections.push(wrapper('faq', [element('accordion', { tabs: data.tour_faq.map(item => ({ title: item.title, content: item.content })) })]));
  const meta = tour.tour_meta || {};
  return {
    post: { post_title: tour.title?.rendered || '' },
    decoded_meta: { 'tourmaster-tour-option': [{ 'tour-price-text': String(meta.price || ''), 'duration-text': String(meta.duration || '') }], 'gdlr-core-page-builder': [sections] },
  };
}

const plain = value => String(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function storedText(value, found = []) {
  if (typeof value === 'string') found.push(value);
  else if (Array.isArray(value)) value.forEach(item => storedText(item, found));
  else if (value && typeof value === 'object') {
    // Rich text splits one sentence into several styled pieces.
    if (value._type === 'block' && Array.isArray(value.children)) found.push(value.children.map(span => span?.text ?? '').join(''));
    else Object.values(value).forEach(item => storedText(item, found));
  }
  return found;
}

const places = { price: '價目表', priceNotes: '價目備註', requiredFees: '必付費用', departureDates: '出發日期', departureRules: '出發規則', included: '費用包含', excluded: '費用不包含',
  'term.payment': '付款條款', 'term.cancel': '取消條款', 'term.paymentAndCancel': '付款和取消', 'term.limits': '報名限制', 'term.documents': '證件簽證', 'term.other': '其他須知',
  optional: '自費項目', pickup: '接送集合', highlights: '亮點', intro: '簡介', facts: '重點資料', itineraryNotes: '行程附註', faq: '常見問題', supplement: '其他內容' };
const placement = {
  '有金額，但不在價目或費用欄': ['money-outside', '價錢寫在價目以外的段落', '請確認這是不是團費或附加費；是的話，建議也寫在價目裡。'],
  '提到取消或退款，但不在取消條款': ['refund-outside', '有退款或取消的字句，不在取消條款段落', '請確認客人是否容易看到，並和取消條款沒有矛盾。'],
  '有出發日期，但不在日期欄': ['date-outside', '出發日期寫在日期以外的段落', '請確認和出發日期一致；改日期時兩處都要改。'],
  '放在「費用包含」，但寫著另付或不包': ['included-says-extra', '「費用包含」裡有寫著另付或不包的項目', '請確認應該放在「包含」還是「不包含」。'],
  '放在「費用不包含」，但寫著已包含': ['excluded-says-included', '「費用不包含」裡有寫著已包含的項目', '請確認應該放在「包含」還是「不包含」。'],
};

export function tourChecks(tour, stored, today) {
  const lines = sourceLines(siteRecord(tour));
  const doc = convertTour(lines);
  const entries = fieldEntries(doc);
  const text = lines.filter(line => line.kind === 'text');
  const everything = text.map(line => line.text).join('\n');
  const checks = [];
  const add = (code, title, action, found = []) => checks.push({ code, title, action, lines: found });

  const dateText = [...doc.departureDates, ...doc.departureRules].map(item => item.text).join('\n');
  const dates = departureDates(dateText);
  if (!dateText.trim()) add('no-departures', '找不到出發日期段落', '請確認團頁有寫出發日期或出發規則。');
  else if (dates.length && dates.every(date => date < today)) add('dates-past', '列出的出發日期全部已過', '有新日期請更新；已停辦請考慮下架。');
  const yearsIn = value => new Set(String(value).match(/20[2-9]\d(?=\s*(?:年|[\/.-]\d|\b))/g) || []);
  const titleYears = yearsIn(doc.title?.text || ''), dateYears = yearsIn(dateText);
  if (titleYears.size && dateYears.size && ![...titleYears].some(year => dateYears.has(year))) add('year-mismatch', '團名的年份和出發日期的年份不同', '請核對團名和出發日期。');

  const amountsIn = value => (String(value).match(/\d[\d,]{2,}/g) || []).map(amount => amount.replaceAll(',', ''));
  const headline = amountsIn(tour.tour_meta?.price || '');
  const priced = text.filter(line => !line.origin.startsWith('option:') && /(?:\$|CAD|USD|加幣|美金)\s?\d/i.test(line.text));
  if (!headline.length && !priced.length) add('no-price', '找不到價錢', '請確認團頁有寫價錢，或寫明要查詢。');
  else if (headline.length && priced.length) {
    const shown = new Set(priced.flatMap(line => amountsIn(line.text)));
    if (!headline.some(amount => shown.has(amount))) add('headline-price', `卡片上的價錢 ${tour.tour_meta.price} 在團內容裡找不到`, '請核對「基本資料」的價格和團內的價目。');
  }
  const hasCancelTerms = doc.terms.some(term => term.kind === 'cancel' || term.kind === 'paymentAndCancel');
  if (!hasCancelTerms && !/取消|退款|不退|\bcancel|\brefund/i.test(everything)) add('no-cancel', '找不到取消或退款的內容', '如果這個團有取消條款，請補上。圖片和 PDF 裡的文字沒有檢查。');

  const saved = storedText(stored).map(plain).join('|');
  const flags = flagsFor(entries);
  for (const [reason, [code, title, action]] of Object.entries(placement)) {
    const seen = new Set(), found = [];
    for (const flag of flags.filter(item => item.reason === reason)) {
      const entry = entries.find(item => item.n === flag.n && item.field === flag.field);
      if (seen.has(entry.text)) continue;
      seen.add(entry.text);
      const key = plain(entry.text);
      found.push({ place: places[entry.field] || '其他內容', text: entry.text, editable: key.length > 0 && saved.includes(key) });
    }
    if (found.length) add(code, title, action, found);
  }
  return checks;
}
