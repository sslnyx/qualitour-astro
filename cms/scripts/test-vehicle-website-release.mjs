import assert from 'node:assert/strict';
import { isVehicleWebsiteReleaseId, vehicleWebsiteReleasePhotoFilename, vehicleWebsiteReleaseReadyResponse } from '../src/lib/cms/vehicle-website-release.mjs';

const id = '2f5c2d8e-8afd-4e4b-923b-208398d96049';
assert.equal(isVehicleWebsiteReleaseId(id), true);
assert.equal(isVehicleWebsiteReleaseId('../bad'), false);
assert.equal(vehicleWebsiteReleasePhotoFilename('sienna-7', 'image/webp'), 'sienna-7.webp');
assert.equal(vehicleWebsiteReleasePhotoFilename('../sienna', 'image/webp'), null);
let reads = 0;
const env = { SITE_BUILD_KEY: 'test-key', TRANSFER_DB: { prepare(sql) { reads++; assert.match(sql, /vehicle_website_state/); return { bind(value) { assert.equal(value, id); return { first: async () => ({ id: value }) }; } }; } } };
const signed = new Request(`https://example.test/_vehicle-release/${id}/ready`, { headers: { 'X-Qualitour-Site-Build': 'test-key' } });
assert.equal((await vehicleWebsiteReleaseReadyResponse(signed, env, new URL(signed.url).pathname)).status, 200);
assert.equal(reads, 1);
const unsigned = new Request(`https://example.test/_vehicle-release/${id}/ready`);
assert.equal((await vehicleWebsiteReleaseReadyResponse(unsigned, env, new URL(unsigned.url).pathname)).status, 404);
assert.equal(reads, 1, 'unauthenticated readiness check must not read D1');
console.log('vehicle website release endpoint helpers passed');
