import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyQuote, quoteErrors, quotePayload} from '../src/lib/charter-quote.mjs';

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
