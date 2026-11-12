import assert from 'node:assert/strict';
export const WORKER_ID='2e3006ccf9f04193b0b795a6ae7c49f8';
export const ACCOUNT_ID='ca4d347f96116e87e8f5dbd6c62f0b30';
export function assertWorkerBindings(config){
 assert.equal(config.name,'qualitour');assert.equal(config.account_id,ACCOUNT_ID);
 assert.deepEqual(config.d1_databases.map(x=>[x.binding,x.database_id]),[['DB','cf36703e-a507-4810-b865-9cd57f6681a8'],['TRANSFER_DB','f8cb062c-16b1-4f44-992f-8563b71ced20']]);
 assert.deepEqual(config.r2_buckets.map(x=>[x.binding,x.bucket_name]),[['MEDIA','qualitour-cms-free-test-media']]);
 assert.deepEqual(config.kv_namespaces.map(x=>[x.binding,x.id]),[['SESSION','71990ee89fd4417a9046aacbbdb88fa4']]);
 assert.deepEqual(config.durable_objects.bindings,[{name:'CMS_RUNTIME',class_name:'QualitourCmsRuntime'}]);
 assert.equal(config.vars.EMDASH_CMS_EXECUTION,'durable');
 for(const route of ['/_emdash','/_emdash/*','/api/transfer','/api/transfer/*','/book/*','/zh/book/*'])assert.ok(config.assets.run_worker_first.includes(route),'Required Worker route missing: '+route);
 assert.ok(!config.routes?.length,'Domain routes require a separate reviewed cutover');
}
export function assertCmsRuntime(entry,chunks){
 assert.ok(entry.includes('QualitourCmsRuntime')&&entry.includes('fetchFreeRuntime'),'Missing approved Durable CMS runtime');
 assert.ok(chunks.some(x=>x.includes('qualitourValidatorCache'))&&chunks.some(x=>x.includes('async function enrichImageMetadata(')),'Missing approved CMS CPU transforms');
 for(const code of chunks)assert.ok(!/await generatePlaceholder\(override|async function decodeJpeg\(|async function generatePlaceholder\(/.test(code),'Unreviewed original-image CPU decoder reached CMS runtime');
}
export function assertWorkerCiTarget(environment){assert.ok(!environment.WRANGLER_CI_OVERRIDE_NAME||environment.WRANGLER_CI_OVERRIDE_NAME==='qualitour','Effective Wrangler CI target is not the authorized Worker');}
export async function beginWorkerRelease(root){const{rm}=await import('node:fs/promises');await rm(root+'/release-ready.json',{force:true});}
async function releaseFiles(root){
 const fs=await import('node:fs/promises');const{createHash}=await import('node:crypto');const files={};
 async function walk(path){for(const e of await fs.readdir(root+'/'+path,{withFileTypes:true})){assert.ok(!e.isSymbolicLink(),'Release file may not be a symlink');const p=path+'/'+e.name;if(e.isDirectory())await walk(p);else if(e.isFile())files[p]=createHash('sha256').update(await fs.readFile(root+'/'+p)).digest('hex');}}
 await walk('cms/server');await walk('assets');files['source-fingerprint.json']=createHash('sha256').update(await fs.readFile(root+'/source-fingerprint.json')).digest('hex');return files;
}
export async function writeWorkerReleaseMarker(root,sourceCommit){const{writeFile,rename}=await import('node:fs/promises');const marker={schema:1,sourceCommit,files:await releaseFiles(root)};await writeFile(root+'/release-ready.json.partial',JSON.stringify(marker)+'\n');await rename(root+'/release-ready.json.partial',root+'/release-ready.json');return marker;}
export async function verifyWorkerReleaseMarker(root,sourceCommit){const{readFile}=await import('node:fs/promises');const marker=JSON.parse(await readFile(root+'/release-ready.json','utf8'));assert.equal(marker.sourceCommit,sourceCommit,'Release source revision differs from deployment source');assert.deepEqual(await releaseFiles(root),marker.files,'Release files changed after successful complete build');return marker;}

export async function loadWorkerCmsModules(origin){
 assert.equal(origin,'https://qualitour.qualitour.workers.dev','Deployment CMS origin must be the renamed Worker');
 process.env.QUALITOUR_CMS_ORIGIN=origin;
 const reader=await import('../../src/lib/cms/read-client.mjs');
 const adapter=await import('../../src/lib/cms/legacy-adapter.mjs');
 assert.equal(reader.CMS_ORIGIN,origin,'CMS adapter initialized with a different origin');
 return {...reader,...adapter};
}
