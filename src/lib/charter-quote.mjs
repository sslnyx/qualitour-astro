// The custom charter quote form: what is required, and what is sent to /api/transfer/enquiries.
// Pure on purpose so it can be tested with node. The booking API validates everything again.

export function emptyQuote(vehicleModelId = '') {
    return {
        name: '', email: '', phone: '', vehicleModelId, travelDate: '', startTime: '', hours: '',
        passengers: '', pickup: '', itinerary: '', luggage: '', notes: '', website: '',
    };
}

const REQUIRED = ['name', 'email', 'travelDate', 'passengers', 'pickup', 'itinerary'];

/** The fields shown on each step, in order: the clicked vehicle comes first, personal details last. */
export const QUOTE_STEPS = [
    ['vehicleModelId', 'passengers', 'travelDate', 'startTime', 'hours'],
    ['pickup', 'itinerary', 'luggage', 'notes'],
    ['name', 'email', 'phone'],
];

/** The problems among one step's own fields, in the order the fields are shown. */
export function stepErrors(form, step, today = vancouverToday()) {
    const errors = quoteErrors(form, today);
    return Object.fromEntries(QUOTE_STEPS[step].filter((field) => errors[field]).map((field) => [field, errors[field]]));
}

/** The earliest step holding one of these problems, or -1 when there are none. */
export function firstStepWithError(errors) {
    return QUOTE_STEPS.findIndex((fields) => fields.some((field) => errors[field]));
}

export function vancouverToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver' }).format(new Date());
}

/** Field name to problem code; an empty object means the form can be sent. */
export function quoteErrors(form, today = vancouverToday()) {
    const errors = {};
    for (const field of REQUIRED) if (!form[field].trim()) errors[field] = 'required';
    if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'email';
    if (!errors.travelDate && form.travelDate < today) errors.travelDate = 'past';
    const passengers = Number(form.passengers);
    if (!errors.passengers && !(Number.isInteger(passengers) && passengers >= 1 && passengers <= 500)) errors.passengers = 'passengers';
    const hours = Number(form.hours);
    if (form.hours.trim() && !(hours >= 0.5 && hours <= 240)) errors.hours = 'hours';
    return errors;
}

export function quotePayload(form, { lang, requestId, vehicles }) {
    const vehicle = vehicles.find((item) => item.id === form.vehicleModelId);
    const trimmed = (field) => form[field].trim();
    return {
        requestId,
        lang,
        name: trimmed('name'),
        email: trimmed('email'),
        phone: trimmed('phone'),
        vehicleModelId: vehicle?.id ?? '',
        vehicleName: vehicle?.name ?? '',
        travelDate: form.travelDate,
        startTime: form.startTime,
        hours: trimmed('hours') ? Number(form.hours) : null,
        passengers: Number(form.passengers),
        pickup: trimmed('pickup'),
        itinerary: trimmed('itinerary'),
        luggage: trimmed('luggage'),
        notes: trimmed('notes'),
        website: form.website,
    };
}
