import test from 'node:test';
import assert from 'node:assert/strict';
import {isNativeProofPath, validateProofTags, scopedCloudflareProvider, withStaticFallback} from '../src/lib/cms/native-cache-policy.mjs';
test('cache entrypoint admits only the bounded native proof routes',()=>{
 for(const path of ['/native-proof/zh','/native-proof/zh/tours/01M77CFJT9M7H2YPYV1J8GF8PV'])assert.ok(isNativeProofPath(path));
 for(const path of ['/zh','/_emdash/admin','/api/transfer/catalog','/book/return/id','/native-proof/zh/anything','/native-proof/zh/tours/a/b','/native-proof/zh/tours/%2e%2e'])assert.equal(isNativeProofPath(path),false);
});
test('native provider retains headers but executes invalidation inside the scoped entrypoint',async()=>{
 const seen=[];const original={name:'cloudflare',setHeaders:()=>new Headers({'Cache-Tag':'tours'}),invalidate(){assert.fail('wrong cache namespace');}};
 const provider=scopedCloudflareProvider(original,async tags=>{seen.push(tags);return {success:true};});
 assert.equal(provider.name,'cloudflare');assert.equal(provider.setHeaders().get('cache-tag'),'tours');await provider.invalidate({tags:['tours','01M77CFJT9M7H2YPYV1J8GF8PV']});assert.deepEqual(seen,[['tours','01M77CFJT9M7H2YPYV1J8GF8PV']]);
 await assert.rejects(scopedCloudflareProvider(original,async()=>({success:false})).invalidate({tags:['tours']}),/invalidation failed/);
});
test('purge bridge rejects malformed or oversized inputs',()=>{
 assert.deepEqual(validateProofTags(['tours','tours']),['tours']);
 for(const value of [null,[],['unsafe tag'],['comma,tag'],['a'.repeat(257)],Array(129).fill('tours')])assert.throws(()=>validateProofTags(value));
});
test('gateway bypasses shared cache for auth or cookies before entrypoint lookup', async()=>{
 const {forwardNativeProof,privateProofResponse}=await import('../src/lib/cms/native-cache-policy.mjs');
 const calls=[];const entry={fetch(...args){calls.push(args);return Promise.resolve(new Response('ok'));}};
 for(const headers of [{},{Authorization:'Bearer synthetic'},{Cookie:'synthetic=1'}])await forwardNativeProof(entry,new Request('https://proof.invalid/native-proof/zh',{headers}));
 assert.equal(calls[0].length,1);for(const args of calls.slice(1))assert.deepEqual(args[1],{cache:'no-store'});
 assert.equal(privateProofResponse(calls[0][0],new Response('ok')),false);
 for(const [request,response] of [[calls[1][0],new Response('ok')],[calls[2][0],new Response('ok')],[calls[0][0],new Response('ok',{headers:{'Set-Cookie':'synthetic=1'}})],[calls[0][0],new Response('missing',{status:404})]])assert.equal(privateProofResponse(request,response),true);
});
test('public query variants share a path cache key while editor signals are rejected before lookup',async()=>{
 const {forwardNativeProof}=await import('../src/lib/cms/native-cache-policy.mjs');const calls=[];const entry={fetch(...args){calls.push(args);return Promise.resolve(new Response('ok'));}};
 for(const search of ['?utm_source=one','?destination=canada&x=random'])await forwardNativeProof(entry,new Request('https://proof.invalid/tours'+search));
 assert.deepEqual(calls.map(x=>x[1]?.cf?.cacheKey),['/tours','/tours']);assert.ok(calls[1][0].url.includes('destination=canada'));
 const before=calls.length;for(const key of ['_preview','_edit']){const response=await forwardNativeProof(entry,new Request('https://proof.invalid/tours?'+key+'=1'));assert.equal(response.status,404);assert.equal(response.headers.get('Cache-Control'),'private, no-store');}assert.equal(calls.length,before);
});

const get=(path,method='GET')=>new Request(`https://example.test${path}`,{method});
const failed=()=>new Response('Content temporarily unavailable',{status:503});
const assetsReturning=response=>({fetch:async()=>response});
test('a failed native render is answered from the matching prerendered page, uncached and labelled',async()=>{
 const asset=new Response('<html>static tour</html>',{status:200,headers:{'Content-Type':'text/html','Cache-Control':'public, max-age=3600','ETag':'"x"'}});
 const result=await withStaticFallback(get('/tours/some-tour'),failed(),assetsReturning(asset));
 assert.equal(result.status,200);assert.equal(await result.text(),'<html>static tour</html>');
 assert.equal(result.headers.get('X-Qualitour-Rendered'),'static-fallback');
 assert.equal(result.headers.get('Cache-Control'),'private, no-store');assert.equal(result.headers.get('Cloudflare-CDN-Cache-Control'),'no-store');
 assert.equal(result.headers.get('Content-Type'),'text/html');
 const head=await withStaticFallback(get('/zh/tours','HEAD'),failed(),assetsReturning(new Response('x',{status:200})));
 assert.equal(head.status,200);assert.equal(await head.text(),'');
});
test('the fallback never replaces a good answer, a real 404, other methods, other paths or a missing asset',async()=>{
 const asset=()=>assetsReturning(new Response('static',{status:200}));
 const ok=new Response('native',{status:200});
 assert.equal(await withStaticFallback(get('/tours/x'),ok,asset()),ok);
 const notFound=new Response('missing',{status:404});
 assert.equal(await withStaticFallback(get('/tours/x'),notFound,asset()),notFound);
 const f1=failed();assert.equal(await withStaticFallback(get('/tours/x','POST'),f1,asset()),f1);
 const f2=failed();assert.equal(await withStaticFallback(get('/_emdash/admin'),f2,asset()),f2,'infrastructure routes are not visitor pages');
 const f3=failed();assert.equal(await withStaticFallback(get('/tours/x'),f3,undefined),f3);
 const f4=failed();assert.equal(await withStaticFallback(get('/tours/x'),f4,assetsReturning(new Response('nope',{status:404}))),f4);
 const f5=failed();assert.equal(await withStaticFallback(get('/tours/x'),f5,{fetch:async()=>{throw new Error('assets down');}}),f5);
});
