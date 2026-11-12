import assert from 'node:assert/strict';
import {readdir,readFile,mkdir,cp,rename,rm,stat} from 'node:fs/promises';
import {resolve,relative,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function inventory(root){const files=new Map();async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);assert.ok(!entry.isSymbolicLink(),'Forbidden symlink in public asset inputs');if(entry.isDirectory())await walk(path);else if(entry.isFile())files.set(relative(root,path),path);}}await walk(root);return files;}
const cmsOutputOnly=new Set(['robots.txt','_headers','_redirects','staging-inventory.json','qualitour-release.json','combined-release.json','.assetsignore','.htaccess-staging','.htaccess']);
function forbidden(path){return path.split('/').some(x=>x.startsWith('.env')||x==='.dev.vars'||x==='server'||x==='_worker.js'||x==='node_modules')||/\.(?:sql|sqlite|pem|key|ts|tsx|astro)$/.test(path);}
export async function mergeWorkerAssets({frontendDir,cmsClientDir,outputDir}){
 const front=resolve(frontendDir),cms=resolve(cmsClientDir),out=resolve(outputDir);
 for(const source of [front,cms])assert.ok(out!==source&&!out.startsWith(source+'/')&&!source.startsWith(out+'/'),'Asset output must be separate from inputs');
 const [f,c]=await Promise.all([inventory(front),inventory(cms)]);const release=JSON.parse(await readFile(join(front,'qualitour-release.json'),'utf8'));
 assert.equal(release.content_source,'emdash','Frontend release must use current published CMS content');
 const files=new Map([...f].filter(([path])=>!path.startsWith('.htaccess')));
 for(const [path,source]of c){
  if(forbidden(path))throw Error('Forbidden private/server asset: '+path);
  if(path.endsWith('.html')||cmsOutputOnly.has(path)||path.endsWith('.map')||basename(path)==='.DS_Store')continue;
  if(files.has(path)){assert.equal(sha(await readFile(files.get(path))),sha(await readFile(source)),'Public asset collision: '+path);}else files.set(path,source);
 }
 assert.ok(files.size+1<=20000,'Worker Free asset limit exceeded');
 const tmp=out+'.partial-'+process.pid,backup=out+'.previous-'+process.pid;
 await rm(tmp,{recursive:true,force:true});await mkdir(tmp,{recursive:true});let largest=0;
 try{
  for(const [path,source]of files){if(forbidden(path))throw Error('Forbidden private/server asset: '+path);const bytes=(await stat(source)).size;assert.ok(bytes<=25*1024*1024,'Worker individual asset too large: '+path);largest=Math.max(largest,bytes);await mkdir(join(tmp,path,'..'),{recursive:true});await cp(source,join(tmp,path));}
  const exclusions=new Set(['_worker.js','_routes.json','wrangler.json','.dev.vars','**/*.map','.htaccess*']);
  for(const source of [front,cms]){try{for(const line of (await readFile(join(source,'.assetsignore'),'utf8')).split(/\r?\n/))if(line.trim())exclusions.add(line.trim());}catch(e){if(e.code!=='ENOENT')throw e;}}
  await import('node:fs/promises').then(fs=>fs.writeFile(join(tmp,'.assetsignore'),[...exclusions].join('\n')+'\n'));
  const result={schema:1,worker:'qualitour',generatedAt:new Date().toISOString(),frontend:{commit:release.commit,counts:release.counts,origin:release.origin},assets:{files:files.size+1,largestFileBytes:largest}};
  await import('node:fs/promises').then(fs=>fs.writeFile(join(tmp,'combined-release.json'),JSON.stringify(result)+'\n'));
  let hadOld=false;try{await rename(out,backup);hadOld=true;}catch(e){if(e.code!=='ENOENT')throw e;}
  try{await rename(tmp,out);}catch(e){if(hadOld)await rename(backup,out);throw e;}
  if(hadOld)await rm(backup,{recursive:true,force:true});return result;
 }catch(e){await rm(tmp,{recursive:true,force:true});throw e;}
}
