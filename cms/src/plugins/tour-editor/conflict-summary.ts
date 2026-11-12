/** Human-readable complete content for a field-atomic choice, including selected media identity. */
export function describeConflictValue(value:unknown):string{
 if(value===undefined||value===null)return '（沒有內容）';
 if(typeof value==='string')return value||'（空白）';
 const lines:string[]=[];
 const visit=(v:unknown)=>{
  if(typeof v==='string'){lines.push(v);return;}
  if(Array.isArray(v)){v.forEach(visit);return;}
  if(v&&typeof v==='object'){
   const obj=v as Record<string,unknown>;
   for(const key of ['title','text','content','children','image','filename','caption','alt','id','url'])if(obj[key]!==undefined)visit(obj[key]);
  }
 };
 visit(value);return lines.join('\n')||JSON.stringify(value);
}
