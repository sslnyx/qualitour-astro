import { extname } from 'node:path';

// These box/block characters are present in the frozen WordPress filenames.
// Several have already lost bytes, so do not guess a GBK/Big5 decoding.
const garbled=/[\u2500-\u259f\ufffd]/u;
function originalName(asset){return decodeURIComponent(new URL(asset.source_url).pathname.split('/').at(-1));}
function family(asset){
  const url=new URL(asset.source_url);const path=decodeURIComponent(url.pathname);
  return `${asset.locale}:${url.hostname}${path.slice(0,-extname(path).length).replace(/(?:-scaled|-\d+x\d+)+$/u,'')}`;
}
function titleLabel(value){
  if(garbled.test(value||''))return '';
  return Array.from((value||'').normalize('NFC').replace(/[\p{Cc}\p{Cf}<>:"/\\|?*]/gu,' ').replace(/\s+/gu,' ').trim()).slice(0,48).join('');
}
export function planMediaFilenames(assets,associations){
  const titles=new Map();
  for(const row of [...associations].sort((a,b)=>a.sourceKey.localeCompare(b.sourceKey))){
    const key=family(row.asset);const title=titleLabel(row.title);
    if(title&&!titles.has(key))titles.set(key,{title,sourceKey:row.sourceKey});
  }
  const result=new Map();
  for(const asset of [...assets].sort((a,b)=>a.source_url.localeCompare(b.source_url))){
    const originalFilename=originalName(asset);
    if(!garbled.test(originalFilename)||result.has(asset.sha256))continue;
    const context=titles.get(family(asset));
    const filename=`${context?.title||'Qualitour'}-圖片-${asset.sha256.slice(0,12)}${extname(originalFilename).toLowerCase()}`;
    result.set(asset.sha256,{filename,originalFilename,sourceKey:context?.sourceKey||null,reason:'Legacy filename contains corrupted box/block or replacement characters'});
  }
  return result;
}
