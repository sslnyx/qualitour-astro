import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

async function loadWithCache(value, name, worker = false) {
    const previousCwd = process.cwd();
    const previousFetch = globalThis.fetch;
    const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const directory = await mkdtemp(path.join(tmpdir(), 'qualitour-transfer-cache-'));
    let apiCalls = 0;
    try {
        await mkdir(path.join(directory, '.astro/zaui-cache'), { recursive: true });
        await writeFile(path.join(directory, '.astro/zaui-cache/transfer-routes.json'), JSON.stringify(value));
        process.chdir(directory);
        if (worker) Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Cloudflare-Workers' } });
        globalThis.fetch = async () => { apiCalls++; throw new Error('Live API must not be needed for saved routes'); };
        const module = await import(new URL(`../src/lib/zaui/zaui.ts?test=${name}`, import.meta.url));
        const routes = await module.getPrivateTransfersWithPricing();
        assert.equal(apiCalls, 0);
        return routes;
    } finally {
        globalThis.fetch = previousFetch;
        if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
        else delete globalThis.navigator;
        process.chdir(previousCwd);
        await rm(directory, { recursive: true, force: true });
    }
}

test('an empty fresh cache falls back to the saved nine transfer routes without calling Zaui', async () => {
    const routes = await loadWithCache([], 'empty');
    assert.equal(routes.length, 9);
    assert.equal(routes[0].startingPrice, '465');
    assert.equal(routes[0].reverseStartingPrice, '435');
    assert.equal(routes.find(r => r.toLocation === 'Seattle').reverseStartingPrice, '1050');
    assert.ok(routes.every(r => r.vehicles.length > 0));
});

test('a malformed nonempty cache falls back rather than rendering invalid routes', async () => {
    const routes = await loadWithCache([{}], 'invalid');
    assert.equal(routes.length, 9);
    assert.ok(routes.every(r => typeof r.fromLocation === 'string' && r.vehicles.length > 0));
    const missingPrice = routes.find(r => r.toLocation.includes('Zone 1'));
    assert.equal(missingPrice.startingPrice, undefined);
    assert.ok(missingPrice.vehicles.every(v => v.price === 'Contact for price'));
});

test('a valid fresh API cache takes precedence over the historical fallback', async () => {
    const cached = [{ id: 'fresh', name: 'Current route', fromLocation: 'A', toLocation: 'B', imageUrl: '',
        vehicles: [{ seater: '11', activityId: '18', price: '500' }] }];
    assert.deepEqual(await loadWithCache(cached, 'fresh'), cached);
});

test('the saved routes are also available without a filesystem in Workers', async () => {
    const routes = await loadWithCache([], 'worker', true);
    assert.equal(routes.length, 9);
    assert.equal(routes[0].vehicles[0].activityId, '18');
});
