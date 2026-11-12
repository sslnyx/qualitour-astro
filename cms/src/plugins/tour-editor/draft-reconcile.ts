import { buildTourSave } from './tour-editor-fields.ts';
import type { TourData } from './tour-editor-model.ts';
export type FieldConflict={field:string;base:unknown;local:unknown;server:unknown};
export type Reconciliation={merged:TourData;conflicts:FieldConflict[]};
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Field-level three-way comparison; arrays are atomic to avoid guessing day alignment. */
export function reconcileDraft(base:TourData,local:TourData,server:TourData):Reconciliation{
 const changes=buildTourSave(base,local).data;
 const merged=structuredClone(server),conflicts:FieldConflict[]=[];
 for(const [field,value] of Object.entries(changes)){
  if(equal(server[field],base[field])||equal(server[field],value))merged[field]=structuredClone(value);
  else conflicts.push({field,base:structuredClone(base[field]),local:structuredClone(value),server:structuredClone(server[field])});
 }
 return {merged,conflicts};
}
export function applyResolution(result:Reconciliation,choices:Record<string,'local'|'server'>):TourData{
 const merged=structuredClone(result.merged);
 for(const conflict of result.conflicts){
  const choice=Object.hasOwn(choices,conflict.field)?choices[conflict.field]:undefined;
  if(choice!=='local'&&choice!=='server')throw new Error('請為每個衝突欄位選擇要保留的內容。');
  if(choice==='local')merged[conflict.field]=structuredClone(conflict.local);
 }
 return merged;
}
