import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emdashFreeCpuPlugin, transformFreeCpuModule } from './lib/emdash-free-cpu.mjs';

const root=resolve(dirname(createRequire(import.meta.url).resolve('emdash')),'..');
async function load(name){
 const path=resolve(root,'dist',name);const input=await readFile(path,'utf8');
 const output=transformFreeCpuModule(input,path);
 assert.ok(output,'Known pinned vendor module must be transformed');
 const req=createRequire(path);
 const code=output.replace(/from "([^"]+)"/g,(_,specifier)=>`from "${pathToFileURL(specifier.startsWith('.')?resolve(dirname(path),specifier):req.resolve(specifier)).href}"`);
 return import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
}

test('Free image enrichment retains dimensions and bytes without decoding an original for optional placeholders',async()=>{
 const {t:enrich}=await load('enrich-DFlfnd3u.mjs');
 const bytes=new Uint8Array(await readFile('public/mini-tour.jpg'));const before=bytes.slice();
 const result=await enrich(bytes,'image/jpeg');
 assert.ok(result.width>0&&result.height>0);assert.equal(result.blurhash,undefined);assert.equal(result.dominantColor,undefined);
 assert.deepEqual(bytes,before);
 assert.deepEqual(await enrich(new Uint8Array([1,2,3]),'application/pdf'),{});
 const corrupt=await enrich(new Uint8Array([1,2,3]),'image/jpeg');
 assert.equal(corrupt.width,undefined);assert.equal(corrupt.blurhash,undefined);
 const known=await enrich(bytes,'image/jpeg',{knownDimensions:{width:123,height:456}});
 assert.equal(known.width,123);assert.equal(known.height,456);assert.equal(known.blurhash,undefined);
 const png=await enrich(new Uint8Array(await readFile('public/favicon.png')),'image/png',{placeholder:{bytes,contentType:'image/jpeg'}});
 assert.ok(png.width>0&&png.height>0);assert.equal(png.blurhash,undefined);
});

test('Cached validators reuse only identical fresh field definitions, including nested rules and defaults',async()=>{
 const {o:generate}=await load('zod-generator--nlM0930.mjs');
 const collection={slug:'tours',fields:[{slug:'title',type:'string',required:true,validation:{maxLength:10}}]};
 const first=generate(collection);assert.equal(generate(structuredClone(collection)),first);
 assert.equal(first.safeParse({title:'okay'}).success,true);
 assert.equal(first.safeParse({title:123}).success,false);
 assert.equal(first.safeParse({}).success,false);
 const changed=structuredClone(collection);changed.fields[0].validation.maxLength=2;
 const second=generate(changed);assert.notEqual(second,first);assert.equal(second.safeParse({title:'okay'}).success,false);
 const added=structuredClone(collection);added.fields.push({slug:'code',type:'string',required:true});
 assert.equal(generate(added).safeParse({title:'okay'}).success,false);
 const defaults=structuredClone(collection);defaults.fields[0].defaultValue='new';defaults.fields[0].required=false;
 assert.equal(generate(defaults).parse({}).title,'new');
 assert.equal(generate(collection),first);
 const other={...collection,slug:'other'};assert.notEqual(generate(other),first);
 const objectDefault={slug:'defaults',fields:[{slug:'value',type:'blocks',required:false,defaultValue:[{nested:{value:'original'}}]}]};
 const snapshot=structuredClone(objectDefault);const objectSchema=generate(objectDefault);
 objectDefault.fields[0].defaultValue[0].nested.value='mutated source';
 objectSchema.parse({}).value[0].nested.value='mutated output';
 assert.equal(generate(snapshot).parse({}).value[0].nested.value,'original');
 for(let i=0;i<33;i++)generate({...collection,slug:'eviction-'+i});
 assert.notEqual(generate(collection),first);
});

test('Compatibility changes reject unexpected vendor input and ignore unrelated modules',async()=>{
 assert.equal(transformFreeCpuModule('const x=1;','/src/unrelated.mjs'),null);
 const sourcePath=resolve(root,'dist/enrich-DFlfnd3u.mjs');
 assert.ok(transformFreeCpuModule(await readFile(sourcePath,'utf8'),sourcePath+'?v=123'));
 await assert.rejects(async()=>transformFreeCpuModule((await readFile(resolve(root,'dist/enrich-DFlfnd3u.mjs'),'utf8'))+'\n// changed',resolve(root,'dist/enrich-DFlfnd3u.mjs')),/vendor|fingerprint/i);
});

test('Bundling fails if a CMS compatibility module bypasses the transform',async()=>{
 const plugin=emdashFreeCpuPlugin();plugin.buildStart();
 const id=resolve(root,'dist/enrich-DFlfnd3u.mjs');
 const bundle={server:{type:'chunk',modules:{[id]:{}}}};
 assert.throws(()=>plugin.generateBundle({},bundle),/Untransformed/);
 plugin.transform(await readFile(id,'utf8'),id);
 assert.doesNotThrow(()=>plugin.generateBundle({},bundle));
 assert.throws(()=>plugin.generateBundle({},{server:{type:'chunk',modules:{'/another/node_modules/emdash/dist/enrich-other.mjs':{}}}}),/Untransformed/);
});
