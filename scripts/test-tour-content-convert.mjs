import assert from 'node:assert/strict';
import test from 'node:test';
import { convertTour, accountedLines } from './tour-content/convert-tour.mjs';
import { splitChinese } from './tour-content/split-paragraph.mjs';

const lines = rows => rows.map(([text, extra = {}], index) => ({ n: index + 1, origin: 'text-box', section: 'details', kind: 'text', text, ...extra }));
const title = text => [text, { origin: 'title' }];

test('every source line ends up in exactly one place, including headings and things the rules do not know', () => {
  const source = lines([['示範團', { origin: 'post_title' }], title('神秘小標題'), ['看不懂的一行'], title('價格包括'), ['• 住宿'], ['12', { kind: 'image' }], ['第一天', { day: 1, part: 'label' }], ['出發', { day: 1, part: 'text' }]]);
  const doc = convertTour(source);
  assert.deepEqual(accountedLines(doc).sort((a, b) => a - b), source.map(line => line.n));
  assert.deepEqual(doc.supplements, [{ area: 'intro', heading: '神秘小標題', lines: [{ n: 3, text: '看不懂的一行' }], reason: '認不出的小標題' }]);
});

test('price rows are only made from clean lines; anything else stays as a note under the price heading', () => {
  const doc = convertTour(lines([title('收費標準'), ['四星酒店'], ['雙人房：$1,299'], ['單人房: US$2,326 (每位)'], ['住宿費+5％ GST(在出發前21 天或更早預訂即可享早鳥優惠，低至每人$849起):'], ['必選項目+5％ GST：國家公園門票+每日早餐：大人$160加幣/每人，小孩(0-15歲)$140加幣/每人。'], ['雙人房 $1,379/每人。']]));
  assert.deepEqual(doc.priceTables.map(table => [table.name, table.rows.map(row => `${row.label}=${row.amount}`)]), [['四星酒店', ['雙人房=$1,299', '單人房=US$2,326 (每位)', '雙人房=$1,379/每人。']]]);
  assert.deepEqual(doc.requiredFees.map(item => item.n), [6]);
  assert.deepEqual(doc.priceNotes.map(item => item.n), [5]);
});

test('included, excluded, departure status and cancellation wording follow their own headings', () => {
  const doc = convertTour(lines([title('出發日期'), ['2026 年 10 月 11 日，目前已額滿關團!!!'], ['2027/05/10，05/18'], ['每逢星期六出發'], title('價格包括'), ['• 住宿'], title('價格不包括'), ['• 機票'], ['【付款、取消及更名須知】', { section: 'itinerary' }], ['- 請於確認艙位後3日內支付全款。'], ['出發前14天以內取消概不退還。'], ['【報名須知】'], ['本行程恕不接受 18 歲以下旅客報名。']]));
  assert.deepEqual(doc.departureDates.map(item => [item.text.slice(0, 4), item.status]), [['2026', '已滿'], ['2027', '']]);
  assert.deepEqual(doc.departureRules.map(item => item.text), ['每逢星期六出發']);
  assert.deepEqual([doc.included.map(i => i.text), doc.excluded.map(i => i.text)], [['• 住宿'], ['• 機票']]);
  // One source heading stays one block: the rules do not guess which sentence is about paying and which about refunds.
  assert.deepEqual(doc.terms.map(term => [term.kind, term.heading, term.lines.map(item => item.n)]), [['paymentAndCancel', '【付款、取消及更名須知】', [10, 11]], ['limits', '【報名須知】', [13]]]);
});

test('optional activities keep their group and get a join limit suggestion that a person must confirm', () => {
  const doc = convertTour(lines([title('自費項目'), ['2.卡加利市當日自費觀光行程'], ['*適用於13點之前接機班次的旅客'], ['-市區觀光3小時 (僅有英文導遊) - $89'], ['-纜車 - $70']]));
  assert.equal(doc.optionalGroups[0].name, '2.卡加利市當日自費觀光行程');
  assert.deepEqual(doc.optionalGroups[0].items.map(item => [item.n, item.limit]), [[3, ''], [4, '僅有英文導遊'], [5, '']]);
  assert.equal(doc.optionalGroups[0].limitsNeedReview, true);
});

test('questions and answers go to the FAQ even when they sit inside the terms', () => {
  const doc = convertTour(lines([['【郵輪常見問題】'], ['Q1. 航程幾天?'], ['A1. 八晚。'], ['Q2. 有醫生嗎?'], ['A2. 有。']]));
  assert.deepEqual(doc.faq.map(item => [item.question.text, item.answer.map(a => a.text)]), [['Q1. 航程幾天?', ['A1. 八晚。']], ['Q2. 有醫生嗎?', ['A2. 有。']]]);
});

test('a list item that contains a heading word stays in its list', () => {
  const doc = convertTour(lines([title('價格不包括'), ['自費景點門票', { origin: 'icon-list' }], ['簽證：中國簽證與往返中國的機票', { origin: 'icon-list' }], ['個人旅遊保險', { origin: 'icon-list' }], title('集合地點'), ['卡加利機場(無須接機服務的可直接於酒店集合)']]));
  assert.deepEqual(doc.excluded.map(item => item.n), [2, 3, 4]);
  assert.deepEqual([doc.pickup.map(item => item.n), doc.optionalGroups, doc.terms], [[6], [], []]);
});

