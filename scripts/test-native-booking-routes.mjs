import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNativeBookingRouter} from '../src/server/native-booking/router.mjs';
const origin='https://qualitour.qualitour.workers.dev';
const req=path=>new Request(origin+path);
test('customer APIs are intercepted while CMS and regular static routes fall through',async()=>{
 const route=createNativeBookingRouter({fetch:async(r,env)=>{assert.equal(new URL(r.url).pathname,'/api/transfer/catalog');assert.equal(env.TRANSFER_DB,'transfer-only');assert.equal(env.DB,undefined);return new Response('{"sandbox":true}')}});
 const env={TRANSFER_DB:'transfer-only',DB:'cms-database',TRANSFER_SANDBOX_KEY:'sk_test_fake'};
 assert.equal(await route(req('/_emdash/admin'),env,{}),null);assert.equal(await route(req('/api/operations/orders'),env,{}),null);assert.equal(await route(req('/book'),env,{}),null);assert.equal(await (await route(req('/api/transfer/catalog'),env,{})).text(),'{"sandbox":true}');
});
test('deep links keep language shell and original URL while using pretty static asset paths',async()=>{
 const route=createNativeBookingRouter({fetch:async()=>{throw Error('wrong API route')}}),id='00000000-0000-4000-8000-000000000001';
 for(const lang of ['en','zh'])for(const action of ['manage','return','receipt']){
 const r=await route(req(`/book/${action}/${id}?lang=${lang}`),{ASSETS:{fetch:async(r)=>{assert.equal(new URL(r.url).pathname,lang==='zh'?'/zh/book':'/book');return new Response(`<html lang="${lang}">book shell</html>`,{headers:{'Content-Type':'text/html'}})}}},{});
 assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.match(await r.text(),new RegExp(`lang="${lang}"`));
 }
});
test('invalid book paths and methods fail closed rather than reaching CMS fallback',async()=>{
 const route=createNativeBookingRouter({fetch:async()=>new Response('unused')});
 assert.equal((await route(req('/book/return/not-an-id'),{},{})).status,404);
 assert.equal((await route(new Request(origin+'/book/return/00000000-0000-4000-8000-000000000001',{method:'POST'}),{},{})).status,405);
});
