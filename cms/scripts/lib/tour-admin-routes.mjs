import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';

const adminPath=createRequire(import.meta.url).resolve('@emdash-cms/admin');
const fingerprint='f4a2397269b973e35e6deecb16fa8591a38798c734b6ac4d9546b3cc8c8171b3';
function replaceOnce(code,before,after){assert.equal(code.split(before).length,2,'EmDash admin date seam changed');return code.replace(before,()=>after);}
// EmDash 1.4 has panels but no route replacement hook. Keep this narrow,
// fail-closed adapter in the project; installed CMS files remain untouched.
export function transformTourAdmin(code,id){
 if(id.split('?')[0]!==adminPath)return null;
 assert.equal(createHash('sha256').update(code).digest('hex'),fingerprint,'EmDash admin fingerprint changed; review tour route gates');
 let result=code;
 for(const name of ['New','Edit']){
  const seam=`component: Content${name}Page,`;
  assert.equal(result.split(seam).length,2,'EmDash admin route seam changed');
  result=result.replace(seam,`component: QualitourContent${name}Page,`);
 }
 result=replaceOnce(result,'field: manifest?.collections[collection]?.dateField ?? "updatedAt",','field: collection === "tours" ? "updatedAt" : manifest?.collections[collection]?.dateField ?? "updatedAt",');
 result=replaceOnce(result,'const colSpan = (i18n$8 ? 5 : 4) + listColumns.length + extensionColumns.length + (bulkEnabled ? 1 : 0);','const colSpan = (i18n$8 ? 5 : 4) + listColumns.length + extensionColumns.length + (bulkEnabled ? 1 : 0) + (collection === "tours" ? 1 : 0);');
 result=replaceOnce(result,'field: dateField ?? "updatedAt",','field: collection === "tours" ? "updatedAt" : dateField ?? "updatedAt",');
 const dateLabel='label: _t({\n\t\t\t\t\t\t\t\tid: "mYGY3B",\n\t\t\t\t\t\t\t\tmessage: "Date"\n\t\t\t\t\t\t\t})';
 result=replaceOnce(result,dateLabel,'label: collection === "tours" ? "修改日期" : _t({id:"mYGY3B",message:"Date"})');
 const header='/* @__PURE__ */ jsx(SortableTh, {\n\t\t\t\t\t\t\tfield: collection === "tours" ? "updatedAt" : dateField ?? "updatedAt",';
 result=replaceOnce(result,header,'collection === "tours" && jsx(SortableTh,{field:"createdAt",sort,onSortChange,label:"建立日期"}),\n\t\t\t\t\t\t'+header);
 const date='const date = (dateField ? parseListDate(item.data[dateField]) : null) ?? parseTimestamp(item.updatedAt || item.createdAt);';
 result=replaceOnce(result,date,'const date = collection === "tours" ? parseTimestamp(item.updatedAt || item.createdAt) : (dateField ? parseListDate(item.data[dateField]) : null) ?? parseTimestamp(item.updatedAt || item.createdAt);');
 const cell='/* @__PURE__ */ jsx("td", {\n\t\t\t\t"data-testid": "content-updated",';
 result=replaceOnce(result,cell,'collection === "tours" && jsx("td",{"data-testid":"tour-created",className:"whitespace-nowrap text-kumo-subtle",children:jsx("bdi",{children:formatDate(parseTimestamp(item.createdAt),lingui.locale)})}),\n\t\t\t'+cell);
 result=replaceOnce(result,'...typeof search.field === "string" && { field: search.field },\n\t\t...typeof search.locale === "string" && { locale: search.locale }','...typeof search.field === "string" && { field: search.field },\n\t\t...typeof search.locale === "string" && { locale: search.locale },\n\t\t...typeof search.returnTo === "string" && { returnTo: search.returnTo },\n\t\t...search.section === "basic" && { section: "basic" }');
 const newRoute='path: "/content/$collection/new",\n\tcomponent: QualitourContentNewPage,\n\tstaticData: { fullBleed: true },\n\tvalidateSearch: (search) => ({ locale: typeof search.locale === "string" ? search.locale : void 0 })';
 result=replaceOnce(result,newRoute,newRoute.replace('locale : void 0 })','locale : void 0, translationOf: typeof search.translationOf === "string" ? search.translationOf : void 0 })'));
 result=replaceOnce(result,'if (PluginComponent) return /* @__PURE__ */ jsx(PluginComponent, {});','if (PluginComponent) return jsx(PluginComponent, pluginId === "qualitour-editor" ? {NavigationGuard:QualitourNavigationGuard} : {});');
 return result+`
// Qualitour tour route gates
function QualitourNavigationGuard({active,onBlocked}){
 const blocker=useBlocker({shouldBlockFn:()=>true,disabled:!active,withResolver:true,enableBeforeUnload:false});
 React$1.useEffect(()=>{if(blocker.status==="blocked")onBlocked({proceed:blocker.proceed,reset:blocker.reset});},[blocker.status,blocker.proceed,blocker.reset,onBlocked]);
 return null;
}
function QualitourContentEditPage(){
 const {collection,id}=useParams({from:"/_admin/content/$collection/$id"});
 const search=useSearch({from:"/_admin/content/$collection/$id"});
 const Workspace=usePluginPage("qualitour-editor","/workspace");
 return collection==="tours"?(Workspace?jsx(Workspace,{NavigationGuard:QualitourNavigationGuard,entryId:id,entryLocale:search.locale,returnTo:search.returnTo,initialSection:search.section}):jsx("p",{role:"alert",children:"行程編輯模組未能載入，請重新整理。"})):jsx(ContentEditPage,{});
}
function QualitourContentNewPage(){
 const {collection}=useParams({from:"/_admin/content/$collection/new"});
 const search=useSearch({from:"/_admin/content/$collection/new"});
 const Workspace=usePluginPage("qualitour-editor","/workspace");
 return collection==="tours"?(Workspace?jsx(Workspace,{NavigationGuard:QualitourNavigationGuard,creating:true,entryLocale:search.locale,translationOf:search.translationOf}):jsx("p",{role:"alert",children:"行程編輯模組未能載入，請重新整理。"})):jsx(ContentNewPage,{});
}
`;
}
export function tourAdminPlugin(){
 const seen=new Set();
 return {name:'qualitour-tour-admin-routes',enforce:'pre',
  configResolved(config){
   // The CMS explicitly prebundles its admin in dev. Excluding it after all
   // integrations merge config lets the same fingerprinted transform run.
   config.optimizeDeps.include=(config.optimizeDeps.include||[]).filter(id=>id!=='@emdash-cms/admin');
   config.optimizeDeps.exclude=[...new Set([...(config.optimizeDeps.exclude||[]),'@emdash-cms/admin',dirname(adminPath),adminPath])];
  },
  buildStart(){
   assert.equal(JSON.parse(readFileSync(resolve(dirname(adminPath),'../package.json'),'utf8')).version,'1.4.0','Review tour routing before upgrading CMS');
   transformTourAdmin(readFileSync(adminPath,'utf8'),adminPath);
  },
  load(id){
   if(id.split('?')[0]!==adminPath)return null;
   // Read before Vite's dev transforms add imports/HMR metadata, so the
   // reviewed fingerprint has identical meaning in development and builds.
   const code=transformTourAdmin(readFileSync(adminPath,'utf8'),id);
   seen.add(adminPath);return {code,map:null};
  },
  generateBundle(_options,bundle){for(const chunk of Object.values(bundle)){if(chunk.type==='chunk')for(const id of Object.keys(chunk.modules)){if(id.split('?')[0]===adminPath)assert.ok(seen.has(adminPath),'Untransformed CMS admin reached bundle');}}},
 };
}
