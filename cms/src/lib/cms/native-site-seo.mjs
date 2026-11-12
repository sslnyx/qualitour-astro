import {plainText} from '../../../../src/lib/seo.ts';
const safeUrl=value=>{if(typeof value!=='string'||!value.trim())return;try{const u=new URL(value);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)return u.href;}catch{}};
const ownedMediaPath=value=>typeof value==='string'&&/^\/_emdash\/api\/media\/file\/[A-Za-z0-9][A-Za-z0-9._%\/-]*$/.test(value)&&!value.split('/').includes('..')?value:undefined;
/** Existing metadata stays authoritative until an editor sets a published override. */
export function applyNativeTourSeo(metadata,seo={}){
 const result={...metadata};
 for(const key of ['title','description'])if(typeof seo?.[key]==='string'&&seo[key].trim())result[key]=plainText(seo[key]);
 const image=safeUrl(seo?.image)||ownedMediaPath(seo?.image);if(image)result.image=image;
 return {metadata:result,canonical:safeUrl(seo?.canonical),noindex:seo?.noIndex===true?true:undefined};
}
