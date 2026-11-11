import { mkdir, open, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validateTransferSnapshot, validPriceDate } from '../../src/lib/zaui/transfer-snapshot.ts';
import { plainText } from '../../src/lib/seo.ts';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function createZauiRequest({ token, accountId, userId, url = 'https://qualitour.zaui.net/zapi/', fetchImpl = fetch, wait = pause, timeoutMs = 60000 }) {
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'qualitour.zaui.net' || endpoint.username || endpoint.password) throw Error('Unexpected Zaui API destination');
  if (!token || !Number.isInteger(accountId) || !Number.isInteger(userId)) throw Error('Missing Zaui credentials');
  return async (methodName, params = {}) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetchImpl(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zapiToken: token, zapiAccountId: accountId, zapiUserId: userId, zapiMethod: { methodName, ...params } }),
          signal: AbortSignal.timeout(timeoutMs), redirect: 'error' });
      } catch {
        if (attempt === 2) throw Error('Zaui network request failed or timed out after3 attempts');
        await wait(2000 * 2 ** attempt); continue;
      }
      let body;
      try { body = await response.json(); } catch { /* Error pages need not be JSON. */ }
      const apiError = String(body?.response?.error ?? 'missing');
      const method = body?.response?.methodResponse;
      const methodError = String(method?.methodErrorCode ?? 'missing');
      if (response.ok && apiError === '0' && methodError === '0') return method;
      const transient = [408, 429, 500, 502, 503, 504].includes(response.status) || apiError === '2';
      if (transient && attempt < 2) {
        const retry = response.headers.get('Retry-After');
        const serverDelay = retry == null ? 0 : /^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now());
        if (serverDelay > 120000) throw Error('Zaui requests a long back-off; retry the manual sync later');
        await wait(Math.max(Number.isFinite(serverDelay) ? serverDelay : 0, 2000 * 2 ** attempt)); continue;
      }
      // Never include response messages/bodies or authentication values in errors.
      const safe = code => /^\d+$/.test(code) ? code : 'missing';
      throw Error(`Zaui request failed: HTTP${response.status}, API${safe(apiError)}, method${safe(methodError)}`);
    }
  };
}

function tomorrow(now, timezone) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const date = new Date(day + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function activityPrice(activity) {
  const input = activity.allowedPassengers?.passengerType;
  const passengers = Array.isArray(input) ? input : input ? [input] : [];
  const prices = passengers.map(p => p.basePrice).filter(p => typeof p === 'string' && p.trim());
  if (!prices.length || prices.length !== passengers.length) throw Error('Incomplete activity passenger pricing');
  const normalized = prices.map(p => {
    if (!/^\$?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(p.trim())) throw Error('Unrecognized Zaui price format');
    return Number(p.replace(/[$,\s]/g, '')).toFixed(2);
  });
  return new Set(normalized).size === 1 ? normalized[0] : 'Contact for price';
}

const safeImage = value => typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';

export async function collectTransferSnapshot({ definitions, request, priceDate, now = () => new Date(), wait = pause, onProgress = () => {} }) {
  if (!Array.isArray(definitions) || definitions.length !== 9 || definitions.some(r => !Array.isArray(r.vehicles) || !Array.isArray(r.reverseActivityIds))) throw Error('Invalid transfer route configuration');
  const entries = definitions.flatMap(r => [...r.vehicles, ...r.reverseActivityIds]);
  const ids = [...new Set(entries.map(v => v.activityId))];
  if (entries.length !== 34 || ids.length !== 32) throw Error('Incomplete transfer route configuration');
  const settings = await request('zapiGetSystemInformation');
  const currency = settings.currencySettings?.isoCode;
  const timezone = settings.systemTimeZoneAsString;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) throw Error('Missing verified Zaui currency');
  if (typeof timezone !== 'string' || !timezone) throw Error('Missing Zaui timezone');
  new Intl.DateTimeFormat('en', { timeZone: timezone }).format();
  priceDate ||= tomorrow(now(), timezone);
  if (!validPriceDate(priceDate)) throw Error('Invalid price date; use YYYY-MM-DD');
  const products = new Map();
  for (const [index, id] of ids.entries()) {
    if (index > 0) await wait(2000);
    const start = performance.now();
    const { activity } = await request('zapiGetActivityDetailsByActivityId', { activityId: Number(id), activityDate: priceDate });
    if (!activity || String(activity.activityId) !== id || !plainText(activity.activityName || '')) throw Error('Missing or mismatched activity ' + id);
    if (activity.activityDate !== priceDate) throw Error('Zaui activity price date mismatch for activity ' + id);
    if (!Object.hasOwn(activity, 'imageUrl') || (typeof activity.description !== 'string' && typeof activity.shortDescription !== 'string')) throw Error('Incomplete activity details for activity ' + id);
    const description = typeof activity.description === 'string' && activity.description ? activity.description : activity.shortDescription;
    products.set(id, { price: activityPrice(activity), details: { activityName: plainText(activity.activityName),
      description: typeof description === 'string' ? plainText(description) : '', imageUrl: safeImage(activity.imageUrl) } });
    onProgress({ index: index + 1, total: ids.length, activityId: id, milliseconds: Math.round(performance.now() - start) });
  }
  const routes = definitions.map(r => ({ id: r.id, name: r.name, fromLocation: r.fromLocation, toLocation: r.toLocation,
    imageUrl: products.get(r.vehicles[0].activityId).details.imageUrl, currency, priceDate,
    ...Object.fromEntries(['vehicles', 'reverseActivityIds'].map(key => [key, r[key].map(v => ({
      seater: v.seater, activityId: v.activityId, ...products.get(v.activityId), currency, priceDate,
    }))])) }));
  return validateTransferSnapshot({ schemaVersion: 1, source: 'zaui', fetchedAt: now().toISOString(), priceDate,
    timezone, currency, activityCount: ids.length, routes });
}

export async function synchronizeTransfers({ outputPath, historyDirectory = path.join(path.dirname(outputPath), '.zaui-history'), ...options }) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  let lock;
  try { lock = await open(outputPath + '.lock', 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw Error('Another Zaui sync is running; inspect its lock before retrying'); throw error; }
  const temporary = outputPath + '.' + randomUUID() + '.tmp';
  try {
    await lock.writeFile(String(process.pid));
    const snapshot = await collectTransferSnapshot(options);
    const bytes = JSON.stringify(snapshot, null, 2) + '\n';
    let previous;
    try { previous = await readFile(outputPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    let backupPath = null;
    if (previous) {
      await mkdir(historyDirectory, { recursive: true });
      backupPath = path.join(historyDirectory, snapshot.fetchedAt.replace(/[:.]/g, '-') + '-' + createHash('sha256').update(previous).digest('hex').slice(0, 12) + '.json');
      await writeFile(backupPath, previous, { mode: 0o600 });
    }
    await writeFile(temporary, bytes, { mode: 0o644 });
    await rename(temporary, outputPath);
    return { snapshot, backupPath, bytes: Buffer.byteLength(bytes) };
  } finally {
    await unlink(temporary).catch(() => {});
    await lock.close();
    await unlink(outputPath + '.lock');
  }
}
