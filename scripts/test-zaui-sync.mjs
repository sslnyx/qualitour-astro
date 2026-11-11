import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import definitions from './zaui-route-map.json' with { type: 'json' };
import * as sync from './lib/zaui-sync.mjs';
import { validateTransferSnapshot } from '../src/lib/zaui/transfer-snapshot.ts';

const now = () => new Date('2026-11-11T08:30:00Z');
const immediate = async () => {};
const product = id => ({ activityId: String(id), activityDate: '2026-11-12', activityName: `Transfer ${id}`, description: '<p>Airport transfer</p>',
  imageUrl: 'https://example.com/transfer.jpg', allowedPassengers: { passengerType: { basePrice: '$1,234.50' } },
  internalNotes: 'PRIVATE', zapiToken: 'NEVER-PUBLISH', activityTimes: { inventory: 'PRIVATE' } });
const request = async (method, params) => method === 'zapiGetSystemInformation'
  ? { currencySettings: { isoCode: 'CAD' }, systemTimeZoneAsString: 'America/Vancouver' }
  : { activity: { ...product(params.activityId), activityDate: params.activityDate } };
const collect = options => sync.collectTransferSnapshot({ definitions, request, now, wait: immediate, ...options });

test('manual collector calls each of32 products once and preserves all9 route mappings', async () => {
  const ids = [];
  const snapshot = await collect({ request: async (method, params) => {
    if (params?.activityId) ids.push(params.activityId);
    return request(method, params);
  } });
  assert.equal(ids.length, 32);
  assert.equal(new Set(ids).size, 32);
  assert.equal(snapshot.routes.length, 9);
  assert.equal(snapshot.activityCount, 32);
  assert.equal(snapshot.currency, 'CAD');
  assert.equal(snapshot.priceDate, '2026-11-12');
  assert.equal(snapshot.routes[0].vehicles[0].price, '1234.50');
  assert.equal(snapshot.routes[0].vehicles[0].details.description, 'Airport transfer');
  assert.equal(snapshot.routes[0].vehicles[0].activityId, '18');
  assert.equal(snapshot.routes[1].reverseActivityIds[0].activityId, '20');
});

test('public snapshot contains only allowed product data', async () => {
  const output = JSON.stringify(await collect());
  for (const privateValue of ['PRIVATE', 'NEVER-PUBLISH', 'internalNotes', 'activityTimes', 'zapiToken']) assert.ok(!output.includes(privateValue));
});

test('price date uses the account day rather than UTC day at midnight', async () => {
  const snapshot = await collect({ now: () => new Date('2026-11-11T03:30:00Z') });
  assert.equal(snapshot.priceDate, '2026-11-11');
});

test('missing or wrong activity IDs fail instead of publishing partial data', async () => {
  for (const activity of [undefined, { ...product(18), activityId: '999' }]) {
    await assert.rejects(collect({ request: async (method, params) => method === 'zapiGetSystemInformation'
      ? request(method, params) : { activity } }), /activity/i);
  }
});

test('incomplete product fields and wrong returned price dates stop synchronization', async () => {
  for (const activity of [{ activityId: '18', activityName: 'Partial product' },
    { ...product(18), activityDate: '2026-11-13' }, { ...product(18), activityDate: undefined }]) {
    await assert.rejects(collect({ request: async (method, params) => method === 'zapiGetSystemInformation'
      ? request(method, params) : { activity } }), /incomplete|date/i);
  }
});

test('truncated route configuration is refused before making any API request', async () => {
  await assert.rejects(collect({ definitions: definitions.slice(0, 1), request: async () => assert.fail('must not fetch') }), /configuration/i);
});

test('currency and date must be verified rather than inferred', async () => {
  await assert.rejects(collect({ priceDate: '2026-02-30' }), /date/i);
  await assert.rejects(collect({ request: async (method, params) => method === 'zapiGetSystemInformation'
    ? { currencySettings: {}, systemTimeZoneAsString: 'America/Vancouver' } : request(method, params) }), /currency/i);
});

