// Rule-based first draft of a tour document from numbered source lines.
// Nothing is dropped: a line the rules cannot place stays, with its heading and position, as supplementary text.
// The source's own headings decide where a line goes. Wording that looks out of place is reported to editors, never moved.
import { departureDates } from './check-tour.mjs';

const headingRules = [
  ['faq', /常見問題|^faqs?$|frequently asked/i],
  ['optional', /自費|加選|加購|可選項目|^optional|add-?ons?/i],
  ['excluded', /不包[括含]|費用不含|not\s+included|exclu/i],
  ['included', /包[括含]|\binclude[sd]?\b|inclusions?/i],
  ['payCancel', /(?=.*(?:付款|訂金|payment|deposit))(?=.*(?:取消|退款|cancel|refund))/i],
  ['limits', /報名須知|參加限制|健康|年齡/],
  ['documents', /證件|簽證|護照|documents?|visa|passport/i],
  ['cancel', /取消|退款|修改規則|更改|cancel|refund/i],
  ['payment', /付款|訂金|payment|deposit/i],
  ['terms', /須知|條款|注意|指引|規則|policy|terms|additional info|reminder|important/i],
  ['pickup', /集合|接機|送機|離團|參團地點|出發\/時間、地點|meeting|pick.?up|departure (?:& return|times? & location)/i],
  ['dates', /出發日期|出發時間|團期|departure date|dates\s*\/\s*times/i],
  ['price', /收費|價格|價錢|費用|團費|^rates?$|pricing/i],
  ['highlights', /特色|亮點|路線概覽|highlights?/i],
  ['itineraryNotes', /^行程安排$|^行程$|^itinerary$/i],
  ['intro', /行程簡介|^overview$|^what to expect$/i],
];
const money = String.raw`(?:US\$|USD\$?|CAD\$?|C\$|\$|加幣\$?|美金)\s?\d[\d,]*(?:\.\d+)?`;
const unit = String.raw`(?:\s*\/\s*(?:每人|每位|person)[。.]?)?(?:\s*[（(][^()（）]{0,90}[)）])?[。.]?`;
const colonRow = new RegExp(String.raw`^([^:：$]{1,30})[:：]\s*(${money}${unit})$`);
const spaceRow = new RegExp(String.raw`^((?:[^:：$]{0,20}(?:房|兒童|大人|成人|adults?|child(?:ren)?|room)[^:：$]{0,14}?))\s+(${money}${unit})$`, 'i');
const priceRow = text => colonRow.exec(text) || spaceRow.exec(text);
const requiredFee = /^[*＊\s]*(?:必選|必付|mandatory|compulsory)/i;
const joinLimit = /僅有英文導[遊游]|無導[遊游]講解|最少\s*\d+\s*人(?:出團)?|\d+\s*歲以上|english[- ]speaking guide only|minimum of \d+ [a-z]+/i;
const statusOf = text => (/完售|額滿|售罄|關團|sold out/i.test(text) ? '已滿' : /候補|wait ?list/i.test(text) ? '候補' : /餘位|最後.{0,4}[房位]|limited/i.test(text) ? '餘位不多' : '');

// List items are content even when they mention a heading word ("自費景點門票" is something not included, not a new section).
const starred = /^\*+\s*([^*]{2,40}?)\s*\*+$/;
const isHeading = line => /^【[^】]{2,24}】$/.test(line.text) || (starred.test(line.text) && headingRules.some(([, rule]) => rule.test(starred.exec(line.text)[1]))) || (line.origin !== 'icon-list' && !/^[-–•▪*＊\d(（]|^[QA]\d/.test(line.text)
  && !/[。！!]$|\d{1,2}\s*月|(?:\$|CAD|USD|加幣|美金)\s?\d|20\d\d/.test(line.text)
  && ((line.origin === 'title' && line.text.length <= 30)
    || (line.text.length <= (/[一-鿿]/.test(line.text) ? 14 : 28) && !/[)）]$/.test(line.text) && headingRules.some(([, rule]) => rule.test(line.text)))));
// "-更名及取消：" introduces the lines below it without starting a new section.
const isSubheading = line => /^[-–]?\s*[^:：]{2,12}[:：]$/.test(line.text) && line.origin !== 'icon-list';
const tourCode = /^(?:團號|tour code)\s*[:：]/i;

