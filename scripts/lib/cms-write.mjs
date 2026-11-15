// Minimal authenticated CMS client for maintenance scripts (writes need the CMS CLI login; EMDASH_TOKEN is read-only).
// Refreshes the stored login the same way src/lib/cms/read-client.mjs does and never prints credentials.
import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolveCmsOrigin } from '../../src/lib/cms/read-client.mjs';

export async function createCmsWriter({ origin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev', credentialPath = `${process.env.XDG_CONFIG_HOME || homedir() + '/.config'}/emdash/auth.json` } = {}) {
  const checked = resolveCmsOrigin(origin);
  // CI: a static API token (scopes content:write, media:write) in EMDASH_WRITE_TOKEN; local runs use the CLI login.
  const staticToken = process.env.EMDASH_WRITE_TOKEN?.trim();
  if (staticToken) return { request: makeRequest(checked, () => ({ Authorization: 'Bearer ' + staticToken }), async () => {}), origin: checked };
  let store = JSON.parse(await readFile(credentialPath, 'utf8'));
  let cred = store[checked];
  if (!cred?.accessToken || !cred?.refreshToken) throw new Error('CMS CLI login missing for ' + checked);
  async function refresh() {
    const response = await fetch(checked + '/_emdash/api/oauth/token/refresh', { method: 'POST', redirect: 'manual', headers: { ...cred.customHeaders, 'Content-Type': 'application/json', Origin: checked, 'X-EmDash-Request': '1' }, body: JSON.stringify({ refresh_token: cred.refreshToken, grant_type: 'refresh_token' }) });
    if (!response.ok) throw new Error('CMS credential refresh HTTP ' + response.status);
    const payload = await response.json(); const next = payload.data || payload;
    store = JSON.parse(await readFile(credentialPath, 'utf8'));
    store[checked] = { ...store[checked], accessToken: next.access_token, refreshToken: next.refresh_token || store[checked].refreshToken, expiresAt: new Date(Date.now() + next.expires_in * 1000).toISOString() };
    const tmp = credentialPath + '.write.partial';
    await writeFile(tmp, JSON.stringify(store, null, 2) + '\n', { mode: 0o600 }); await chmod(tmp, 0o600); await rename(tmp, credentialPath);
    cred = store[checked];
  }
  if (Date.parse(cred.expiresAt) < Date.now() + 60000) await refresh();
  const request = makeRequest(checked, () => ({ ...cred.customHeaders, Authorization: 'Bearer ' + cred.accessToken }), refresh);
  return { request, origin: checked };
}

function makeRequest(checked, authHeaders, refresh) {
  return async function request(method, path, body, { contentType } = {}) {
    const multipart = typeof FormData !== 'undefined' && body instanceof FormData; // the browser sets the multipart boundary itself
    const binary = body instanceof Uint8Array; // raw upload body (signed media upload URL), sent as-is
    const send = () => fetch(checked + path, { method, redirect: 'manual', signal: AbortSignal.timeout(120000), headers: { ...authHeaders(), Accept: 'application/json', ...(multipart ? {} : { 'Content-Type': binary ? contentType : 'application/json' }), 'X-EmDash-Request': '1', Origin: checked }, body: body === undefined ? undefined : multipart || binary ? body : JSON.stringify(body) });
    let response = await send();
    if (response.status === 401) { await refresh(); response = await send(); }
    const text = await response.text();
    let json; try { json = JSON.parse(text); } catch {}
    if (!response.ok) throw Object.assign(new Error(`CMS ${method} ${path} HTTP ${response.status} ${json?.error?.code || ''} ${json?.error?.message || text.slice(0, 120)}`), { status: response.status, body: json });
    return json?.data ?? json;
  };
}
