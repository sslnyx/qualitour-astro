import assert from 'node:assert/strict';
import test from 'node:test';
import { isSitePage, siteGate, SITE_BUILD_HEADER } from '../src/lib/cms/site-gate.mjs';

const env = { SITE_BUILD_KEY: 'k'.repeat(64) };
const get = (path, headers = {}, method = 'GET') => new Request('https://qualitour.qualitour.workers.dev' + path, { method, headers });

test('page paths are gated; admin, API, media and the image fallback are not', () => {
  for (const path of ['/', '/zh', '/tours', '/tours/x', '/zh/tours/x', '/tours/style/cruises', '/tours/destination/geo-ca', '/faq', '/zh/contact', '/booking-status', '/zh/booking-status', '/404', '/500'])
    assert.equal(isSitePage(path), true, path);
  for (const path of ['/_emdash/admin', '/_emdash/api/media/file/a.webp', '/api/transfer/catalog', '/book/manage/abc', '/_image', '/_astro/a.js', '/cms-proof/tours/x', '/native-proof/zh', '/img/a.webp'])
    assert.equal(isSitePage(path), false, path);
});

test('a visitor is redirected to the static site with the same path and query', () => {
  const response = siteGate(get('/tours/x?lang=zh'), env);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), 'https://qualitour-site.qualitour.workers.dev/tours/x?lang=zh');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(siteGate(get('/'), { ...env, PUBLIC_SITE_ORIGIN: 'https://qualitour.ca' }).headers.get('Location'), 'https://qualitour.ca/');
});

test('only the exact build key renders a page', () => {
  assert.equal(siteGate(get('/tours/x', { [SITE_BUILD_HEADER]: env.SITE_BUILD_KEY }), env), null);
  for (const bad of ['', 'wrong', env.SITE_BUILD_KEY + 'x', env.SITE_BUILD_KEY.slice(1)])
    assert.equal(siteGate(get('/tours/x', { [SITE_BUILD_HEADER]: bad }), env).status, 302, JSON.stringify(bad));
});

test('without a configured key the gate is off, and non-page or non-GET requests pass', () => {
  assert.equal(siteGate(get('/tours/x'), {}), null);
  assert.equal(siteGate(get('/tours/x'), { SITE_BUILD_KEY: '' }), null);
  assert.equal(siteGate(get('/_emdash/admin'), env), null);
  assert.equal(siteGate(get('/tours/x', {}, 'POST'), env), null);
});
