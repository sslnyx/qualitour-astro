import test from 'node:test';import assert from 'node:assert/strict';
import {nativeSiteRoute,nativeSiteWorkerPatterns} from '../src/lib/cms/native-site-policy.mjs';
test('all original visitor page families route to public runtime without swallowing APIs or booking',()=>{
 for(const p of ['/','/zh','/about-us','/zh/faq','/contact','/privacy-policy','/terms','/private-transfers','/visa','/reviews','/tours','/zh/tours/featured','/tours/new-native-tour','/zh/tours/長江七號','/tours/activity/adventure','/tours/destination/canada','/tours/type/cruises','/tours/duration/15-days','/destinations/rockies'])assert.ok(nativeSiteRoute(p),p);
 for(const p of ['/_emdash/admin','/_image','/_astro/file.webp','/logo.svg','/api/transfer/catalog','/book','/zh/book/manage/id','/fr/tours','/zh/foo/bar','/tours/x/y','/native-proof/zh'])assert.equal(nativeSiteRoute(p),null,p);
 assert.ok(nativeSiteWorkerPatterns.includes('/'));assert.ok(nativeSiteWorkerPatterns.includes('/zh/tours/*'));
});
test('normalization retains original extensionless paths and rejects ambiguous encoded route segments',()=>{
 assert.equal(nativeSiteRoute('/zh/tours/hello.html')?.redirect,'/zh/tours/hello');
 assert.equal(nativeSiteRoute('/zh/tours/')?.redirect,'/zh/tours');
 assert.equal(nativeSiteRoute('/zh/')?.redirect,'/zh');
 for(const p of ['/tours/a%2fb','/tours/%2e%2e','/tours/%5cfoo','/tours/%00foo','/tours/%ZZ'])assert.equal(nativeSiteRoute(p),null,p);
 assert.equal(nativeSiteRoute('/tours/featured')?.kind,'featured');
});
test('release config routes all visitor families before static HTML but keeps default cache disabled',async()=>{
 const {readFile}=await import('node:fs/promises');const c=JSON.parse(await readFile(new URL('../../wrangler.qualitour.jsonc',import.meta.url),'utf8'));
 assert.equal(c.cache.enabled,false);assert.equal(c.exports.default.cache.enabled,false);
 for(const p of nativeSiteWorkerPatterns)assert.ok(c.assets.run_worker_first.includes(p),p);
 const worker=await readFile(new URL('../src/emdash-free-worker.ts',import.meta.url),'utf8');assert.ok(worker.includes('nativeSiteRoute(pathname)'));
});
