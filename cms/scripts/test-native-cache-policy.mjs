import test from 'node:test';
import assert from 'node:assert/strict';
import {isNativeProofPath, validateProofTags, scopedCloudflareProvider} from '../src/lib/cms/native-cache-policy.mjs';
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