test('different passenger fares are not presented as an invented per-vehicle minimum', async () => {
  const snapshot = await collect({ request: async (method, params) => method === 'zapiGetSystemInformation'
    ? request(method, params) : { activity: { ...product(params.activityId), allowedPassengers: {
      passengerType: [{ basePrice: '$100.00' }, { basePrice: '$50.00' }],
    } } } });
  assert.equal(snapshot.routes[0].vehicles[0].price, 'Contact for price');
});

test('snapshot schema rejects coerced metadata and accidental private fields', async () => {
  const good = await collect();
  for (const mutate of [s => { s.currency = ['CAD']; }, s => { s.routes[0].vehicles[0].activityId = 18; },
    s => { s.routes[0].vehicles[0].price = 100; }, s => { s.rawApiResponse = 'PRIVATE'; },
    s => { s.routes[0].vehicles[0].details.secret = 'PRIVATE'; }]) {
    const broken = structuredClone(good); mutate(broken);
    assert.throws(() => validateTransferSnapshot(broken), /Invalid transfer snapshot/);
  }
});

test('successful sync writes a parseable snapshot and archives previous good bytes', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'zaui-sync-'));
  try {
    const outputPath = path.join(folder, 'routes.json');
    const old = '{"previous":"good"}\n';
    await writeFile(outputPath, old);
    const result = await sync.synchronizeTransfers({ outputPath, historyDirectory: path.join(folder, 'history'), definitions, request, now, wait: immediate });
    assert.equal(JSON.parse(await readFile(outputPath, 'utf8')).routes.length, 9);
    assert.equal(await readFile(result.backupPath, 'utf8'), old);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('failed sync keeps the previous JSON byte-for-byte', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'zaui-sync-'));
  try {
    const outputPath = path.join(folder, 'routes.json');
    await writeFile(outputPath, 'LAST GOOD');
    await assert.rejects(sync.synchronizeTransfers({ outputPath, definitions, request: async () => { throw Error('API offline'); }, now, wait: immediate }), /API offline/);
    assert.equal(await readFile(outputPath, 'utf8'), 'LAST GOOD');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

test('competing manual sync refuses to fetch or replace another writer', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'zaui-sync-'));
  try {
    const outputPath = path.join(folder, 'routes.json');
    await writeFile(outputPath + '.lock', 'another process');
    await assert.rejects(sync.synchronizeTransfers({ outputPath, definitions, request: async () => assert.fail('must not fetch') }), /sync.*running/i);
    assert.equal(await readFile(outputPath + '.lock', 'utf8'), 'another process');
  } finally { await rm(folder, { recursive: true, force: true }); }
});

function client(fetchImpl, wait = immediate) {
  return sync.createZauiRequest({ token: 'SECRET', accountId: 1, userId: 7, fetchImpl, wait });
}
const response = (status, value, headers = {}) => new Response(JSON.stringify(value), { status, headers });
const ok = { response: { error: '0', methodResponse: { methodErrorCode: '0', activity: product(18) } } };

test('HTTP200 with method-level error is rejected without logging response content', async () => {
  const call = client(async () => response(200, { response: { error: '0', methodResponse: { methodErrorCode: '53', methodErrorMessage: 'SECRET' } } }));
  await assert.rejects(call('zapiGetActivityDetailsByActivityId', { activityId: 18 }), error => /53/.test(error.message) && !error.message.includes('SECRET'));
});

test('503 Retry-After is respected before a successful retry', async () => {
  let calls = 0; const waits = [];
  const call = client(async () => ++calls === 1 ? response(503, { response: { error: '2' } }, { 'Retry-After': '3' }) : response(200, ok), async ms => waits.push(ms));
  assert.equal((await call('zapiGetActivityDetailsByActivityId', { activityId: 18 })).activity.activityId, '18');
  assert.equal(calls, 2); assert.equal(waits[0], 3000);
});

test('permanent authentication failure is not retried', async () => {
  let calls = 0;
  const call = client(async () => { calls++; return response(401, { response: { error: '1' } }); });
  await assert.rejects(call('zapiGetSystemInformation'), /401/); assert.equal(calls, 1);
});
