import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPrivateTransferCards, suitableText } from '../src/lib/private-transfer-cards.mjs';

const model = (id, en, zh, min, max, dEn, dZh) => ({
    id,
    name: { en, zh },
    seats: max + 2,
    suitable: { min, max },
    description: { en: dEn, zh: dZh },
    sortOrder: 10,
    photo: null,
});
const sienna = model('sienna-7', 'Sienna', '豐田', 1, 4, 'Small groups', '小團體');
const m12 = model('mercedes-12', 'Benz 12', '賓士 12', 6, 10, 'Luggage', '行李');
const m16 = model('mercedes-16', 'Benz 16', '賓士 16', 6, 13, 'Large groups', '大團體');
const imageFor = (id) => `image:${id}`;

test('suitableText uses the website sentences', () => {
    assert.equal(suitableText(1, 4, 'en'), 'Suitable for 1-4 passengers');
    assert.equal(suitableText(1, 4, 'zh'), '適合 1-4 位乘客');
});

test('fleet cards follow the data in order with English and Chinese text', () => {
    const models = [m16, sienna];
    const en = buildPrivateTransferCards({ models, lang: 'en', imageFor }).fleetItems;
    assert.deepEqual(en, [
        { id: 'mercedes-16', label: 'Benz 16', capacity: 'Suitable for 6-13 passengers', description: 'Large groups', image: 'image:mercedes-16' },
        { id: 'sienna-7', label: 'Sienna', capacity: 'Suitable for 1-4 passengers', description: 'Small groups', image: 'image:sienna-7' },
    ]);
    const zh = buildPrivateTransferCards({ models, lang: 'zh', imageFor }).fleetItems;
    assert.deepEqual(zh.map((i) => [i.label, i.capacity, i.description]), [
        ['賓士 16', '適合 6-13 位乘客', '大團體'],
        ['豐田', '適合 1-4 位乘客', '小團體'],
    ]);
});

test('charter cards take name and range from their model', () => {
    const edited = model('mercedes-12', 'Benz 12 Plus', '賓士 12 加長', 5, 9, 'x', 'x');
    const en = buildPrivateTransferCards({ models: [sienna, edited, m16], lang: 'en', imageFor }).charterRates;
    assert.equal(en.length, 2);
    assert.deepEqual(en[0], {
        modelId: 'mercedes-12',
        title: 'Benz 12 Plus',
        priceNumber: '95',
        priceUnit: '/ Hr',
        bullets: ['Suitable for 5-9 passengers', 'Min. 2.5 hours', 'Within Greater Vancouver only'],
        image: 'image:mercedes-12',
    });
    assert.equal(en[1].modelId, 'mercedes-16');
    assert.equal(en[1].priceNumber, '110');
    assert.equal(en[1].popular, true);
    const zh = buildPrivateTransferCards({ models: [sienna, edited, m16], lang: 'zh', imageFor }).charterRates;
    assert.equal(zh[0].title, '賓士 12 加長');
    assert.equal(zh[0].priceUnit, '/ 小時');
    assert.deepEqual(zh[0].bullets, ['適合 5-9 位乘客', '最少 2.5 小時', '僅限大溫哥華地區']);
});

test('a model missing from the data leaves that charter card on its default text', () => {
    const en = buildPrivateTransferCards({ models: [sienna, m16], lang: 'en', imageFor }).charterRates;
    assert.equal(en[0].title, 'Mercedes Benz-12-seat Van');
    assert.deepEqual(en[0].bullets, ['Suitable for 6-10 passengers', 'Min. 2.5 hours', 'Within Greater Vancouver only']);
    assert.equal(en[0].image, 'image:mercedes-12');
    assert.equal(en[1].title, 'Benz 16');
    const zh = buildPrivateTransferCards({ models: [sienna, m16], lang: 'zh', imageFor }).charterRates;
    assert.equal(zh[0].title, '賓士 12 座廂型車');
    assert.equal(zh[0].bullets[0], '適合 6-10 位乘客');
});

test('a hidden (absent) model is not shown in the fleet cards', () => {
    const { fleetItems } = buildPrivateTransferCards({ models: [sienna, m16], lang: 'en', imageFor });
    assert.deepEqual(fleetItems.map((i) => i.id), ['sienna-7', 'mercedes-16']);
    assert.deepEqual(buildPrivateTransferCards({ models: [], lang: 'en', imageFor }).fleetItems, []);
});

test('imageFor fallback is used when a model has no photo', () => {
    const calls = [];
    const stub = (id) => { calls.push(id); return id === 'sienna-7' ? undefined : 'default.png'; };
    const { fleetItems } = buildPrivateTransferCards({ models: [sienna, m12], lang: 'en', imageFor: stub });
    assert.equal(fleetItems[0].image, undefined);
    assert.equal(fleetItems[1].image, 'default.png');
    assert.ok(calls.includes('sienna-7'));
});

test('a malformed data file falls back to the built-in default cards', () => {
    for (const bad of [undefined, null, 'x', {}, [{ id: 'sienna-7' }], [{ ...sienna, suitable: { min: 'a', max: 4 } }], [m12, null]]) {
        const { fleetItems, charterRates } = buildPrivateTransferCards({ models: bad, lang: 'en', imageFor });
        assert.deepEqual(fleetItems.map((i) => i.id), ['sienna-7', 'mercedes-12', 'mercedes-16']);
        assert.equal(fleetItems[0].label, 'Sienna Toyota 7-seat Van');
        assert.equal(fleetItems[1].capacity, 'Suitable for 6-10 passengers');
        assert.equal(charterRates[1].title, 'Mercedes Benz-16-seat Van');
    }
});
