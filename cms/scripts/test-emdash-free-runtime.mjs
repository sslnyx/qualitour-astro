import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchFreeRuntime, durableExecutionContext } from '../src/lib/cms/free-runtime.mjs';

test('Durable mode forwards the original request and streamed body once, preserving auth and response cookies',async()=>{
 const request=new Request('https://example.test/_emdash/api/content/tours/proof?locale=zh',{method:'PUT',headers:{Authorization:'Bearer synthetic',Cookie:'session=synthetic',Origin:'https://example.test'},body:'{"data":{"title":"測試"}}'});
 const expected=new Response('okay',{status:201,headers:{'Set-Cookie':'test=1; HttpOnly'}});let calls=0;
 const env={EMDASH_CMS_EXECUTION:'durable',CMS_RUNTIME:{idFromName(name){assert.equal(name,'qualitour-cms');return 'object-id';},get(id){assert.equal(id,'object-id');return {async fetch(received){assert.equal(received,request);assert.equal(received.headers.get('Authorization'),'Bearer synthetic');assert.equal(await received.text(),'{"data":{"title":"測試"}}');calls++;return expected;}};}}};
 const handler={fetch(){assert.fail('Astro must not run in the outer Worker in Durable mode');}};
 assert.equal(await fetchFreeRuntime(handler,request,env,{}),expected);assert.equal(calls,1);assert.equal(expected.headers.get('Set-Cookie'),'test=1; HttpOnly');
});

test('Worker fallback preserves the current adapter and fails closed for missing Durable binding or invalid mode',async()=>{
 const request=new Request('https://example.test/');const env={};const context={};
 const handler={fetch(r,e,c){assert.equal(r,request);assert.equal(e,env);assert.equal(c,context);return new Response('worker');}};
 assert.equal(await (await fetchFreeRuntime(handler,request,env,context)).text(),'worker');
 await assert.rejects(async()=>fetchFreeRuntime(handler,new Request('https://example.test/_emdash/admin'),{EMDASH_CMS_EXECUTION:'durable'},context),/binding/i);
 await assert.rejects(async()=>fetchFreeRuntime(handler,request,{EMDASH_CMS_EXECUTION:'typo'},context),/mode/i);
});

test('Durable context attaches deferred work to the owning object and never fakes pass-through behavior',()=>{
 const pending=Promise.resolve();let seen;const exports={};
 const state={exports,waitUntil(value){assert.equal(this,state);seen=value;}};
 const context=durableExecutionContext(state);context.waitUntil(pending);assert.equal(seen,pending);assert.equal(context.exports,exports);
 assert.throws(()=>context.passThroughOnException(),/Durable/);
});

test('Only CMS and tour proof routes use the Durable runtime; build endpoints and static site keep the adapter path',async()=>{
 const seen=[];const handler={fetch(r){seen.push('worker');return new Response();}};
 const env={EMDASH_CMS_EXECUTION:'durable',CMS_RUNTIME:{idFromName(){return 'id';},get(){return {fetch(){seen.push('durable');return new Response();}};}}};
 for(const path of ['/_emdash/admin','/_emdash/api/auth/me','/cms-proof/tours','/zh/cms-proof/tours/proof','/__astro_prerender','/','/zh/','/_astro/app.js'])await fetchFreeRuntime(handler,new Request('https://example.test'+path),env,{});
 assert.deepEqual(seen,['durable','durable','durable','durable','worker','worker','worker','worker']);
});
