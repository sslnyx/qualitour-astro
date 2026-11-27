import assert from 'node:assert/strict';
import test from 'node:test';
import { convertTour } from './tour-content/convert-tour.mjs';
import { fieldEntries, flagsFor, pickReviewSample } from './tour-content/review-sample.mjs';

const candidate = (key, stratum, signature = key) => ({ key, stratum, signature });
const pool = [
  ...Array.from({ length: 20 }, (_, i) => candidate(`zh:${i}`, 'zh')),
  ...Array.from({ length: 20 }, (_, i) => candidate(`en:${i}`, 'other')),
  candidate('en:v1', 'viking', 'same'), candidate('en:v2', 'viking', 'same'), candidate('en:v3', 'viking', 'same'), candidate('en:v4', 'viking', 'different'),
];

test('the sample is repeatable, follows the quotas and leaves out the tours the rules were tuned on', () => {
  const options = { seed: 7, quotas: { zh: 5, other: 4, viking: 2 }, exclude: [candidate('zh:0', 'zh'), candidate('zh:1', 'zh')] };
  const first = pickReviewSample(pool, options), again = pickReviewSample([...pool].reverse(), options);
  assert.deepEqual(first.map(item => item.key), again.map(item => item.key));
  assert.deepEqual(['zh', 'other', 'viking'].map(name => first.filter(item => item.stratum === name).length), [5, 4, 2]);
  assert.equal(first.some(item => ['zh:0', 'zh:1'].includes(item.key)), false);
  assert.notDeepEqual(first.map(item => item.key), pickReviewSample(pool, { ...options, seed: 8 }).map(item => item.key));
});

test('one supplier template cannot fill a whole group', () => {
  const many = [...Array.from({ length: 12 }, (_, i) => ({ ...candidate(`en:n${i}`, 'other'), family: 'namibia' })), ...Array.from({ length: 4 }, (_, i) => ({ ...candidate(`en:o${i}`, 'other'), family: `solo${i}` }))];
  const picked = pickReviewSample(many, { seed: 3, quotas: { other: 6 }, perFamily: 2 });
  assert.equal(picked.length, 6);
  assert.equal(picked.filter(item => item.family === 'namibia').length, 2);
});

test('two tours whose money, date and condition lines are identical are not both reviewed', () => {
  const picked = pickReviewSample(pool, { seed: 1, quotas: { viking: 3 }, exclude: [] });
  assert.equal(picked.length, 2);
  assert.deepEqual(picked.map(item => item.signature).sort(), ['different', 'same']);
});

const lines = rows => rows.map(([text, extra = {}], index) => ({ n: index + 1, origin: 'text-box', section: 'details', kind: 'text', text, ...extra }));

test('every placed line appears once for the reviewer, with the field it was put in', () => {
  const doc = convertTour(lines([['團名', { origin: 'post_title' }], ['價格包括', { origin: 'title' }], ['住宿'], ['收費標準', { origin: 'title' }], ['雙人房：$900'], ['第一天', { day: 1, part: 'label' }]]));
  assert.deepEqual(fieldEntries(doc).map(entry => [entry.n, entry.field]), [[2, 'heading'], [3, 'included'], [4, 'heading'], [5, 'price']]);
});

test('lines that look misplaced are pointed out and ordinary lines are not', () => {
  const entries = [
    { n: 1, field: 'intro', text: '早鳥價 $899 起' }, { n: 2, field: 'highlights', text: '出發前取消不退款' }, { n: 3, field: 'intro', text: '2027年3月14日出發' },
    { n: 4, field: 'included', text: '行李托運費另付' }, { n: 5, field: 'excluded', text: '住宿費用已包含在團費' }, { n: 6, field: 'price', text: '雙人房 $900' },
    { n: 7, field: 'included', text: '全程住宿' }, { n: 8, field: 'term.cancel', text: '取消不退款' }, { n: 9, field: 'departureRules', text: '每週六出發' },
    { n: 10, field: 'heading', text: '收費標準' }, { n: 11, field: 'heading', text: '出發前取消概不退款' },
    // Extra costs caused by a cancelled flight are not a refund term.
    { n: 12, field: 'excluded', text: '因罷工、天氣、航班取消等不可抗力導致的額外費用' },
    // "Included, except optional items" is correct wording for the included list.
    { n: 13, field: 'included', text: '行程上所有景點門票（自費項目除外）' },
  ];
  assert.deepEqual(flagsFor(entries).map(flag => [flag.n, flag.reason]), [
    [1, '有金額，但不在價目或費用欄'], [2, '提到取消或退款，但不在取消條款'], [3, '有出發日期，但不在日期欄'],
    [4, '放在「費用包含」，但寫著另付或不包'], [5, '放在「費用不包含」，但寫著已包含'], [11, '被當成小標題，但像一句內容'],
  ]);
});
