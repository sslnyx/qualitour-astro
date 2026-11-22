// Builds the fleet and charter cards of the private-transfers page from the vehicle models the ops app exports
// (src/data/vehicle-models.json). Pure on purpose: the page supplies the image lookup.

const DEFAULT_MODELS = [
    {
        id: 'sienna-7',
        name: { en: 'Sienna Toyota 7-seat Van', zh: '豐田 Sienna 7 座廂型車' },
        suitable: { min: 1, max: 4 },
        description: {
            en: 'Great for small groups and family outings with comfortable seating',
            zh: '適合小團體與家庭出遊，座位舒適。',
        },
    },
    {
        id: 'mercedes-12',
        name: { en: 'Mercedes Benz-12-seat Van', zh: '賓士 12 座廂型車' },
        suitable: { min: 6, max: 10 },
        description: {
            en: 'Spacious rear storage offering a lot of space for check-in luggage, oversized bags, and sports gear',
            zh: '後車廂空間寬敞，可放置托運行李、大型行李與運動器材。',
        },
    },
    {
        id: 'mercedes-16',
        name: { en: 'Mercedes Benz-16-seat Van', zh: '賓士 16 座廂型車' },
        suitable: { min: 6, max: 13 },
        description: {
            en: 'Seats large groups comfortably with ample trunk room for luggage',
            zh: '可舒適容納大型團體，行李廂空間充裕。',
        },
    },
];

// The two hourly charter cards: price and wording that do not come from a vehicle model.
const CHARTER_CARDS = [
    { modelId: 'mercedes-12', price: '95' },
    { modelId: 'mercedes-16', price: '110', popular: true },
];

const CHARTER_TEXT = {
    en: { unit: '/ Hr', minimum: 'Min. 2.5 hours', area: 'Within Greater Vancouver only' },
    zh: { unit: '/ 小時', minimum: '最少 2.5 小時', area: '僅限大溫哥華地區' },
};

export function suitableText(min, max, lang) {
    return lang === 'zh' ? `適合 ${min}-${max} 位乘客` : `Suitable for ${min}-${max} passengers`;
}

const isText = (value) => typeof value === 'string' && value !== '';
// A description may be empty (the ops app allows it); the page then leaves the paragraph out.
const isDescription = (value) => typeof value === 'string';
const isCount = (value) => Number.isFinite(value);

function isModel(model) {
    return Boolean(
        model &&
            isText(model.id) &&
            isText(model.name?.en) && isText(model.name?.zh) &&
            isCount(model.suitable?.min) && isCount(model.suitable?.max) &&
            isDescription(model.description?.en) && isDescription(model.description?.zh),
    );
}

// Validate one model at a time: an invalid entry is dropped (and named in a warning), the rest stay in order.
// Only a file that is not usable at all falls back to the built-in cards. Neither case may break the page.
function usableModels(models) {
    if (!Array.isArray(models)) {
        console.warn('vehicle-models.json: "models" is not an array; showing the built-in vehicle cards');
        return DEFAULT_MODELS;
    }
    return models.filter((model, index) => {
        if (isModel(model)) return true;
        const id = typeof model?.id === 'string' && model.id !== '' ? ` (${model.id})` : '';
        console.warn(`vehicle-models.json: dropped model at index ${index}${id}: a required field is missing or has the wrong type`);
        return false;
    });
}

export function buildPrivateTransferCards({ models, lang, imageFor }) {
    const language = lang === 'zh' ? 'zh' : 'en';
    const usable = usableModels(models);

    const fleetItems = usable.map((model) => ({
        id: model.id,
        label: model.name[language],
        capacity: suitableText(model.suitable.min, model.suitable.max, language),
        description: model.description[language],
        image: imageFor(model.id, model),
    }));

    const text = CHARTER_TEXT[language];
    const charterRates = CHARTER_CARDS.map(({ modelId, price, popular }) => {
        // A model missing from the data keeps today's wording for its card.
        const model = usable.find((item) => item.id === modelId) ?? DEFAULT_MODELS.find((item) => item.id === modelId);
        return {
            modelId,
            title: model.name[language],
            priceNumber: price,
            priceUnit: text.unit,
            bullets: [suitableText(model.suitable.min, model.suitable.max, language), text.minimum, text.area],
            ...(popular ? { popular: true } : {}),
            image: imageFor(modelId, model),
        };
    });

    return { fleetItems, charterRates };
}
