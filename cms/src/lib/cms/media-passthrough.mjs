import { matchInternalMediaKey } from 'emdash/media/image-endpoint';

export function cmsMediaRedirect(href,origin){
  if(!href)return null;
  try{
    const source=new URL(href,origin);
    if(source.origin!==origin)return null;
    const key=matchInternalMediaKey(source.href);
    return key?`/_emdash/api/media/file/${encodeURIComponent(key)}`:null;
  }catch{return null;}
}
