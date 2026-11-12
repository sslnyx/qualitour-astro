import {useEffect,useState,useRef,useCallback} from 'react';
import {createContent,useNavigate} from '@emdash-cms/admin';
import {WorkspaceDialog} from './WorkspaceDialog';
import type {PendingNavigation,NavigationGuardComponent} from './navigation-guard';
import {tourListPath,tourWorkspaceHref} from './tour-navigation';

export function NewTourPage({locale:initialLocale,translationOf,NavigationGuard}:{locale:string;translationOf?:string|null;NavigationGuard?:NavigationGuardComponent}){
 const navigating=useRef(false),navigate=useNavigate();
 const [locale,setLocale]=useState(['en','zh'].includes(initialLocale)?initialLocale:'en');
 const [pending,setPending]=useState<PendingNavigation|null>(null);
 const onBlocked=useCallback((value:PendingNavigation)=>setPending(value),[]);
 const [title,setTitle]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{
  const warn=(event:BeforeUnloadEvent)=>{if(!navigating.current&&(title.trim()||busy)){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);
 },[title,busy]);
 return <section className="tour-workspace">{NavigationGuard&&<NavigationGuard active={(!!title.trim()||busy)&&!navigating.current} onBlocked={onBlocked}/>}<header className="tw-header"><div className="tw-title"><a className="tw-back" href={tourListPath(locale)} aria-label="返回行程列表">←</a><div><span className="tw-eyebrow">行程 Tours</span><h1>{translationOf?'新增語言版本':'新增行程'}</h1></div></div></header>
  <div className="tw-new-tour"><h2>先為行程命名</h2><p>建立草稿後，就可以在同一介面編輯內容及預覽。</p><form onSubmit={async event=>{
   event.preventDefault();if(busy||!title.trim())return;setBusy(true);setError('');
   try{const item=await createContent('tours',{locale,data:{title:title.trim(),currency:'CAD'},status:'draft',...(translationOf?{translationOf}:{})});navigating.current=true;void navigate({href:tourWorkspaceHref(item)+'&section=basic',replace:true,ignoreBlocker:true});}
   catch(error){setError(error instanceof Error?error.message:'無法建立草稿，請重試。');setBusy(false);}
  }}><label className="tw-field"><span>行程名稱</span><input required autoFocus value={title} disabled={busy} onChange={event=>setTitle(event.target.value)}/></label><label className="tw-field"><span>內容語言</span><select value={locale} disabled={busy||!!translationOf} onChange={event=>setLocale(event.target.value)}><option value="en">English</option><option value="zh">中文</option></select></label>{error&&<p role="alert">{error}</p>}<button className="tw-primary" disabled={busy||!title.trim()}>{busy?'正在建立…':'建立草稿並開始編輯'}</button></form></div>
 {pending&&<WorkspaceDialog title="離開新增行程？" onClose={()=>{pending.reset();setPending(null);}}><p>目前輸入尚未建立為草稿。</p><div className="tw-actions"><button type="button" onClick={()=>{pending.reset();setPending(null);}}>繼續編輯</button><button type="button" disabled={busy} onClick={()=>{navigating.current=true;pending.proceed();}}>放棄並離開</button></div></WorkspaceDialog>}
 </section>;
}
