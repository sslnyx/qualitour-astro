const API = 'https://api.github.com';
const REPOSITORY = 'sslnyx/qualitour-astro';
const WORKFLOW = 'site-release.yml';
const BASE = `/repos/${REPOSITORY}/actions/workflows/${WORKFLOW}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const RUN_QUERY = new Map([
  ['per_page', /^(?:[1-9]|[1-9][0-9]|100)$/],
  ['page', /^(?:[1-9]|[1-9][0-9]{0,5})$/],
  ['branch', /^main$/],
  ['event', /^workflow_dispatch$/],
  ['created', /^>=\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/],
  ['status', /^(?:queued|in_progress|completed)$/],
]);

const noStore = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const reject = (status = 404) => new Response(status === 400 ? 'Bad request' : 'Not found', { status, headers: noStore });
const actionHeaders = token => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2026-03-10',
  'User-Agent': 'qualitour-vehicle-release-actions',
});

function allowedRunQuery(url) {
  const seen = new Set();
  for (const [key, value] of url.searchParams) {
    if (seen.has(key) || !RUN_QUERY.get(key)?.test(value)) return false;
    seen.add(key);
  }
  return true;
}

function githubPath(url) {
  if (url.pathname === `${BASE}/runs` && allowedRunQuery(url)) return `${BASE}/runs${url.search}`;
  const run = url.pathname.match(new RegExp(`^/repos/${REPOSITORY}/actions/runs/([1-9][0-9]{0,18})(/jobs)?$`));
  if (!run) return null;
  if (!url.search) return url.pathname;
  return run[2] && url.search === '?filter=latest&per_page=100' ? url.pathname + url.search : null;
}

async function dispatchBody(request) {
  const text = await request.text();
  if (text.length > 512) return null;
  try {
    const body = JSON.parse(text);
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'inputs,ref') return null;
    if (body.ref !== 'main' || !body.inputs || typeof body.inputs !== 'object' || Array.isArray(body.inputs) || Object.keys(body.inputs).join(',') !== 'vehicle_release_id') return null;
    return typeof body.inputs.vehicle_release_id === 'string' && UUID.test(body.inputs.vehicle_release_id) ? body : null;
  } catch { return null; }
}

async function stillDispatching(env, releaseId) {
  const db = env?.TRANSFER_DB;
  if (!db?.prepare) return false;
  const row = await db.prepare(
    "SELECT r.id FROM vehicle_website_state s JOIN vehicle_website_releases r ON r.id = s.latest_release_id WHERE s.id = 1 AND r.id = ? AND r.state = 'dispatching'",
  ).bind(releaseId).first();
  return row?.id === releaseId;
}

async function githubResponse(response) {
  // Workers supports "manual" for stopping a redirect at the service boundary.
  if (response.status >= 300 && response.status < 400) return new Response('Unexpected GitHub redirect', { status: 502, headers: noStore });
  if (response.status === 204) return new Response(null, { status: 204, headers: noStore });
  const body = await response.text();
  if (body.length > 1_000_000) return new Response('GitHub response too large', { status: 502, headers: noStore });
  return new Response(body, { status: response.status, headers: { ...noStore, 'Content-Type': 'application/json; charset=utf-8' } });
}

// Service-binding only. The caller's URL is parsed as a GitHub path, but no caller header, host, token, redirect,
// body shape, or unrecognised query key can cross this boundary.
export async function handleVehicleReleaseActions(request, env, fetchImpl = fetch) {
  const token = env?.GITHUB_DISPATCH_TOKEN;
  if (typeof token !== 'string' || !token) return new Response('Unavailable', { status: 503, headers: noStore });
  const url = new URL(request.url);
  if (request.method === 'POST' && url.pathname === `${BASE}/dispatches` && !url.search) {
    const body = await dispatchBody(request);
    if (!body) return reject(400);
    if (!await stillDispatching(env, body.inputs.vehicle_release_id)) return new Response('Release is no longer current', { status: 409, headers: noStore });
    const response = await fetchImpl(`${API}${BASE}/dispatches`, { method: 'POST', headers: { ...actionHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify(body), redirect: 'manual', signal: AbortSignal.timeout(10_000) });
    return githubResponse(response);
  }
  if (request.method !== 'GET') return reject();
  const path = githubPath(url);
  if (!path) return reject();
  const response = await fetchImpl(`${API}${path}`, { method: 'GET', headers: actionHeaders(token), redirect: 'manual', signal: AbortSignal.timeout(10_000) });
  return githubResponse(response);
}
