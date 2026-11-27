import assert from 'node:assert/strict';
import test from 'node:test';
import { siteRecord, tourChecks } from '../src/lib/cms/tour-checks.mjs';
import { sourceLines } from './tour-content/source-lines.mjs';

const element = (type, value) => ({ template: 'element', type, value });
const section = (id, ...items) => ({ template: 'wrapper', type: 'background', value: { id }, items });
const heading = title => element('title', { title, caption: '' });
const html = (...paragraphs) => element('text-box', { content: paragraphs.map(text => `<p>${text}</p>`).join('') });
const tour = (items, extra = {}) => ({ title: { rendered: '2027年示範團' }, content: { rendered: '' }, tour_meta: { price: '1299' },
  goodlayers_data: { sections: [section('details', ...items)] }, ...extra });
const complete = [heading('出發日期'), html('2027年5月10日出發'), heading('收費標準'), html('雙人房：$1,299'), heading('價格包括'), html('住宿'), heading('訂單修改規則'), html('出發前14天內取消，費用不退。')];
const codes = checks => checks.map(check => check.code);

test('a complete tour produces no reminders', () => {
  assert.deepEqual(tourChecks(tour(complete), {}, '2026-11-26'), []);
});

test('reminders follow the date, and say when every listed departure has passed', () => {
  assert.deepEqual(codes(tourChecks(tour(complete), {}, '2027-06-01')), ['dates-past']);
});

test('year, price, departure and cancellation problems are reported in plain words', () => {
  const checks = tourChecks(tour([heading('出發日期'), html('2026年4月9日出發'), heading('收費標準'), html('雙人房：$999')]), {}, '2026-01-01');
  assert.deepEqual(codes(checks), ['year-mismatch', 'headline-price', 'no-cancel']);
  assert.match(checks[1].title, /1299/);
  for (const check of checks) assert.ok(check.title && check.action);
  assert.deepEqual(codes(tourChecks(tour([html('簡介')], { tour_meta: {} }), {}, '2026-01-01')), ['no-departures', 'no-price', 'no-cancel']);
});

test('wording that looks out of place is quoted where the source put it, and says whether staff can edit it', () => {
  const items = [html('早鳥價 $899 起'), ...complete, heading('報名須知'), html('遲到錯過行程，當日費用不退。'), heading('價格包括'), html('行李托運費另付')];
  const data = { overview: [{ _type: 'block', children: [{ _type: 'span', text: '早鳥價 $899 起' }] }] };
  const original = structuredClone(tour(items));
  const checks = tourChecks(original, data, '2026-11-26');
  assert.deepEqual(codes(checks), ['money-outside', 'refund-outside', 'included-says-extra']);
  assert.deepEqual(checks.map(check => check.lines), [
    [{ place: '簡介', text: '早鳥價 $899 起', editable: true }],
    [{ place: '報名限制', text: '遲到錯過行程，當日費用不退。', editable: false }],
    [{ place: '費用包含', text: '行李托運費另付', editable: false }],
  ]);
  assert.deepEqual(original, tour(items));
});

test('a tour written in the new editor is read from its overview, days and questions', () => {
  const native = { title: { rendered: '新團 &amp; 示範' }, content: { rendered: '<p>簡介文字</p>' }, tour_meta: { price: '500' },
    goodlayers_data: { sections: [{ value: { id: 'info' }, items: [{ type: 'text-box', value: { content: '<p>取消不退款</p>' } }] }],
      tour_itinerary: [{ title: '溫哥華', content: '<p>集合出發</p>' }], tour_faq: [{ title: '要帶護照嗎', content: '<p>要</p>' }] } };
  const texts = sourceLines(siteRecord(native)).map(line => line.text);
  for (const text of ['新團 & 示範', '簡介文字', '取消不退款', '溫哥華', '集合出發', '要帶護照嗎']) assert.ok(texts.includes(text), text);
});
