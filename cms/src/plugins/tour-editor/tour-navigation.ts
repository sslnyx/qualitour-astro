export const toursPath='/_emdash/admin/content/tours';
export const workspacePath='/_emdash/admin/plugins/qualitour-editor/workspace';
export function tourCreateHref(locale:string,translationOf?:string):string{
 const params=new URLSearchParams({locale:['en','zh'].includes(locale)?locale:'en'});
 if(translationOf)params.set('translationOf',translationOf);
 return `${toursPath}/new?${params}`;
}
export function tourListPath(locale?:string):string{
 return toursPath+(['en','zh'].includes(locale||'')?`?locale=${locale}`:'');
}
/** A return target is list context, never a general-purpose redirect. */
export function safeTourReturnPath(value:string|null|undefined,locale:string):string{
 const fallback=tourListPath(locale);
 if(!value?.startsWith('/')||value.startsWith('//'))return fallback;
 try{
  const url=new URL(value,'https://qualitour-navigation.invalid');
  if(url.origin!=='https://qualitour-navigation.invalid'||url.pathname!==toursPath||url.hash)return fallback;
  return url.pathname+url.search;
 }catch{return fallback;}
}
export function tourWorkspaceHref(item:{id:string;locale:string},returnTo?:string|null):string{
 const params=new URLSearchParams({locale:item.locale,returnTo:safeTourReturnPath(returnTo,item.locale)});
 return `${toursPath}/${encodeURIComponent(item.id)}?${params}`;
}
