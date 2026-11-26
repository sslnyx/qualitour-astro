import {test} from 'node:test';
import assert from 'node:assert/strict';
import {QUOTE_STEPS, emptyQuote, firstStepWithError, quoteErrors, quotePayload, stepErrors} from '../src/lib/charter-quote.mjs';

const filled = {...emptyQuote('mercedes-12'), name: ' Tom ', email: ' tom@qualitour-customer.ca ', travelDate: '2026-12-20', passengers: '9', pickup: 'YVR', itinerary: 'Whistler\nand back'};
const vehicles = [{id: 'mercedes-12', name: 'Mercedes 12'}];

test('a new form keeps the clicked vehicle and leaves the rest empty', () => {
  assert.equal(emptyQuote('mercedes-16').vehicleModelId, 'mercedes-16');
  assert.equal(emptyQuote().vehicleModelId, '');
  assert.equal(emptyQuote().website, '');
});
test('only name, email, date, passengers, pickup and itinerary are required', () => {
  assert.deepEqual(quoteErrors(filled, '2026-11-25'), {});
  assert.deepEqual(Object.keys(quoteErrors(emptyQuote(), '2026-11-25')).sort(), ['email', 'itinerary', 'name', 'passengers', 'pickup', 'travelDate']);
});
test('flags a bad email, a past date, and numbers out of range', () => {
  const errors = quoteErrors({...filled, email: 'tom@', travelDate: '2026-11-24', passengers: '0', hours: '0.2'}, '2026-11-25');
  assert.deepEqual(errors, {email: 'email', travelDate: 'past', passengers: 'passengers', hours: 'hours'});
  assert.equal(quoteErrors({...filled, passengers: '2.5'}, '2026-11-25').passengers, 'passengers');
  assert.equal(quoteErrors({...filled, travelDate: '2026-11-25'}, '2026-11-25').travelDate, undefined);
});
test('sends numbers as numbers, trimmed text, and the vehicle name the visitor saw', () => {
  assert.deepEqual(quotePayload(filled, {lang: 'en', requestId: 'r1', vehicles}), {requestId: 'r1', lang: 'en', name: 'Tom', email: 'tom@qualitour-customer.ca', phone: '', vehicleModelId: 'mercedes-12', vehicleName: 'Mercedes 12', travelDate: '2026-12-20', startTime: '', hours: null, passengers: 9, pickup: 'YVR', itinerary: 'Whistler\nand back', luggage: '', notes: '', website: ''});
  assert.equal(quotePayload({...filled, hours: '6.5'}, {lang: 'zh', requestId: 'r2', vehicles}).hours, 6.5);
});
test('a vehicle that is no longer listed is sent as undecided', () => {
  const payload = quotePayload({...filled, vehicleModelId: 'gone'}, {lang: 'en', requestId: 'r3', vehicles});
  assert.equal(payload.vehicleModelId, '');
  assert.equal(payload.vehicleName, '');
});

test('the three steps ask for every field exactly once: vehicle and time, then the trip, then contact details', () => {
  assert.equal(QUOTE_STEPS.length, 3);
  assert.deepEqual([...QUOTE_STEPS.flat()].sort(), Object.keys(emptyQuote()).filter((field) => field !== 'website').sort());
  assert.ok(QUOTE_STEPS[0].includes('vehicleModelId'));
  assert.ok(QUOTE_STEPS[1].includes('itinerary'));
  assert.ok(QUOTE_STEPS[2].includes('email'));
});
test('a step only reports problems in its own fields', () => {
  assert.deepEqual(Object.keys(stepErrors(emptyQuote(), 0, '2026-11-25')).sort(), ['passengers', 'travelDate']);
  assert.deepEqual(Object.keys(stepErrors(emptyQuote(), 1, '2026-11-25')).sort(), ['itinerary', 'pickup']);
  assert.deepEqual(Object.keys(stepErrors(emptyQuote(), 2, '2026-11-25')).sort(), ['email', 'name']);
  assert.deepEqual(stepErrors({...emptyQuote(), passengers: '9', travelDate: '2026-12-20'}, 0, '2026-11-25'), {});
});
test('sending goes back to the earliest step that has a problem', () => {
  assert.equal(firstStepWithError({email: 'required', travelDate: 'past'}), 0);
  assert.equal(firstStepWithError({email: 'required', pickup: 'required'}), 1);
  assert.equal(firstStepWithError({email: 'email'}), 2);
  assert.equal(firstStepWithError({}), -1);
});
