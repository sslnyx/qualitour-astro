import { readDays, type TourData, type DayRef, type DayBlock } from './tour-editor-model.ts';
export const editableFields = ['title','tour_code','summary','price','currency','duration','location','overview','itinerary','itinerary_continued','hero','gallery','brochure','additional_info','faq'] as const;
const allowed = new Set<string>(editableFields);
const equal = (a: unknown,b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function buildTourSave(base:TourData,changed:TourData):{data:TourData}{
  readDays(base);readDays(changed);
  const data:TourData={};
  for(const key of new Set([...Object.keys(base),...Object.keys(changed)])) {
    if(equal(base[key],changed[key])) continue;
    if(!allowed.has(key)) throw new Error('只能更新工作區提供的內容欄位。');
    if(!Object.hasOwn(changed,key)) throw new Error('不能移除既有欄位。');
    data[key]=structuredClone(changed[key]);
  }
  return {data};
}
function locate(data:TourData,ref:DayRef){
  const rows=readDays(data);const row=rows.find(r=>r.ref.field===ref.field&&r.ref.key===ref.key);
  if(!row) throw new Error('找不到選取的日程。');
  const blocks=data[ref.field] as DayBlock[];
  return {blocks,index:blocks.findIndex(b=>b._key===ref.key)};
}
function apply(data:TourData,field:DayRef['field'],blocks:DayBlock[]):TourData{
  const next={...structuredClone(data),[field]:structuredClone(blocks)};readDays(next);return next;
}
export function appendDay(data:TourData,key:string):TourData{
  readDays(data);
  const first=(data.itinerary||[]) as DayBlock[],second=(data.itinerary_continued||[]) as DayBlock[];
  const field:DayRef['field']=first.length<100&&second.length===0?'itinerary':'itinerary_continued';
  const blocks=(data[field]||[]) as DayBlock[];
  if(blocks.length>=100)throw new Error('行程已達可編輯上限。');
  return apply(data,field,[...blocks,{_type:'day',_version:1,_key:key,title:'',content:[]}]);
}
export function duplicateDay(data:TourData,ref:DayRef,key:string):TourData{
  const {blocks,index}=locate(data,ref);
  if(blocks.length>=100)throw new Error('此日程所在段落已達上限，無法複製。');
  return apply(data,ref.field,[...blocks.slice(0,index+1),{...blocks[index],_key:key},...blocks.slice(index+1)]);
}
export function deleteDay(data:TourData,ref:DayRef):TourData{
  const {blocks,index}=locate(data,ref);return apply(data,ref.field,blocks.filter((_,i)=>i!==index));
}
export function moveDay(data:TourData,ref:DayRef,offset:number):TourData{
  const {blocks,index}=locate(data,ref);const target=index+offset;
  if(!Number.isInteger(offset)||target<0||target>=blocks.length)throw new Error('不能將此日程移到相鄰段落。');
  const next=[...blocks];const [day]=next.splice(index,1);next.splice(target,0,day);return apply(data,ref.field,next);
}
