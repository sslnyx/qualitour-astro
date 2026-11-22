import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { markerForVehicleRelease, vehicleReleaseId, vehicleReleasePhotoPaths } from './lib/vehicle-release-site.mjs';

const id = vehicleReleaseId(process.env.SITE_VEHICLE_RELEASE_ID);
if (!id) throw new Error('SITE_VEHICLE_RELEASE_ID is required to verify a vehicle release build');
const root = resolve(process.env.SITE_OUT_DIR || '.astro/site-release/assets');
const marker = markerForVehicleRelease(id);
for (const file of ['private-transfers.html', 'zh/private-transfers.html']) {
  const html = await readFile(resolve(root, file), 'utf8');
  assert.ok(html.includes(marker), `${file} does not carry the selected vehicle release marker`);
  for (const photo of vehicleReleasePhotoPaths(html, id)) await access(resolve(root, photo.slice(1)));
}
const manifest = JSON.parse(await readFile(resolve(root, 'site-release.json'), 'utf8'));
assert.equal(manifest.vehicleWebsiteReleaseId, id, 'site-release.json has a different vehicle release');
console.log(`verified vehicle website release ${id}`);
