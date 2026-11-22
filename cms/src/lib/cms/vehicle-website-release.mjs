import { hasSiteBuildKey } from './site-gate.mjs';

export const VEHICLE_WEBSITE_RELEASE_HEADER = 'X-Qualitour-Vehicle-Release';
export const VEHICLE_WEBSITE_RELEASE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MODEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PHOTO_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

export function isVehicleWebsiteReleaseId(value) {
  return typeof value === 'string' && VEHICLE_WEBSITE_RELEASE_PATTERN.test(value);
}

export function vehicleWebsiteReleasePhotoFilename(id, photoType) {
  if (!MODEL_ID_PATTERN.test(id) || !PHOTO_TYPES.has(photoType)) return null;
  return `${id}.${PHOTO_TYPES.get(photoType)}`;
}

export function vehicleWebsiteReleasePhotoPath(releaseId, id, photoType) {
  const filename = vehicleWebsiteReleasePhotoFilename(id, photoType);
  return isVehicleWebsiteReleaseId(releaseId) && filename ? `/_vehicle-release/${releaseId}/${filename}` : null;
}

function requiredText(value) {
  return typeof value === 'string' && value.length > 0;
}

function validModel(row) {
  return MODEL_ID_PATTERN.test(row.id) &&
    requiredText(row.name_en) && requiredText(row.name_zh) &&
    Number.isInteger(row.suitable_min) && Number.isInteger(row.suitable_max) &&
    row.suitable_min >= 0 && row.suitable_max >= row.suitable_min &&
    typeof row.description_en === 'string' && typeof row.description_zh === 'string' &&
    (!row.has_photo || vehicleWebsiteReleasePhotoFilename(row.id, row.photo_type));
}

// This is intentionally only callable for a signed site-build request. Visitor requests get the already-built
// static page, and an untrusted header must not make the CMS read a snapshot from TRANSFER_DB.
export async function loadVehicleWebsiteRelease(request, env) {
  const requested = request.headers.get(VEHICLE_WEBSITE_RELEASE_HEADER);
  if (!requested) return null;
  if (!hasSiteBuildKey(request, env)) throw new Error('Vehicle website release requested without a valid site build key');
  if (!isVehicleWebsiteReleaseId(requested)) throw new Error('Vehicle website release id is invalid');
  const db = env?.TRANSFER_DB;
  if (!db?.prepare) throw new Error('TRANSFER_DB is unavailable for vehicle website release');

  const release = await db.prepare(
    'SELECT id, revision FROM vehicle_website_releases WHERE id = ?',
  ).bind(requested).first();
  if (!release || release.id !== requested || !Number.isInteger(release.revision)) {
    throw new Error('Vehicle website release does not exist');
  }
  const result = await db.prepare(
    'SELECT id, name_en, name_zh, seats, suitable_min, suitable_max, description_en, description_zh, sort_order, photo_type, photo_width, photo_height, (photo_data IS NOT NULL) AS has_photo FROM vehicle_website_release_models WHERE release_id = ? ORDER BY sort_order ASC, id ASC',
  ).bind(requested).all();
  const rows = result?.results;
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(validModel)) {
    throw new Error('Vehicle website release models are invalid');
  }
  return {
    id: requested,
    revision: release.revision,
    models: rows.map((row) => ({
      id: row.id,
      name: { en: row.name_en, zh: row.name_zh },
      seats: row.seats,
      suitable: { min: row.suitable_min, max: row.suitable_max },
      description: { en: row.description_en, zh: row.description_zh },
      photo: row.has_photo ? vehicleWebsiteReleasePhotoPath(requested, row.id, row.photo_type) : null,
    })),
  };
}

function decodePhotoData(data, type) {
  if (typeof data !== 'string' || !PHOTO_TYPES.has(type)) return null;
  const dataUrl = data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  const base64 = dataUrl ? dataUrl[2] : data;
  if (dataUrl && dataUrl[1].toLowerCase() !== type) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  try { return Uint8Array.from(atob(base64), char => char.charCodeAt(0)); } catch { return null; }
}

// Kept separate from page loading so the worker can reject an unauthenticated request before it touches D1.
export async function vehicleWebsiteReleasePhotoResponse(request, env, pathname) {
  if (!hasSiteBuildKey(request, env)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const match = pathname.match(/^\/_vehicle-release\/([0-9a-f-]{36})\/([a-z0-9][a-z0-9-]{0,63}\.(?:jpg|png|webp))$/);
  if (!match || !isVehicleWebsiteReleaseId(match[1])) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const [, releaseId, filename] = match;
  const id = filename.replace(/\.(?:jpg|png|webp)$/, '');
  const db = env?.TRANSFER_DB;
  if (!db?.prepare) return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const row = await db.prepare(
    'SELECT m.photo_data, m.photo_type FROM vehicle_website_release_models m JOIN vehicle_website_releases r ON r.id = m.release_id WHERE m.release_id = ? AND m.id = ?',
  ).bind(releaseId, id).first();
  const expected = row && vehicleWebsiteReleasePhotoFilename(id, row.photo_type);
  const body = row && expected === filename ? decodePhotoData(row.photo_data, row.photo_type) : null;
  if (!body) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: { 'Content-Type': row.photo_type, 'Content-Length': String(body.byteLength), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

// A queued GitHub run may wake up after a newer release has been selected. This small, build-key-only endpoint is
// checked immediately before deploy so that stale work can never replace the latest approved snapshot.
export async function vehicleWebsiteReleaseReadyResponse(request, env, pathname) {
  if (!hasSiteBuildKey(request, env)) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const match = pathname.match(/^\/_vehicle-release\/([0-9a-f-]{36})\/ready$/);
  if (!match || !isVehicleWebsiteReleaseId(match[1])) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const db = env?.TRANSFER_DB;
  if (!db?.prepare) return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  const ready = await db.prepare(
    "SELECT r.id FROM vehicle_website_state s JOIN vehicle_website_releases r ON r.id = s.latest_release_id WHERE s.id = 1 AND r.id = ? AND r.state NOT IN ('failed', 'cancelled')",
  ).bind(match[1]).first();
  return new Response(ready?.id === match[1] ? 'ready' : 'not ready', {
    status: ready?.id === match[1] ? 200 : 409,
    headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
