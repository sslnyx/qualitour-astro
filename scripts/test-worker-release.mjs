import {createRequire} from 'node:module'; const requireForTest=()=>createRequire(import.meta.url)('node:child_process');
import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';
import {assertWorkerBindings,assertCmsRuntime} from './lib/worker-release.mjs';
const config=JSON.parse(await readFile(new URL('../wrangler.qualitour.jsonc',import.meta.url),'utf8'));
test('release preserves existing account, data stores and CMS Durable contract',()=>{assert.doesNotThrow(()=>assertWorkerBindings(config));for(const change of [c=>c.name='new-worker',c=>c.account_id='wrong',c=>c.d1_databases[0].database_id='empty-db',c=>c.r2_buckets[0].bucket_name='empty-bucket',c=>c.kv_namespaces=[],c=>c.durable_objects.bindings=[]]){const c=structuredClone(config);change(c);assert.throws(()=>assertWorkerBindings(c));}});
test('CMS runtime gate requires retained Durable export and CPU transforms',()=>{assert.throws(()=>assertCmsRuntime('export default {}',[]),/Durable|runtime/);assert.throws(()=>assertCmsRuntime('export {QualitourCmsRuntime}; function fetchFreeRuntime(){}',[]),/CPU/);assert.doesNotThrow(()=>assertCmsRuntime('export {QualitourCmsRuntime}; function fetchFreeRuntime(){}',['qualitourValidatorCache; async function enrichImageMetadata(){}']));});
test('a failed replacement build cannot deploy earlier or hybrid release artifacts',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const{tmpdir}=await import('node:os');const{join}=await import('node:path');const{beginWorkerRelease,writeWorkerReleaseMarker,verifyWorkerReleaseMarker}=await import('./lib/worker-release.mjs');const root=await mkdtemp(join(tmpdir(),'qualitour-release-'));
 try{await mkdir(join(root,'cms/server'),{recursive:true});await mkdir(join(root,'assets'));await writeFile(join(root,'cms/server/entry.mjs'),'approved server');await writeFile(join(root,'assets/index.html'),'approved assets');await writeFile(join(root,'source-fingerprint.json'),'{}');await writeWorkerReleaseMarker(root,'approved-sha');await assert.doesNotReject(verifyWorkerReleaseMarker(root,'approved-sha'));await writeFile(join(root,'cms/server/entry.mjs'),'different server');await assert.rejects(verifyWorkerReleaseMarker(root,'approved-sha'),/changed|hash/i);await beginWorkerRelease(root);await assert.rejects(verifyWorkerReleaseMarker(root,'approved-sha'),/complete|ENOENT/i);}finally{await rm(root,{recursive:true,force:true});}
});
test('effective Wrangler CI target cannot override the checked Worker identity',async()=>{const{assertWorkerCiTarget}=await import('./lib/worker-release.mjs');assert.doesNotThrow(()=>assertWorkerCiTarget({}));assert.doesNotThrow(()=>assertWorkerCiTarget({WRANGLER_CI_OVERRIDE_NAME:'qualitour'}));assert.throws(()=>assertWorkerCiTarget({WRANGLER_CI_OVERRIDE_NAME:'another-worker'}));});
test('standalone deployment freshness uses renamed origin for requests and media hashes without inherited env',()=>{
 const{execFileSync}=requireForTest();const env={...process.env};delete env.QUALITOUR_CMS_ORIGIN;
 const code=`const {loadWorkerCmsModules}=await import('./scripts/lib/worker-release.mjs');const m=await loadWorkerCmsModules('https://qualitour.qualitour.workers.dev');const seen=[];const reader=m.createCmsReader({origin:'https://qualitour.qualitour.workers.dev',token:'synthetic',allowCli:false,fetchImpl:async url=>{seen.push(url.origin);return new Response(JSON.stringify({success:true,data:{items:[],total:0}}),{headers:{'content-type':'application/json'}})}});await reader.listPublished('en');console.log(JSON.stringify({seen,media:m.mediaUrl({meta:{storageKey:'a/cover.jpg'}})}));`;
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env,encoding:'utf8'}));assert.ok(result.seen.length>0);assert.ok(result.seen.every(x=>x==='https://qualitour.qualitour.workers.dev'));assert.match(result.media,/^https:\/\/qualitour\.qualitour\.workers\.dev\//);
});

test('Sandbox booking adds only its dedicated database and routes before CMS dispatch',async()=>{
 const c=structuredClone(config);c.d1_databases[1].database_id='wrong-transfer-db';assert.throws(()=>assertWorkerBindings(c));
 const missing=structuredClone(config);missing.assets.run_worker_first=missing.assets.run_worker_first.filter(x=>x!=='/book/*');assert.throws(()=>assertWorkerBindings(missing));
 const source=await readFile(new URL('../cms/src/emdash-free-worker.ts',import.meta.url),'utf8');
 assert.ok(source.includes("../../src/server/native-booking/index.mjs"));
 assert.ok(source.indexOf('await routeNativeBooking(request, env, context)')<source.lastIndexOf('return fetchFreeRuntime'));
});
