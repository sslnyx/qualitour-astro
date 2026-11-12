import {mkdir,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {mergeWorkerAssets} from './lib/merge-worker-assets.mjs';
import {assertWorkerBindings,assertCmsRuntime,beginWorkerRelease,writeWorkerReleaseMarker} from './lib/worker-release.mjs';
import {contentHash} from '../src/lib/cms/legacy-adapter.mjs';
const root=resolve('.astro/worker-release'),cms=resolve(process.env.WORKER_CMS_OUT_DIR||root+'/cms'),front=resolve(process.env.WORKER_STATIC_OUT_DIR||root+'/frontend'),assets=root+'/assets';
const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});const sourceCommit=process.env.WORKER_RELEASE_COMMIT||process.env.WORKERS_CI_COMMIT_SHA||(git.status===0?git.stdout.trim():null);if(!sourceCommit)throw Error('Worker release requires a source revision');
const cmsOrigin=process.env.QUALITOUR_CMS_ORIGIN||'https://qualitour.qualitour.workers.dev';
await mkdir('.astro',{recursive:true});const lock='.astro/worker-release.lock';
try{await mkdir(lock);}catch{throw Error('Another combined Worker build is in progress');}
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit',env:{...process.env,WORKER_RELEASE_COMMIT:sourceCommit,QUALITOUR_CMS_ORIGIN:cmsOrigin,WORKER_CMS_OUT_DIR:cms,WORKER_STATIC_OUT_DIR:front}});if(r.error)throw r.error;if(r.status!==0)throw Error('Worker build step failed');}
try{
 await beginWorkerRelease(root);
 const astro=JSON.parse(await readFile('node_modules/astro/package.json','utf8'));const bin=typeof astro.bin==='string'?astro.bin:astro.bin.astro;
 run([resolve('node_modules/astro',bin),'build','--config','astro.config.worker-cms.mjs']);
 const entry=await readFile(cms+'/server/entry.mjs','utf8');const chunks=await Promise.all((await readdir(cms+'/server/chunks')).filter(x=>x.endsWith('.mjs')).map(x=>readFile(cms+'/server/chunks/'+x,'utf8')));assertCmsRuntime(entry,chunks);
 run(['scripts/build-worker-static.mjs']);
 const result=await mergeWorkerAssets({frontendDir:front,cmsClientDir:cms+'/client',outputDir:assets});
 const config=JSON.parse(await readFile(cms+'/server/wrangler.json','utf8'));assertWorkerBindings(config);config.assets.directory=relative(cms+'/server',assets);await writeFile(cms+'/server/wrangler.json',JSON.stringify(config)+'\n');
 const source=JSON.parse(await readFile('.astro/cms-content/public-catalogue.json','utf8'));await writeFile(root+'/source-fingerprint.json',JSON.stringify({origin:source.origin,compatibilityHash:source.compatibilityHash,contentHash:contentHash(source.locales)})+'\n');
 await writeWorkerReleaseMarker(root,sourceCommit);
 console.log(JSON.stringify({combinedWorkerVerified:true,...result}));
}finally{await rm(lock,{recursive:true,force:true});}
