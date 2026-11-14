import assert from 'node:assert/strict';
import test from 'node:test';
import worker, { isForwardedPath, toCmsRequest, toPublicResponse } from '../site/worker.mjs';

const cms = 'https://qualitour.qualitour.workers.dev';
const pub = 'https://qualitour-site.qualitour.workers.dev';

test('only the CMS-owned paths are forwarded; every page is a static asset', () => {
  for (const path of ['/api/transfer', '/api/transfer/availability', '/book/manage/abc', '/zh/book/return/abc', '/_image', '/_emdash/api/media/file/a.jpg'])
    assert.equal(isForwardedPath(path), true, path);
  for (const path of ['/', '/zh', '/tours', '/tours/x', '/tours/style/cruises', '/book', '/zh/book', '/_emdash/admin', '/_emdash/api/auth/me', '/img/a-600.webp', '/_astro/a.js', '/api/other', '/apix', '/native-proof/x', '/sitemap.xml', '/robots.txt'])
    assert.equal(isForwardedPath(path), false, path);
});

test('a booking POST is presented to the CMS under the CMS origin', async () => {
  const request = new Request(pub + '/api/transfer/availability?x=1', { method: 'POST', headers: { Origin: pub, Referer: pub + '/book', 'Content-Type': 'application/json', Cookie: 'g=1' }, body: '{"a":1}' });
  const out = toCmsRequest(request, cms);
  assert.equal(out.url, cms + '/api/transfer/availability?x=1');
  assert.equal(out.headers.get('Origin'), cms);
  assert.equal(out.headers.get('Referer'), cms + '/book');
  assert.equal(out.headers.get('Cookie'), 'g=1');
  assert.equal(out.headers.get('X-Forwarded-Host'), 'qualitour-site.qualitour.workers.dev');
  assert.equal(await out.text(), '{"a":1}');
});

test('a foreign Origin is never rewritten, so the CMS origin check still rejects it', () => {
  const out = toCmsRequest(new Request(pub + '/api/transfer/quotes', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: '{}' }), cms);
  assert.equal(out.headers.get('Origin'), 'https://evil.example');
  const spoof = toCmsRequest(new Request(pub + '/api/transfer/quotes', { method: 'POST', headers: { Origin: pub + '.evil.example' }, body: '{}' }), cms);
  assert.equal(spoof.headers.get('Origin'), pub + '.evil.example');
});

test('redirects point back at the public origin; other answers pass through untouched', async () => {
  const redirect = toPublicResponse(new Response(null, { status: 302, headers: { Location: cms + '/book/manage/x' } }), cms, pub);
  assert.equal(redirect.headers.get('Location'), pub + '/book/manage/x');
  const other = new Response('x', { headers: { Location: 'https://stripe.example/pay' } });
  assert.equal(toPublicResponse(other, cms, pub), other);
});

test('the Worker serves pages from assets and forwards CMS paths over the binding', async () => {
  const seen = [];
  const env = { CMS_ORIGIN: cms, ASSETS: { fetch: r => { seen.push(['asset', new URL(r.url).pathname]); return new Response('page'); } }, CMS: { fetch: r => { seen.push(['cms', r.url, r.headers.get('Origin')]); return new Response('{}'); } } };
  await worker.fetch(new Request(pub + '/tours'), env);
  await worker.fetch(new Request(pub + '/api/transfer/catalog', { headers: { Origin: pub } }), env);
  assert.deepEqual(seen, [['asset', '/tours'], ['cms', cms + '/api/transfer/catalog', cms]]);
});
