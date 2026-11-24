import {transferProductBySlug,transferProductPages} from '../../../../src/lib/transfer-products.ts';
const simplePages=['about-us','contact','faq','privacy-policy','terms','visa','reviews','private-transfers'];
const categories=new Set(['style','destination']);
export const vehicleWebsiteReleasePaths=new Set(['','/zh'].flatMap(prefix=>[
 `${prefix}/private-transfers`,
 ...transferProductPages.map(({slug})=>`${prefix}/private-transfers/${slug}`),
]));
const safeSegment=value=>{try{const d=decodeURIComponent(value);return d&&d!=='.'&&d!=='..'&&!/[\\/\u0000-\u001f\u007f]/.test(d)?d:null;}catch{return null;}};
/** Only existing public HTML routes. API/admin/assets and transactional booking are separate. */
export function nativeSiteRoute(pathname){
 if(typeof pathname!=='string'||!pathname.startsWith('/')||pathname.includes('//'))return null;
 const original=pathname;
 if(pathname.endsWith('.html'))pathname=pathname.slice(0,-5);
 if(pathname.length>1&&pathname.endsWith('/'))pathname=pathname.slice(0,-1);
 const segments=pathname.split('/').slice(1);let locale='en';if(segments[0]==='zh'){locale='zh';segments.shift();}
 if(segments.some(s=>!safeSegment(s))) {if(!(segments.length===1&&segments[0]===''))return null;}
 let kind;
 if(segments.length===0||segments.length===1&&segments[0]==='')kind='home';
 else if(segments.length===1&&simplePages.includes(segments[0]))kind='simple';
 else if(segments[0]==='private-transfers'&&segments.length===2&&transferProductBySlug(safeSegment(segments[1])))kind='transfer-product';
 else if(segments[0]==='tours'){
  if(segments.length===1)kind='tours';
  else if(segments.length===2)kind=segments[1]==='featured'?'featured':'tour';
  else if(segments.length===3&&categories.has(segments[1]))kind=segments[1];
 } if(!kind)return null;
 return {kind,locale,pathname,params:{lang:locale==='zh'?'zh':undefined,...(segments.length>1?{slug:safeSegment(segments.at(-1))}:{})},...(original!==pathname?{redirect:pathname}:{})};
}
export const nativeSitePagePatterns=Object.freeze([
 '[...lang]','[...lang]/private-transfers/[slug]',...simplePages.map(p=>'[...lang]/'+p),'[...lang]/tours','[...lang]/tours/featured','[...lang]/tours/[slug]',...[...categories].map(p=>'[...lang]/tours/'+p+'/[slug]'),]);
export const nativeSiteWorkerPatterns=Object.freeze(['/',...['','/zh'].flatMap(prefix=>[...(prefix?[prefix,prefix+'/']:[]),...simplePages.flatMap(p=>[prefix+'/'+p,...(p==='private-transfers'?[]:[prefix+'/'+p+'/']),prefix+'/'+p+'.html']),prefix+'/private-transfers/*',prefix+'/tours',prefix+'/tours/*',prefix+'/tours.html',prefix+'/destinations/*'])]);
