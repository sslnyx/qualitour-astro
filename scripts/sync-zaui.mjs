/** Manual-only; never imported by Astro and never invoked from a build. */
import { readFile } from 'node:fs/promises';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import definitions from './zaui-route-map.json' with { type: 'json' };
import { createZauiRequest, synchronizeTransfers } from './lib/zaui-sync.mjs';

try {
  const { values } = parseArgs({ options: { 'env-file': { type: 'string' }, date: { type: 'string' } }, strict: true });
  const file = values['env-file'] ? parseEnv(await readFile(values['env-file'], 'utf8')) : {};
  const value = key => process.env[key] || file[key];
  const request = createZauiRequest({ token: value('ZAUI_API_TOKEN'), accountId: Number(value('ZAUI_ACCOUNT_ID')),
    userId: Number(value('ZAUI_USER_ID')), url: value('ZAUI_API_URL') || 'https://qualitour.zaui.net/zapi/' });
  const start = performance.now();
  const { snapshot, backupPath, bytes } = await synchronizeTransfers({ definitions, request, priceDate: values.date,
    outputPath: fileURLToPath(new URL('../src/data/zaui-transfer-routes.json', import.meta.url)),
    historyDirectory: fileURLToPath(new URL('../.astro/zaui-sync/history/', import.meta.url)),
    onProgress: p => console.log(`[Zaui sync] ${p.index}/${p.total}: activity ${p.activityId}, ${p.milliseconds}ms`),
  });
  console.log(JSON.stringify({ synchronized: true, routes: snapshot.routes.length, activities: snapshot.activityCount,
    currency: snapshot.currency, priceDate: snapshot.priceDate, fetchedAt: snapshot.fetchedAt, bytes,
    seconds: Math.round((performance.now() - start) / 10) / 100, previousSnapshotBackedUp: !!backupPath }));
} catch (error) {
  console.error('[Zaui sync] Failed; previous snapshot retained. ' + error.message);
  process.exitCode = 1;
}
