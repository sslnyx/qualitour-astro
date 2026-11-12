import assert from 'node:assert/strict';
import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveImportTarget } from './emdash-import-target.mjs';

const jsonFile = async path => JSON.parse(await readFile(path, 'utf8'));

function httpError(method, url, response, payload) {
  const code = payload?.error?.code || 'unknown';
  return Object.assign(new Error(`${method} ${url.pathname} failed: ${response.status} ${code}`), {
    status: response.status, code,
  });
}

/** Same-origin transport using existing approved credentials, never redirects. */
export function createImportClient(target, {
  localStatePath = '.astro/emdash-bulk-auth.json',
  credentialPath = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'emdash', 'auth.json'),
  fetchImpl = fetch,
} = {}) {
  const checked = resolveImportTarget({ target: target.kind, base: target.origin });
  let refreshPromise;

  async function credentials(forceRefresh = false) {
    const store = await jsonFile(credentialPath);
    const current = store[checked.origin];
    assert.ok(current?.accessToken && current?.refreshToken, 'Approved EmDash CLI login missing for this cloud test origin');
    if (!forceRefresh && Date.parse(current.expiresAt) > Date.now() + 60000) return current;
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const url = new URL('/_emdash/api/oauth/token/refresh', checked.origin);
        const response = await fetchImpl(url, {
          method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
          headers: { ...(current.customHeaders || {}), 'Content-Type': 'application/json', Origin: checked.origin, 'X-EmDash-Request': '1' },
          body: JSON.stringify({ refresh_token: current.refreshToken, grant_type: 'refresh_token' }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw httpError('POST', url, response, payload);
        const refreshed = payload.data || payload;
        assert.ok(typeof refreshed.access_token === 'string' && Number.isFinite(refreshed.expires_in) && refreshed.expires_in > 0, 'Invalid CLI credential refresh response');
        // Merge a fresh store so unrelated projects' credentials are preserved.
        const latest = await jsonFile(credentialPath);
        assert.equal(latest[checked.origin]?.accessToken, current.accessToken, 'CLI credentials changed during refresh; retry the import');
        latest[checked.origin] = {
          ...current, accessToken: refreshed.access_token,
          refreshToken: refreshed.refresh_token || current.refreshToken,
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        };
        const tmp = `${credentialPath}.qualitour-${process.pid}.partial`;
        await writeFile(tmp, JSON.stringify(latest, null, 2) + '\n', { mode: 0o600 });
        await chmod(tmp, 0o600);
        await rename(tmp, credentialPath);
        return latest[checked.origin];
      })().finally(() => { refreshPromise = undefined; });
    }
    return refreshPromise;
  }

  async function authHeaders(forceRefresh = false) {
    if (checked.kind === 'cloud-free') {
      const cred = await credentials(forceRefresh);
      return { ...(cred.customHeaders || {}), Authorization: `Bearer ${cred.accessToken}` };
    }
    const state = await jsonFile(localStatePath);
    const cookie = (state.cookies || []).filter(x => x.domain.replace(/^\./, '') === '127.0.0.1')
      .map(x => `${x.name}=${x.value}`).join('; ');
    assert.ok(cookie, 'Local login missing');
    return { Cookie: cookie };
  }

  async function request(path, { method = 'GET', body, form, binary, contentType, anonymous = false } = {}) {
    const url = new URL(path, checked.origin);
    assert.ok(url.origin === checked.origin && !url.username && !url.password, 'Request escaped the authorized import origin');
    let serialized = body;
    if (body !== undefined) {
      serialized = JSON.stringify(body);
      assert.ok(Buffer.byteLength(serialized) < 1.5 * 1024 * 1024, 'Request exceeds reviewed JSON size budget');
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = anonymous ? {} : {
        ...await authHeaders(attempt > 0), 'X-EmDash-Request': '1', Origin: checked.origin,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      if (binary !== undefined) {
        headers['Content-Type'] = contentType;
        headers['Content-Length'] = String(binary.length);
      }
      const response = await fetchImpl(url, {
        method, headers, body: binary ?? form ?? serialized,
        redirect: 'manual', signal: AbortSignal.timeout(180000),
      });
      if (anonymous) return response;
      // A rejected authentication attempt cannot have committed the mutation.
      // No automatic retry is made for timeouts, 5xx, conflicts or unknown writes.
      if (response.status === 401 && checked.kind === 'cloud-free' && attempt === 0) {
        await response.arrayBuffer();
        continue;
      }
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) throw httpError(method, url, response, payload);
      return payload.data;
    }
    throw new Error('Import authentication retry exhausted');
  }
  return { request };
}
