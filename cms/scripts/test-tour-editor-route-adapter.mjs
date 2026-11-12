import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {transformTourAdmin, tourAdminPlugin} from './lib/tour-admin-routes.mjs';
import {tourWorkspaceHref,tourCreateHref} from '../src/plugins/tour-editor/tour-navigation.ts';
const path=createRequire(import.meta.url).resolve('@emdash-cms/admin');
const source=readFileSync(path,'utf8');
test('pinned adapter replaces only route component seams and rejects upstream changes',()=>{
 const result=transformTourAdmin(source,path);assert.ok(result.includes('component: QualitourContentEditPage,'));assert.ok(result.includes('component: QualitourContentNewPage,'));
 assert.ok(result.includes('function ContentEditPage()'));assert.ok(result.includes('function ContentNewPage()'));
 assert.equal(transformTourAdmin('unrelated','/project/file.ts'),null);
 assert.throws(()=>transformTourAdmin(source+'\n',path),/fingerprint/);
 const plugin=tourAdminPlugin();assert.doesNotThrow(()=>plugin.buildStart());
 assert.throws(()=>plugin.generateBundle({}, {x:{type:'chunk',modules:{[path]:{}}}}),/Untransformed/);
 assert.equal(plugin.load('/unrelated.js'),null);assert.ok(plugin.load(path).code.includes('QualitourContentEditPage'));assert.doesNotThrow(()=>plugin.generateBundle({}, {x:{type:'chunk',modules:{[path]:{}}}}));
});
test('native tour routes render their plugin editor in place without document redirects',()=>{
 const transformed=transformTourAdmin(source,path);
 const appendix=transformed.slice(transformed.indexOf('// Qualitour tour route gates'));
 const nativeEdit=()=>{},nativeNew=()=>{},workspace=()=>{};let params={collection:'tours',id:'real-id'},search={locale:'zh'};
 const factory=new Function('React$1','jsx','useParams','useSearch','usePluginPage','ContentEditPage','ContentNewPage','window',appendix+';return {edit:QualitourContentEditPage,create:QualitourContentNewPage};');
 const routes=factory({useEffect:()=>{throw new Error('No redirect effect');}},(type,props)=>({type,props}),()=>params,()=>search,()=>workspace,nativeEdit,nativeNew,{location:{replace:()=>{throw new Error('No document redirect');}}});
 let result=routes.edit();assert.equal(result.type,workspace);assert.equal(result.props.entryId,'real-id');assert.equal(result.props.entryLocale,'zh');
 result=routes.create();assert.equal(result.type,workspace);assert.equal(result.props.creating,true);assert.equal(result.props.entryLocale,'zh');
 params={collection:'articles',id:'another'};assert.equal(routes.edit().type,nativeEdit);assert.equal(routes.create().type,nativeNew);
});
test('in-place router navigation blocks dirty Back/Forward without a duplicate unload guard',()=>{
 const transformed=transformTourAdmin(source,path);
 const appendix=transformed.slice(transformed.indexOf('// Qualitour tour route gates'));
 let options,blocked;const pending={status:'blocked',proceed:()=>{},reset:()=>{}};
 const guard=new Function('useBlocker','React$1',appendix+';return QualitourNavigationGuard;')(value=>{options=value;return pending;},{useEffect:fn=>fn()});
 assert.equal(guard({active:true,onBlocked:value=>blocked=value}),null);
 assert.equal(options.disabled,false);assert.equal(options.shouldBlockFn(),true);assert.equal(options.withResolver,true);assert.equal(options.enableBeforeUnload,false);
 assert.equal(blocked.proceed,pending.proceed);assert.equal(blocked.reset,pending.reset);
 guard({active:false,onBlocked:()=>{}});assert.equal(options.disabled,true);
});
