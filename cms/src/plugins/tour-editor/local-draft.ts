import { buildTourSave } from './tour-editor-fields.ts';
import type { TourData } from './tour-editor-model.ts';
export type RecoveryInput={entryId:string;locale:string;baseRev:string;base:TourData;draft:TourData};
export type RecoveryRecord=RecoveryInput&{version:1;userId:string;writer:string;updatedAt:number;key:string;serialized:string};
type StorageLike=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
const prefix='qualitour:tour-draft:v1:';
const ttl=7*86400000;
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
/** Browser-local content only. Each editor instance owns a separate key. */
export class LocalDraftStore{
 warning='';
 private storage:StorageLike; private userId:string; private writer:string; private now:()=>number;
 constructor(storage:StorageLike,userId:string,writer:string,now=()=>Date.now()){this.storage=storage;this.userId=userId;this.writer=writer;this.now=now;}
 private key(entryId:string,locale:string,writer=this.writer){return prefix+JSON.stringify([this.userId,entryId,locale,writer]);}
 write(input:RecoveryInput){
  buildTourSave(input.base,input.draft);
  const value={...input,version:1,userId:this.userId,writer:this.writer,updatedAt:this.now()};
  const serialized=JSON.stringify(value);
  if(new TextEncoder().encode(serialized).length>2*1024*1024)throw new Error('內容超過本機暫存容量，請儲存至伺服器。');
  this.storage.setItem(this.key(input.entryId,input.locale),serialized);
 }
 clearOwn(entryId:string,locale:string){this.storage.removeItem(this.key(entryId,locale));}
 remove(record:RecoveryRecord){
  if(record.userId!==this.userId||record.key!==this.key(record.entryId,record.locale,record.writer))return;
  // An actively edited tab may already have replaced the offered copy.
  if(this.storage.getItem(record.key)===record.serialized)this.storage.removeItem(record.key);
 }
 list(entryId:string,locale:string):RecoveryRecord[]{
  const found:RecoveryRecord[]=[];let invalid=0;this.warning='';
  for(let i=this.storage.length-1;i>=0;i--){
   const key=this.storage.key(i);if(!key?.startsWith(prefix))continue;
   let scope:unknown;try{scope=JSON.parse(key.slice(prefix.length));}catch{continue;}
   if(!Array.isArray(scope)||scope.length!==4||scope[0]!==this.userId||scope[1]!==entryId||scope[2]!==locale)continue;
   const serialized=this.storage.getItem(key);if(!serialized)continue;
   try{
    const value=JSON.parse(serialized);
    if(!value||value.version!==1||value.userId!==this.userId||value.entryId!==entryId||value.locale!==locale||typeof value.writer!=='string'||typeof value.baseRev!=='string'||!value.baseRev||key!==this.key(entryId,locale,value.writer))throw new Error('invalid snapshot');
    if(typeof value.updatedAt!=='number'||value.updatedAt>this.now()+60000)throw new Error('invalid date');
    if(this.now()-value.updatedAt>ttl){this.storage.removeItem(key);continue;}
    buildTourSave(value.base,value.draft);
    if(equal(value.base,value.draft))continue;
    found.push({...value,key,serialized});
   }catch{invalid++; /* Retain the original for manual recovery; never silently apply malformed content. */}
  }
  if(invalid)this.warning=`有 ${invalid} 份本機副本損壞或格式不相容，未套用；原副本仍保留。`;
  return found.sort((a,b)=>b.updatedAt-a.updatedAt);
 }
}
