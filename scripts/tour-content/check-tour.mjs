// Plain-language warnings an editor should see before publishing. They never change the tour.
const months = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);

export function departureDates(text) {
  const found = [];
  let year = '';
  const pattern = /(20\d\d)\s*[\/年.-]\s*(\d{1,2})\s*[\/月.-]\s*(\d{1,2})\s*日?|(?<![\d\/])(\d{1,2})(?:\/|\s*月\s*)(\d{1,2})\s*日?(?![\d\/])|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)/gi;
  for (const match of String(text).matchAll(pattern)) {
    if (match[1]) { year = match[1]; found.push(iso(year, +match[2], +match[3])); }
    else if (match[4]) { if (year) found.push(iso(year, +match[4], +match[5])); }
    else found.push(iso(match[8], months[match[6].toLowerCase()], +match[7]));
  }
  return found.filter(Boolean);
}

const years = text => new Set(String(text).match(/20[2-9]\d(?=\s*(?:年|[\/.-]\d|\b))/g) || []);
const money = text => (String(text).match(/\d[\d,]{2,}/g) || []).map(value => value.replaceAll(',', ''));

export function checkTour(doc, today) {
  const warnings = [];
  const warn = (code, message) => warnings.push({ code, message });
  const dateText = [...doc.departureDates.map(item => item.text), ...doc.departureRules].join('\n');
  const rows = doc.priceTables.flatMap(table => table.rows);
  if (!dateText.trim()) warn('no-departures', '沒有填出發日期或出發規則');
  const dates = departureDates(dateText);
  if (dates.length && dates.every(date => date < today)) warn('all-dates-past', '所有出發日期都已過去');
  const titleYears = years(doc.title), dateYears = years(dateText);
  if (titleYears.size && dateYears.size && ![...titleYears].some(year => dateYears.has(year))) warn('year-mismatch', '團名的年份和出發日期的年份不同');
  if (!rows.length && !doc.headlinePrice && !doc.priceNotes.length) warn('no-price', '沒有填價錢');
  const headline = money(doc.headlinePrice);
  const amounts = new Set(rows.flatMap(row => money(row.amount)));
  if (rows.length && headline.length && !headline.some(value => amounts.has(value))) warn('headline-not-in-table', '卡片上的價錢在價目表裡找不到');
  if (!doc.terms.some(item => item.kind === 'cancel') && !doc.sharedTerms.length) warn('no-cancel-terms', '沒有取消或退款條款');
  return warnings;
}
