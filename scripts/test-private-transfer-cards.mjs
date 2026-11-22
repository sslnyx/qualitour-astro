import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

const defaultIds = ['sienna-7', 'mercedes-12', 'mercedes-16'];

// Collect console.warn output while `fn` runs.
function withWarnings(fn) {
    const warnings = [];
    const original = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try {
        return { result: fn(), warnings };
    } finally {
        console.warn = original;
    }
}

test('a structurally unusable data file falls back to the built-in default cards, with a warning', () => {
    for (const bad of [undefined, null, 'x', {}, 42]) {
        const { result, warnings } = withWarnings(() => buildPrivateTransferCards({ models: bad, lang: 'en', imageFor }));
        const { fleetItems, charterRates } = result;
        assert.deepEqual(fleetItems.map((i) => i.id), defaultIds);
        assert.equal(fleetItems[0].label, 'Sienna Toyota 7-seat Van');
        assert.equal(fleetItems[1].capacity, 'Suitable for 6-10 passengers');
        assert.equal(charterRates[1].title, 'Mercedes Benz-16-seat Van');
        assert.equal(warnings.length, 1);
    }
});

test('one invalid model is dropped with a warning and the others stay in order', () => {
    const bad = [
        { id: 'broken-a', name: { en: 'A', zh: 'A' }, suitable: { min: 'a', max: 4 }, description: { en: '', zh: '' } },
        null,
        { ...m12, name: { en: '', zh: 'x' } },
        { ...m12, description: { en: 5, zh: 'x' } },
    ];
    const { result, warnings } = withWarnings(() =>
        buildPrivateTransferCards({ models: [m16, ...bad, sienna], lang: 'en', imageFor }),
    );
    assert.deepEqual(result.fleetItems.map((i) => i.id), ['mercedes-16', 'sienna-7']);
    assert.equal(warnings.length, 4);
    assert.match(warnings[0], /broken-a/);
    assert.match(warnings[0], /index 1/);
    assert.match(warnings[1], /index 2/);
    assert.match(warnings[2], /mercedes-12/);
    assert.match(warnings[3], /mercedes-12/);
});

test('valid data raises no warning', () => {
    const { warnings } = withWarnings(() => buildPrivateTransferCards({ models: [sienna, m12, m16], lang: 'en', imageFor }));
    assert.deepEqual(warnings, []);
});

test('an empty description is allowed and kept as an empty string', () => {
    const quiet = model('sienna-7', 'Sienna', '豐田', 1, 4, '', '');
    const { result, warnings } = withWarnings(() => buildPrivateTransferCards({ models: [quiet, m12], lang: 'zh', imageFor }));
    assert.deepEqual(warnings, []);
    assert.deepEqual(result.fleetItems.map((i) => [i.id, i.description]), [['sienna-7', ''], ['mercedes-12', '行李']]);
});

// CONTRACT: this file is the output of the ops app's buildVehicleModelsRelease (src/booking/vehicle-models-release.ts)
// for a model with an empty description, a model with a photo, and mercedes-16 absent (hidden or inactive).
const opsRelease = JSON.parse(readFileSync(new URL('./fixtures/vehicle-models-ops-release.json', import.meta.url), 'utf8'));

test('contract: an ops release with an empty description still drives the cards', () => {
    const { result, warnings } = withWarnings(() =>
        buildPrivateTransferCards({ models: opsRelease.models, lang: 'en', imageFor }),
    );
    assert.deepEqual(warnings, []);
    assert.deepEqual(result.fleetItems, [
        { id: 'sienna-7', label: 'Sienna Toyota 7-seat Van', capacity: 'Suitable for 1-4 passengers', description: '', image: 'image:sienna-7' },
        { id: 'mercedes-12', label: 'Mercedes Benz-12-seat Van', capacity: 'Suitable for 6-10 passengers', description: 'Roomy for luggage', image: 'image:mercedes-12' },
    ]);
    // mercedes-16 is absent from the release: its charter card keeps the default wording.
    assert.equal(result.charterRates[0].title, 'Mercedes Benz-12-seat Van');
    assert.equal(result.charterRates[1].modelId, 'mercedes-16');
    assert.equal(result.charterRates[1].title, 'Mercedes Benz-16-seat Van');
    assert.equal(result.charterRates[1].bullets[0], 'Suitable for 6-13 passengers');
    const zh = buildPrivateTransferCards({ models: opsRelease.models, lang: 'zh', imageFor });
    assert.equal(zh.fleetItems[1].label, '賓士 12 座廂型車');
    assert.equal(zh.fleetItems[1].description, '行李空間充裕');
    // The photo reference is data for the build, not for the cards.
    assert.deepEqual(opsRelease.models[1].photo, { file: 'mercedes-12.png', width: 3, height: 2 });
});

test('the seed vehicle-models.json produces exactly the built-in default cards', () => {
    const seed = JSON.parse(readFileSync(new URL('../src/data/vehicle-models.json', import.meta.url), 'utf8'));
    for (const lang of ['en', 'zh']) {
        const fromSeed = withWarnings(() => buildPrivateTransferCards({ models: seed.models, lang, imageFor }));
        const fromDefaults = withWarnings(() => buildPrivateTransferCards({ models: undefined, lang, imageFor }));
        assert.deepEqual(fromSeed.warnings, []);
        assert.deepEqual(fromSeed.result, fromDefaults.result);
        assert.deepEqual(fromSeed.result.fleetItems.map((i) => i.id), defaultIds);
    }
});

test('an approved snapshot photo URL overrides the bundled Astro image in both card variants', () => {
    const photo = '/_vehicle-release/d625d585-cb19-4925-84fb-dc85b8310109/mercedes-12.webp';
    const { fleetItems, charterRates } = buildPrivateTransferCards({ models: [{ ...m12, photo }], lang: 'en', imageFor });
    assert.equal(fleetItems[0].image, photo);
    assert.equal(charterRates.find(rate => rate.modelId === 'mercedes-12').image, photo);
});
