import {resolve,dirname} from 'node:path';
const root=resolve(new URL('../../../',import.meta.url).pathname);
/** Keep static/recovery builds unchanged; replace data boundaries only in CMS SSR. */
export function nativeSiteRuntimePlugin(){
 const aliases=new Map([
  ['src/lib/wordpress/api','cms/src/lib/cms/native-site-api.mjs'],
  ['src/lib/wordpress/image','cms/src/lib/cms/native-site-image.mjs'],
  ['src/lib/wordpress/tour-build-data','cms/src/lib/cms/native-site-build-data.mjs'],
 ]);
 return {name:'qualitour-native-visitor-data',enforce:'pre',resolveId(source,importer){
  if(!importer)return;
  const target=(source.startsWith('.')?resolve(dirname(importer.split('?')[0]),source):source).replace(/\.(?:ts|mjs)$/,'');
  for(const [original,replacement] of aliases)if(target===resolve(root,original))return resolve(root,replacement);
 }};
}

export function configureNativeRoute(route){
 const target=resolve(root,route.component);
 if(target.startsWith(resolve(root,'src/pages')+'/'))route.prerender=false;
}
