import * as React from 'react';
import { Link, type ContentListColumnCellContext } from '@emdash-cms/admin';
import { TourEditorPage } from './TourEditorPage';
import { tourListPath, safeTourReturnPath } from './tour-navigation';
import './tour-editor.css';
import './admin-navigation.css';
import { NewTourPage } from './NewTourPage';
import type {NavigationGuardComponent} from './navigation-guard';

export { workspacePath } from './tour-navigation';

function TourListRedirect({locale}:{locale:string}){
  React.useEffect(()=>{window.location.replace(tourListPath(locale));},[locale]);
  return <p role="status">正在開啟行程列表…</p>;
}
function Workspace({entryId,entryLocale,creating,returnTo,initialSection,translationOf,NavigationGuard}:{entryId?:string;entryLocale?:string;creating?:boolean;returnTo?:string;initialSection?:string;translationOf?:string;NavigationGuard?:NavigationGuardComponent}={}) {
  const params=new URLSearchParams(window.location.search);
  const id=entryId||params.get('entry'),locale=entryId?entryLocale||'':entryLocale||params.get('locale')||'';
  const content=creating||params.get('create')==='1'?<NewTourPage NavigationGuard={NavigationGuard} locale={locale||'en'} translationOf={translationOf||params.get('translationOf')}/>:id?<TourEditorPage NavigationGuard={NavigationGuard} key={`${id}:${locale}`} id={id} locale={locale} returnTo={returnTo||params.get('returnTo')} initialSection={(initialSection||params.get('section'))==='basic'?'basic':undefined}/>:<TourListRedirect locale={locale}/>;
  return entryId||creating?<div className="tw-native-route">{content}</div>:content;
}
// The native generic plugin route resolves this trusted component directly.
// Keep old deep links, without declaring a second sidebar/command-palette page.
export const pages = { '/workspace': Workspace };

function EditAndPreview({item}:ContentListColumnCellContext){
  const returnTo=window.location.pathname+window.location.search;
  const search={locale:item.locale,returnTo:safeTourReturnPath(returnTo,item.locale)};
  return <Link to="/content/$collection/$id" params={{collection:'tours',id:item.id}} search={search} className="text-kumo-link underline whitespace-nowrap" onClick={event=>event.stopPropagation()}>編輯與預覽</Link>;
}
export const contentListColumns=[{id:'tour-edit-preview',label:'內容編輯',collections:['tours'],order:-100,cell:EditAndPreview}];

