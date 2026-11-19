import test from 'node:test';
import assert from 'node:assert/strict';
import {isNativeProofPath, validateProofTags, scopedCloudflareProvider, withStaticFallback, immutableImageResponse, cachedMediaFileResponse, MEDIA_FILE_CACHE_CONTROL} from '../src/lib/cms/native-cache-policy.mjs';
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
test('the fallback says why the live render failed, when it was told',async()=>{
 const failedWithReason=new Response('Content temporarily unavailable',{status:503,headers:{'X-Qualitour-Error':'Error: Dynamic import exceeded memory limits.'}});
 const result=await withStaticFallback(get('/tours/x'),failedWithReason,assetsReturning(new Response('static',{status:200})));
 assert.equal(result.headers.get('X-Qualitour-Fallback-Reason'),'Error: Dynamic import exceeded memory limits.');
 assert.equal(result.headers.has('X-Qualitour-Error'),false,'the internal header is not forwarded under its own name');
 const plain=await withStaticFallback(get('/tours/x'),failed(),assetsReturning(new Response('static',{status:200})));
 assert.equal(plain.headers.has('X-Qualitour-Fallback-Reason'),false);
});
test('the fallback never replaces a good answer, a real 404, other methods, other paths or a missing asset',async()=>{
 const asset=()=>assetsReturning(new Response('static',{status:200}));
 const ok=new Response('native',{status:200});
 const passed=await withStaticFallback(get('/tours/x'),ok,asset());assert.equal(passed.status,200);assert.equal(await passed.text(),'native');
 const notFound=new Response('missing',{status:404});
 assert.equal(await withStaticFallback(get('/tours/x'),notFound,asset()),notFound);
 const f1=failed();assert.equal(await withStaticFallback(get('/tours/x','POST'),f1,asset()),f1);
 const f2=failed();assert.equal(await withStaticFallback(get('/_emdash/admin'),f2,asset()),f2,'infrastructure routes are not visitor pages');
 const f3=failed();assert.equal(await withStaticFallback(get('/tours/x'),f3,undefined),f3);
 const f4=failed();assert.equal(await withStaticFallback(get('/tours/x'),f4,assetsReturning(new Response('nope',{status:404}))),f4);
 const f5=failed();assert.equal(await withStaticFallback(get('/tours/x'),f5,{fetch:async()=>{throw new Error('assets down');}}),f5);
});

test('an empty or unreadable 200 is treated as a failed render; a good page passes through intact',async()=>{
 const asset=()=>assetsReturning(new Response('<html>static</html>',{status:200,headers:{'Content-Type':'text/html'}}));
 const empty=await withStaticFallback(get('/tours'),new Response('',{status:200}),asset());
 assert.equal(await empty.text(),'<html>static</html>');assert.equal(empty.headers.get('X-Qualitour-Rendered'),'static-fallback');assert.match(empty.headers.get('X-Qualitour-Fallback-Reason'),/^empty body \(length -, type text\/plain/);
 const broken=new Response(new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('<ht'));controller.error(new Error('Dynamic import exceeded memory limits.'));}}),{status:200});
 const recovered=await withStaticFallback(get('/'),broken,asset());
 assert.equal(await recovered.text(),'<html>static</html>');assert.match(recovered.headers.get('X-Qualitour-Fallback-Reason'),/body stream failed: Error: Dynamic import exceeded memory limits/);
 const good=await withStaticFallback(get('/'),new Response('<html>native</html>',{status:200,headers:{'X-Qualitour-Rendered':'abc','Content-Type':'text/html'}}),asset());
 assert.equal(await good.text(),'<html>native</html>');assert.equal(good.headers.get('X-Qualitour-Rendered'),'abc');
 const noAsset=await withStaticFallback(get('/tours/style/cruises'),new Response('',{status:200}),assetsReturning(new Response('nope',{status:404})));
 assert.equal(noAsset.status,503,'a blank page with no static twin becomes an honest 503, never a white screen');
 assert.match(noAsset.headers.get('X-Qualitour-Fallback-Reason'),/^empty body/);
 const head=new Response(null,{status:200});assert.equal(await withStaticFallback(get('/tours','HEAD'),head,asset()),head);
});