export function convertTour(lines) {
  const doc = { schema: 1, title: null, basics: {}, headings: [], images: [], facts: [], intro: [], highlights: [], departureRules: [], departureDates: [], pickup: [],
    priceTables: [], priceNotes: [], requiredFees: [], included: [], excluded: [], optionalGroups: [], days: [], itineraryNotes: [], terms: [], faq: [], supplements: [] };
  let area = 'intro', broad = 'intro', heading = '', section = null, priceGroup = '', termStart = true;
  const item = line => ({ n: line.n, text: line.text });
  const enter = (next, label) => { area = next; heading = label; priceGroup = ''; termStart = true; if (!['unknown'].includes(next)) broad = next; };
  const term = (kind, line) => {
    const last = doc.terms.at(-1);
    if (!termStart && last?.kind === kind && last.heading === heading) last.lines.push(item(line));
    else { doc.terms.push({ kind, heading, lines: [item(line)] }); termStart = false; }
  };
  const supplement = (line, reason) => {
    const last = doc.supplements.at(-1);
    if (last && last.area === broad && last.heading === heading && last.reason === reason && last.lines.at(-1).n >= line.n - 2) last.lines.push(item(line));
    else doc.supplements.push({ area: broad, heading, lines: [item(line)], reason });
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.origin === 'post_title') { doc.title = item(line); continue; }
    if (line.origin.startsWith('option:')) { doc.basics[line.origin.slice(7)] = item(line); continue; }
    if (line.day) {
      const entry = doc.days.find(day => day.number === line.day) || doc.days[doc.days.push({ number: line.day, lines: [] }) - 1];
      entry.lines.push({ ...item(line), part: line.part, ...(line.kind === 'image' ? { image: true } : {}) });
      continue;
    }
    if (line.section !== section) {
      section = line.section;
      const id = String(section || '');
      if (/itinerary/i.test(id)) enter('itineraryNotes', ''); else if (/faq/i.test(id)) enter('faq', ''); else if (/info|additional/i.test(id)) enter('terms', '');
    }
    if (line.kind === 'image') { doc.images.push({ n: line.n, ref: line.text, area: area === 'unknown' ? broad : area }); continue; }
    if (tourCode.test(line.text) && !doc.basics.code) { doc.basics.code = item(line); continue; }
    if (area === 'intro' && !heading && line.origin === 'icon-list' && line.text.length <= 40) { doc.facts.push(item(line)); continue; }
    if (isSubheading(line) && !headingRules.some(([name, rule]) => name !== area && /^(included|excluded|optional)$/.test(name) && rule.test(line.text))) { doc.headings.push({ ...item(line), area }); continue; }
    if (isHeading(line)) {
      const found = headingRules.find(([, rule]) => rule.test(line.text));
      doc.headings.push({ ...item(line), area: found ? found[0] : 'unknown' });
      if (found) enter(found[0], line.text); else { area = 'unknown'; heading = line.text; termStart = true; }
      continue;
    }
    if (/^Q\d+\s*[.、:：]/i.test(line.text)) { if (area !== 'faq') enter('faq', heading); doc.faq.push({ question: item(line), answer: [] }); continue; }
    if (['price', 'optional'].includes(area) && requiredFee.test(line.text)) { doc.requiredFees.push(item(line)); continue; }

    if (area === 'unknown') supplement(line, '認不出的小標題');
    else if (area === 'faq') { if (doc.faq.length) doc.faq.at(-1).answer.push(item(line)); else supplement(line, '常見問題裡找不到問題'); }
    else if (area === 'dates') {
      if (departureDates(line.text).length) doc.departureDates.push({ ...item(line), status: statusOf(line.text) });
      else if (new RegExp(money).test(line.text)) doc.priceNotes.push(item(line));
      else doc.departureRules.push(item(line));
    } else if (area === 'price') {
      const row = priceRow(line.text);
      if (row) {
        const table = doc.priceTables.at(-1)?.name === priceGroup ? doc.priceTables.at(-1) : doc.priceTables[doc.priceTables.push({ name: priceGroup, nameN: undefined, rows: [] }) - 1];
        table.rows.push({ n: line.n, label: row[1].trim(), amount: row[2].trim() });
      } else if (line.text.length <= 40 && !new RegExp(money).test(line.text) && lines[index + 1] && priceRow(lines[index + 1].text)) {
        priceGroup = line.text; doc.priceTables.push({ name: priceGroup, nameN: line.n, rows: [] });
      } else doc.priceNotes.push(item(line));
    } else if (area === 'optional') {
      const numbered = /^\d+\s*[.、]/.test(line.text);
      if (numbered || !doc.optionalGroups.length || doc.optionalGroups.at(-1).heading !== heading) {
        doc.optionalGroups.push({ heading, name: numbered ? line.text : '', nameN: numbered ? line.n : undefined, items: [], limitsNeedReview: false });
        if (numbered) continue;
      }
      const group = doc.optionalGroups.at(-1), limit = joinLimit.exec(line.text)?.[0] || '';
      group.items.push({ ...item(line), limit });
      if (limit) group.limitsNeedReview = true;
    } else if (area === 'payCancel') term('paymentAndCancel', line);
    else if (['payment', 'cancel', 'documents', 'limits', 'terms'].includes(area)) term(area === 'terms' ? 'other' : area, line);
    else doc[area].push(item(line));
  }
  // A short line taken for an unknown heading but followed by nothing was probably content: keep it where readers see it.
  const headed = new Set(doc.supplements.map(block => block.heading));
  for (const entry of doc.headings.filter(item => item.area === 'unknown' && !headed.has(item.text))) {
    doc.supplements.push({ area: 'intro', heading: '', lines: [{ n: entry.n, text: entry.text }], reason: '像小標題但下面沒有內容' });
  }
  doc.headings = doc.headings.filter(entry => entry.area !== 'unknown' || headed.has(entry.text));
  return doc;
}

/** Line numbers present anywhere in the document, one entry per use. */
export function accountedLines(value, found = []) {
  if (Array.isArray(value)) value.forEach(entry => accountedLines(entry, found));
  else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if ((key === 'n' || key === 'nameN') && Number.isInteger(entry)) found.push(entry);
      else accountedLines(entry, found);
    }
  }
  return found;
}
