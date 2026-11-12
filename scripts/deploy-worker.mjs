import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {assertWorkerBindings,WORKER_ID,ACCOUNT_ID,assertWorkerCiTarget,verifyWorkerReleaseMarker,loadWorkerCmsModules} from './lib/worker-release.mjs';
assertWorkerCiTarget(process.env);
const git=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'});const sourceCommit=process.env.WORKER_RELEASE_COMMIT||process.env.WORKERS_CI_COMMIT_SHA||(git.status===0?git.stdout.trim():null);assert.ok(sourceCommit,'Deployment source revision missing');await verifyWorkerReleaseMarker('.astro/worker-release',sourceCommit);
const path='.astro/worker-release/cms/server/wrangler.json';const config=JSON.parse(await readFile(path,'utf8'));assertWorkerBindings(config);
let token=process.env.CLOUDFLARE_API_TOKEN;
if(!token){assert.ok(!process.env.CI,'Cloudflare-managed build deployment credential missing');const r=spawnSync('/Users/ning/bin/cf-wrangler',['auth','token','--json'],{encoding:'utf8'});assert.equal(r.status,0);token=JSON.parse(r.stdout.slice(r.stdout.indexOf('{'))).token;}
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/workers/${WORKER_ID}`,{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200,'Existing Worker identity cannot be verified');const remote=(await response.json()).result;assert.equal(remote.id,WORKER_ID);assert.equal(remote.name,'qualitour','Refuse to create another Worker instead of updating the renamed one');
const expected=JSON.parse(await readFile('.astro/worker-release/source-fingerprint.json','utf8'));
const {createCmsReader,buildCatalogue,retainPublicTranslations,contentHash}=await loadWorkerCmsModules(expected.origin);const compatibility=JSON.parse(await readFile('src/data/cms-legacy-compat.json','utf8'));assert.equal(contentHash(compatibility),expected.compatibilityHash);
assert.equal(expected.origin,'https://qualitour.qualitour.workers.dev','Release source still points at retired CMS origin');
const reader=createCmsReader({origin:expected.origin});const locales={};for(const locale of ['en','zh'])locales[locale]=buildCatalogue(await reader.listPublished(locale),compatibility,locale);retainPublicTranslations(locales);assert.equal(contentHash(locales),expected.contentHash,'Public CMS content changed during build; leave current release live and rebuild');
const executable=process.env.CI?'./node_modules/.bin/wrangler':'/Users/ning/bin/cf-wrangler';const result=spawnSync(executable,['deploy','--config',path],{stdio:'inherit',env:{...process.env,CLOUDFLARE_ACCOUNT_ID:ACCOUNT_ID}});if(result.error)throw result.error;if(result.status!==0)throw Error('Combined Worker deployment failed');

const after=await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/workers/${WORKER_ID}`,{headers:{Authorization:'Bearer '+token}});assert.equal(after.status,200);const actual=(await after.json()).result;assert.equal(actual.id,WORKER_ID);assert.equal(actual.name,'qualitour');
const live=await fetch('https://qualitour.qualitour.workers.dev/qualitour-release.json',{cache:'no-store'});assert.equal(live.status,200,'Published release cannot be read back');assert.equal((await live.json()).commit,sourceCommit,'Public release does not match deployment source');