test('derived images get a year-long immutable cache, other responses are left alone',async()=>{
 const image=immutableImageResponse(new Response('webp',{status:200,headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=0, must-revalidate','Set-Cookie':'a=b'}}));
 assert.equal(image.headers.get('Cache-Control'),'public, max-age=31536000, immutable');assert.equal(image.headers.has('Set-Cookie'),false);assert.equal(await image.text(),'webp');
 const missing=new Response('nope',{status:404,headers:{'Content-Type':'image/webp'}});assert.equal(immutableImageResponse(missing),missing);
 const html=new Response('<p>',{status:200,headers:{'Content-Type':'text/html'}});assert.equal(immutableImageResponse(html),html);
});
test('original media files get a one-day cache for anonymous readers; editors, non-images and errors are untouched',async()=>{
 const origin=()=>new Response('jpg',{status:200,headers:{'Content-Type':'image/jpeg','ETag':'W/"1-2"','Cache-Control':'public, max-age=0, must-revalidate','Set-Cookie':'a=b'}});
 const url='https://example.test/_emdash/api/media/file/01ABC.01DEF.jpg';
 const anon=cachedMediaFileResponse(new Request(url),origin());
 assert.equal(anon.headers.get('Cache-Control'),MEDIA_FILE_CACHE_CONTROL);assert.equal(anon.headers.get('ETag'),'W/"1-2"','the validator stays so stale copies can still be checked');
 assert.equal(anon.headers.has('Set-Cookie'),false);assert.equal(await anon.text(),'jpg');
 const head=cachedMediaFileResponse(new Request(url,{method:'HEAD'}),origin());assert.equal(head.headers.get('Cache-Control'),MEDIA_FILE_CACHE_CONTROL);assert.equal(await head.text(),'');
 for(const headers of [{Cookie:'session=1'},{Authorization:'Bearer x'}]){
  const editor=origin();assert.equal(cachedMediaFileResponse(new Request(url,{headers}),editor),editor,'an editor with credentials keeps must-revalidate');
 }
 const post=origin();assert.equal(cachedMediaFileResponse(new Request(url,{method:'POST'}),post),post);
 const pdf=new Response('pdf',{status:200,headers:{'Content-Type':'application/pdf','Cache-Control':'public, max-age=0, must-revalidate'}});assert.equal(cachedMediaFileResponse(new Request(url),pdf),pdf);
 // A 304 (no Content-Type) must carry the policy too: Astro recomputes a revalidated entry's expiry from the 304's headers.
 const notModified=cachedMediaFileResponse(new Request(url),new Response(null,{status:304,headers:{'ETag':'W/"1-2"','Cache-Control':'public, max-age=0, must-revalidate'}}));
 assert.equal(notModified.status,304);assert.equal(notModified.headers.get('Cache-Control'),MEDIA_FILE_CACHE_CONTROL);assert.equal(notModified.headers.get('ETag'),'W/"1-2"');
 const pdfUrl='https://example.test/_emdash/api/media/file/01ABC.01DEF.pdf';
 const pdfNotModified=new Response(null,{status:304,headers:{'Cache-Control':'public, max-age=0, must-revalidate'}});assert.equal(cachedMediaFileResponse(new Request(pdfUrl),pdfNotModified),pdfNotModified,'a 304 for a non-image keeps the default');
 const missing=new Response('nope',{status:404,headers:{'Content-Type':'image/jpeg','Cache-Control':'private, no-store'}});assert.equal(cachedMediaFileResponse(new Request(url),missing),missing);
 const already=new Response('jpg',{status:200,headers:{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=31536000, immutable'}});assert.equal(cachedMediaFileResponse(new Request(url),already),already,'a response that already sets a policy is not overridden');
});
test('a failed render of a path with lowercase percent-escapes still finds its prerendered page',async()=>{
 // Our own links spell escapes in lowercase (%e8), but the assets service only matches the uppercase spelling of a non-ASCII file name.
 const looked=[];
 const assets={fetch:async request=>{const path=new URL(request.url).pathname;looked.push(path);return path==='/zh/tours/2027%E5%B9%B4-tour'?new Response('<html>static zh tour</html>',{status:200,headers:{'Content-Type':'text/html'}}):new Response('not found',{status:404});}};
 const result=await withStaticFallback(get('/zh/tours/2027%e5%b9%b4-tour'),failed(),assets);
 assert.equal(result.status,200);assert.equal(await result.text(),'<html>static zh tour</html>');
 assert.equal(result.headers.get('X-Qualitour-Rendered'),'static-fallback');
 assert.ok(looked.every(path=>path==='/zh/tours/2027%E5%B9%B4-tour'),'the asset is requested with uppercase escapes');
 const head=await withStaticFallback(new Request('https://example.test/zh/tours/2027%e5%b9%b4-tour?x=1',{method:'HEAD'}),failed(),assets);
 assert.equal(head.status,200,'HEAD and query strings follow the same path');
});
