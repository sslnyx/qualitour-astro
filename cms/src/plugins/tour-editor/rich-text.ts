const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const blockFields=new Set(['_type','_key','style','listItem','level','listId','listStart','children','markDefs','textAlign']);
const spanFields=new Set(['_type','_key','text','marks']);
const linkFields=new Set(['_type','_key','href','blank']);

function mergeArray(previous:unknown,next:unknown[],kind:'block'|'span'|'mark'):unknown[]{
  const old=new Map((Array.isArray(previous)?previous:[]).map(value=>{const node=record(value);return [node._key,node];}));
  return next.map(value=>{
    const node=record(value),original=old.get(node._key);
    if(!original||original._type!==node._type||typeof node._key!=='string')return structuredClone(value);
    const known=kind==='span'?spanFields:kind==='mark'&&node._type==='link'?linkFields:kind==='block'&&node._type==='block'?blockFields:null;
    if(!known)return structuredClone(value);
    const extra=Object.fromEntries(Object.entries(original).filter(([key])=>!known.has(key)));
    const merged={...structuredClone(extra),...structuredClone(node)};
    if(kind==='block'&&node._type==='block'){
      if(Array.isArray(node.children))merged.children=mergeArray(original.children,node.children,'span');
      if(Array.isArray(node.markDefs))merged.markDefs=mergeArray(original.markDefs,node.markDefs,'mark');
    }
    return merged;
  });
}
/** Merge stable-key editor output without reviving deliberately removed formatting or nodes. */
export function preserveRichText(previous:unknown,next:unknown[]):unknown[]{return mergeArray(previous,next,'block');}