test('a lone price among dates is not read as a date rule, and a sentence about both payment and refunds is not split wrongly', () => {
  const doc = convertTour(lines([title('出發日期/時間'), ['2027 年 03 月 14 日抵達上海，火熱報名中。'], ['加幣$2,199/人'], ['【付款、取消及更名須知】'], ['-更名及取消：'], ['1. 一經預定：訂金CAD500/人，預訂後不退還；出發前 120 天需提交全部尾款']]));
  assert.deepEqual([doc.departureDates.length, doc.departureRules.length, doc.priceNotes.map(item => item.n)], [1, 0, [3]]);
  assert.deepEqual(doc.terms.map(term => [term.kind, term.lines.map(item => item.n)]), [['paymentAndCancel', [6]]]);
  assert.ok(doc.headings.some(item => item.n === 5));
});

test('the short facts at the top of a tour and its code are kept apart from the introduction', () => {
  const list = text => [text, { origin: 'icon-list' }];
  const doc = convertTour(lines([list('5 Hours'), list('Private Group'), list('Tour Code: CVHD'), ['A long description of the tour that belongs to the introduction.']]));
  assert.deepEqual([doc.facts.map(item => item.n), doc.basics.code.n, doc.intro.map(item => item.n)], [[1, 2], 3, [4]]);
});

test('a heading written between asterisks still starts its section', () => {
  const doc = convertTour(lines([title('Price Excludes'), ['Alcoholic beverages'], ['*Terms and Conditions*'], ['Minimum of 4 participants are required.'], ['*The price is same for adults']]));
  assert.deepEqual([doc.excluded.map(item => item.n), doc.terms.map(term => term.lines.map(item => item.n))], [[2], [[4, 5]]]);
});

test('the common English and Chinese heading spellings seen across the live tours are recognised', () => {
  const doc = convertTour(lines([title('Price Includes'), ['Hotels'], title('Price Excludes'), ['Flights'], title('Departure TImes & Location'), ['07:45 a.m. : Coast Calgary Hotel'], title('出發/時間、地點'), ['上午八時 列治文'], title('What to Expect'), ['Day 1: Arrival']]));
  assert.deepEqual([doc.included.map(i => i.n), doc.excluded.map(i => i.n), doc.pickup.map(i => i.n), doc.intro.map(i => i.n), doc.supplements], [[2], [4], [6, 8], [10], []]);
});

test('a sentence stays under the heading the source put it under, whatever words it uses', () => {
  const doc = convertTour(lines([['【報名須知】'], ['本行程不收18歲以下客人。'], ['行程取消條款：提前30天以上取消，取消手續費為加幣500元。'], ['請建議購買旅遊保險。'], title('價格不包括'), ['必選項目：國家公園門票'], title('收費標準'), ['必選項目+5％ GST：大人$160']]));
  assert.deepEqual(doc.terms.map(term => [term.kind, term.lines.map(item => item.n)]), [['limits', [2, 3, 4]]]);
  // A required fee is lifted next to the price only from the price or optional block, never out of another list.
  assert.deepEqual([doc.excluded.map(item => item.n), doc.requiredFees.map(item => item.n)], [[6], [8]]);
});

test('a price is never taken for a heading, and an unknown heading with nothing under it is kept as text', () => {
  const doc = convertTour(lines([title('Rates'), title('CAD155 per person'), title('價格包括'), ['住宿'], title('限時禮遇送完即止')]));
  assert.equal(doc.priceNotes.concat(doc.priceTables.flatMap(table => table.rows)).some(item => item.n === 2), true);
  assert.deepEqual(doc.supplements.flatMap(block => block.lines.map(item => item.n)), [5]);
  assert.equal(doc.headings.some(item => item.n === 2 || item.n === 5), false);
});

test('a long Chinese paragraph is cut only between whole sentences and loses nothing', () => {
  const sentence = '早餐後前往佩姬灣，這裡以壯麗的大西洋景觀和燈塔聞名（每年吸引上百萬遊客。四季皆宜）。';
  const text = sentence.repeat(6) + '她說：「真美！下次再來。」然後回酒店';
  const parts = splitChinese(text, 90);
  assert.equal(parts.join(''), text);
  assert.ok(parts.length > 2);
  for (const part of parts) {
    assert.equal((part.match(/（/g) || []).length, (part.match(/）/g) || []).length);
    assert.equal((part.match(/「/g) || []).length, (part.match(/」/g) || []).length);
  }
  assert.ok(parts.slice(0, -1).every(part => /[。！？!?][」』）)]?$/.test(part)));
  assert.deepEqual(splitChinese('短段落。就這樣。', 90), ['短段落。就這樣。']);
  assert.deepEqual(splitChinese('沒有句號的很長一段'.repeat(30), 90), ['沒有句號的很長一段'.repeat(30)]);
});
