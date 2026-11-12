import { readFile, writeFile, rename, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const CMS_ORIGIN = 'https://qualitour-cms-free-test.qualitour.workers.dev';

/** Build/server only. No generic request method, redirects, or content writes. */
export function createCmsReader({ token = process.env.EMDASH_TOKEN, fetchImpl = fetch,
  credentialPath = join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'emdash', 'auth.json'),
  allowCli = process.env.CI !== 'true',
} = {}) {
  let refreshPromise;
  const jsonFile = async () => JSON.parse(await readFile(credentialPath, 'utf8'));
  async function headers(refresh = false) {
    if (token) return { Authorization: `Bearer ${token}` };
    if (!allowCli) throw new Error('CMS build requires the private EMDASH_TOKEN environment variable');
    let store;
    try { store = await jsonFile(); } catch { throw new Error('Existing CMS CLI login missing; sign in to the approved CMS origin or supply EMDASH_TOKEN'); }
    const current = store[CMS_ORIGIN];
    if (!current?.accessToken || !current?.refreshToken) throw new Error('Existing CMS CLI login missing for the approved origin');
    if (!refresh && Date.parse(current.expiresAt) > Date.now() + 60000) {
      return { ...current.customHeaders, Authorization: `Bearer ${current.accessToken}` };
    }
    if (!refreshPromise) refreshPromise = (async () => {
      const response = await fetchImpl(new URL('/_emdash/api/oauth/token/refresh', CMS_ORIGIN), {
        method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(30000),
        headers: { ...current.customHeaders, 'Content-Type': 'application/json', Origin: CMS_ORIGIN, 'X-EmDash-Request': '1' },
        body: JSON.stringify({ refresh_token: current.refreshToken, grant_type: 'refresh_token' }),
      });
      if (!response.ok) throw new Error(`CMS credential refresh HTTP ${response.status}`);
      const payload = await response.json().catch(()=>{throw new Error('Invalid CMS credential refresh response');}); const next = payload.data || payload;
      if (typeof next.access_token !== 'string' || !Number.isFinite(next.expires_in) || next.expires_in <= 0) throw new Error('Invalid CMS credential refresh');
      const latest = await jsonFile();
      if (latest[CMS_ORIGIN]?.accessToken !== current.accessToken) throw new Error('CMS CLI login changed during refresh; retry');
      latest[CMS_ORIGIN] = { ...current, accessToken: next.access_token, refreshToken: next.refresh_token || current.refreshToken, expiresAt: new Date(Date.now() + next.expires_in * 1000).toISOString() };
      const tmp = `${credentialPath}.qualitour-read-${process.pid}.partial`;
      await writeFile(tmp, JSON.stringify(latest, null, 2) + '\n', { mode: 0o600 });
      await chmod(tmp, 0o600); await rename(tmp, credentialPath);
      return { ...current.customHeaders, Authorization: `Bearer ${next.access_token}` };
    })().finally(() => { refreshPromise = undefined; });
    return refreshPromise;
  }
  async function get(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(60000), headers: { ...await headers(attempt > 0), Accept: 'application/json', 'X-EmDash-Request': '1', Origin: CMS_ORIGIN } });
      if (response.status === 401 && !token && attempt === 0) { await response.body?.cancel(); continue; }
      if (!response.ok) { await response.body?.cancel(); throw new Error(`CMS catalogue HTTP ${response.status}`); }
      const payload = await response.json().catch(()=>{throw new Error('Invalid CMS catalogue JSON');});
      if (payload.success !== true || !payload.data) throw new Error('Invalid CMS catalogue response');
      return payload.data;
    }
    throw new Error('CMS authentication failed');
  }
  async function readPass(locale, limit) {
      if (!['en', 'zh'].includes(locale) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid CMS catalogue request');
      const entries = [], ids = new Set(); let total;
      for (let page = 1; page <= 1000; page++) {
        const url = new URL('/_emdash/api/content/tours', CMS_ORIGIN);
        url.search = new URLSearchParams({ locale, status: 'published', limit: String(limit), page: String(page), orderBy: 'createdAt', order: 'asc' }).toString();
        const data = await get(url);
        if (!Number.isSafeInteger(data.total) || data.total < 0 || data.total > 10000 || !Array.isArray(data.items)) throw new Error('Invalid CMS catalogue page');
        if (total !== undefined && total !== data.total) throw new Error('CMS catalogue changed during pagination; retry');
        total = data.total;
        if (data.items.length !== Math.min(limit, total - entries.length)) throw new Error('Incomplete CMS catalogue page');
        for (const item of data.items) {
          if (item.status !== 'published' || item.locale !== locale || typeof item.id !== 'string' || !item.data) throw new Error('Unexpected non-published or wrong-locale CMS entry');
          if (ids.has(item.id)) throw new Error('Duplicate CMS catalogue page');
          ids.add(item.id); entries.push(item);
        }
        if (entries.length === total) return entries;
      }
      throw new Error('CMS pagination did not terminate');
  }
  return { async listPublished(locale, {limit=25}={}) {
    const first=await readPass(locale,limit), second=await readPass(locale,limit);
    const signature=rows=>JSON.stringify(rows.map(row=>[row.id,row.version,row.updatedAt]));
    if(signature(first)!==signature(second)) throw new Error('CMS catalogue changed between verification passes; retry');
    return second;
  }};
}
