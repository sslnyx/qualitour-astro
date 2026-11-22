export const VEHICLE_RELEASE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function vehicleReleaseId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !VEHICLE_RELEASE_ID_PATTERN.test(value)) throw new Error('SITE_VEHICLE_RELEASE_ID must be a lowercase UUID');
  return value;
}

export function markerForVehicleRelease(id) {
  return `data-vehicle-website-release="${id}"`;
}

export function vehicleReleasePhotoPaths(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?:src|href)="(\/_vehicle-release\/${escaped}\/[a-z0-9][a-z0-9-]{0,63}\\.(?:jpg|png|webp))"`, 'g');
  return [...html.matchAll(pattern)].map(match => match[1]);
}

// A missing marker is intentionally legacy: it lets a first rollout start from no snapshot. A malformed value is
// not legacy, because silently dropping it could roll back approved fleet data.
export function vehicleReleaseIdFromManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Object.hasOwn(manifest, 'vehicleWebsiteReleaseId')) return null;
  return vehicleReleaseId(manifest.vehicleWebsiteReleaseId);
}
