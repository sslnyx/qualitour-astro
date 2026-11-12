import {editableFields} from './tour-editor-fields.ts';
import {readDays,type TourData} from './tour-editor-model.ts';
type SettingsEntry={slug?:string|null;seo?:{title?:string|null;description?:string|null;image?:string|null;canonical?:string|null;noIndex?:boolean}};
export function requireCurrentTerms(expected:string[],actual:string[]){
 if(JSON.stringify([...expected].sort())!==JSON.stringify([...actual].sort()))throw Object.assign(new Error('分類已在其他分頁更新，請重新讀取。'),{status:409});
}
export function requireCurrentSchedule(expected:{_rev?:string;scheduledAt?:string|null},actual:{_rev?:string;scheduledAt?:string|null}){
 if(!expected._rev||expected._rev!==actual._rev||expected.scheduledAt!==actual.scheduledAt)throw Object.assign(new Error('排程已在其他分頁更新，請重新讀取。'),{status:409});
}
export function settingsFromEntry(entry:SettingsEntry){
 return {slug:entry.slug||'',title:entry.seo?.title||'',description:entry.seo?.description||'',image:entry.seo?.image||'',canonical:entry.seo?.canonical||'',noIndex:entry.seo?.noIndex||false};
}
export function settingsPayload(form:ReturnType<typeof settingsFromEntry>){
 const canonical=form.canonical.trim();
 if(canonical){try{const url=new URL(canonical);if(!['https:','http:'].includes(url.protocol))throw new Error();}catch{throw new Error('標準網址請填寫完整的 http 或 https 網址。');}}
 return {slug:form.slug.trim()||null,seo:{title:form.title.trim()||null,description:form.description.trim()||null,image:form.image||null,canonical:canonical||null,noIndex:form.noIndex}};
}
export function revisionDraft(id:string,current:TourData,revision:{collection:string;entryId:string;data:TourData}):TourData{
 if(revision.collection!=='tours'||revision.entryId!==id)throw new Error('此版本不屬於此行程。');
 const next=structuredClone(current);
 const arrays=new Set(['overview','itinerary','itinerary_continued','gallery','additional_info','faq']);
 for(const field of editableFields){
  if(Object.hasOwn(revision.data,field))next[field]=structuredClone(revision.data[field]);
  else if(Object.hasOwn(current,field))next[field]=arrays.has(field)?[]:['hero','brochure'].includes(field)?null:'';
 }
 readDays(next);return next;
}
