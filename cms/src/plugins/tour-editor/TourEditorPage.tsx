import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { readDays, dayId, changedDayIds } from './tour-editor-model';
import { useTourDraft } from './use-tour-draft';
import { ItineraryEditor } from './ItineraryEditor';
import { PreviewPane } from './PreviewPane';
import { BasicSection, OverviewSection, MediaSection, NotesSection } from './TourSections';
import { appendDay, duplicateDay, deleteDay, moveDay, editableFields } from './tour-editor-fields';
import type { TourData, DayRef } from './tour-editor-model';
import { fetchTranslations, Link, useNavigate, type TranslationSummary } from '@emdash-cms/admin';
import { WorkspaceDialog } from './WorkspaceDialog';
import { RecoveryPanel } from './RecoveryPanel';
import { safeTourReturnPath, tourWorkspaceHref } from './tour-navigation';
import { TourSettings } from './TourSettings';
import type {PendingNavigation,NavigationGuardComponent} from './navigation-guard';

type Section = 'basic' | 'overview' | 'itinerary' | 'media' | 'notes';
const sections: Array<{id:Section;label:string}> = [{id:'basic',label:'基本資料'},{id:'overview',label:'行程介紹'},{id:'itinerary',label:'每日行程'},{id:'media',label:'照片與 PDF'},{id:'notes',label:'附加資訊與 FAQ'}];

export function TourEditorPage({ id, locale, returnTo, initialSection, NavigationGuard }: { id: string; locale: string; returnTo?: string | null; initialSection?: Section; NavigationGuard?:NavigationGuardComponent }) {
  const { state, session } = useTourDraft(id, locale);
  const displayLocale=state.item?.locale||locale;
  const listPath=safeTourReturnPath(returnTo,displayLocale);
  const routerNavigate=useNavigate();
  const [selected, setSelected] = useState('');
  const [query, setQuery] = useState('');
  const [preview, setPreview] = useState(true);
  const [mode, setMode] = useState<'list' | 'edit' | 'preview'>('edit');
  const [leaving, setLeaving] = useState<string|PendingNavigation>('');
  const [section,setSection]=useState<Section>(initialSection||'itinerary');
  const [actionError,setActionError]=useState('');
  const [removing,setRemoving]=useState(false);
  const [settings,setSettings]=useState(false);
  const [translationsLoaded,setTranslationsLoaded]=useState(false);
  const [translations,setTranslations]=useState<TranslationSummary[]>([]);
  useEffect(()=>{if(!state.item)return;let active=true;void fetchTranslations('tours',state.item.id).then(result=>{if(active){setTranslations(result.translations);setTranslationsLoaded(true);}}).catch(()=>{});return()=>{active=false;};},[state.item?.id]);
  const root = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(1200);
  useEffect(() => { const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width)); if (root.current) observer.observe(root.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    const leave = (event: MouseEvent) => {
      if (!session.getSnapshot().dirty && !session.getSnapshot().saving) return;
      const link = (event.target as Element)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!link || link.target === '_blank' || link.href === window.location.href) return;
      event.preventDefault(); event.stopPropagation(); setLeaving(link.href);
    };
    document.addEventListener('click', leave, true);
    return () => document.removeEventListener('click', leave, true);
  }, [session]);
  const rows = useMemo(() => { try { return readDays(state.draft); } catch { return []; } }, [state.draft]);
  const row = rows.find(r => dayId(r.ref) === selected) || rows[0];
  const index = row ? rows.indexOf(row) : -1;
  const changed = new Set(changedDayIds(state.base, state.draft));
  const sectionFields:Record<Section,string[]>={basic:['title','tour_code','summary','price','currency','duration','location'],overview:['overview'],itinerary:['itinerary','itinerary_continued'],media:['hero','gallery','brochure'],notes:['additional_info','faq']};
  const sectionDirty=(name:Section)=>sectionFields[name].some(field=>JSON.stringify(state.base[field])!==JSON.stringify(state.draft[field]));
  const compact = width < 900;
  const editingDisabled=state.readOnly||state.operating||state.comparing||!!state.comparison;
  const jump = (offset: number) => { const next = rows[index + offset]; if (next) { setSelected(dayId(next.ref)); setMode('edit'); } };
  const navigate = (url: string) => {
    const target=new URL(url,window.location.origin);session.close();
    if(target.origin===window.location.origin&&target.pathname.startsWith('/_emdash/admin/'))void routerNavigate({href:target.pathname+target.search+target.hash,ignoreBlocker:true});
    else window.location.assign(target.href);
  };
  const onNavigationBlocked=useCallback((pending:PendingNavigation)=>setLeaving(pending),[]);
  const cancelLeave=()=>{if(typeof leaving!=='string')leaving.reset();setLeaving('');};
  const continueLeave=()=>{
    if(typeof leaving!=='string'){session.close();leaving.proceed();setLeaving('');}
    else if(leaving==='reload'){setLeaving('');void session.load(id,locale,{resolveIdentity:true});}
    else navigate(leaving);
  };
  const listParams=new URLSearchParams(listPath.split('?')[1]||'');
  const listSearch={...Object.fromEntries(listParams),locale:listParams.get('locale')||undefined};
  const setField=(field:string,value:unknown)=>session.patch(data=>({...data,[field]:value}));
  const act=(fn:(data:TourData)=>TourData,next?:DayRef)=>{try{session.patch(fn);setActionError('');if(next)setSelected(dayId(next));}catch(error){setActionError(error instanceof Error?error.message:'無法修改此日程。');}};
  const rowFieldIndex=row?rows.filter(r=>r.ref.field===row.ref.field).findIndex(r=>r.ref.key===row.ref.key):-1;
  const rowFieldLength=row?rows.filter(r=>r.ref.field===row.ref.field).length:0;
  const previewSection=section==='basic'?'hero':section==='itinerary'&&row?'itinerary':section==='media'&&Array.isArray(state.base.gallery)&&state.base.gallery.length?'photos':section==='notes'&&Array.isArray(state.base.additional_info)&&state.base.additional_info.length?'info':section==='notes'&&Array.isArray(state.base.faq)&&state.base.faq.length?'faq':'overview';
  const add=()=>{const key=crypto.randomUUID();try{const next=appendDay(state.draft,key);const added=readDays(next).find(r=>r.ref.key===key);act(()=>next,added?.ref);}catch(error){setActionError(error instanceof Error?error.message:'無法新增日程。');}};
  if(state.loading)return <section ref={root} className="tour-workspace tw-loading" aria-busy="true" data-state="loading">
    <header className="tw-header"><div className="tw-title"><div><span className="tw-eyebrow">編輯與預覽</span><h1 role="status">正在載入行程…</h1></div></div><div className="tw-skeleton tw-skeleton-actions" aria-hidden="true"/></header>
    <div className="tw-loading-tabs" aria-hidden="true"><span className="tw-skeleton"/><span className="tw-skeleton"/><span className="tw-skeleton"/><span className="tw-skeleton"/></div>
    <div className="tw-loading-body" aria-hidden="true"><div className="tw-loading-index">{[1,2,3,4,5].map(n=><span key={n} className="tw-skeleton"/>)}</div><div className="tw-loading-content"><span className="tw-skeleton"/><span className="tw-skeleton"/><span className="tw-skeleton tw-skeleton-large"/></div><div className="tw-loading-preview"><span className="tw-skeleton tw-skeleton-large"/></div></div>
  </section>;
  return <section ref={root} className={`tour-workspace ${preview ? 'has-preview' : ''} ${width < 1180 ? 'is-medium' : ''} ${compact ? 'is-compact' : ''}`} data-mode={mode}>
    {NavigationGuard&&<NavigationGuard active={state.dirty||state.saving} onBlocked={onNavigationBlocked}/>}
    <header className="tw-header"><div className="tw-title"><Link className="tw-back" to="/content/$collection" params={{collection:'tours'}} search={listSearch} aria-label="返回行程列表">←</Link><div><span className="tw-eyebrow">編輯與預覽 {translations.length>1?<select aria-label="切換內容語言" value={state.item?.id||id} onChange={e=>{const pair=translations.find(t=>t.id===e.target.value);if(!pair)return;const url=tourWorkspaceHref(pair,listPath);if(state.dirty||state.saving)setLeaving(url);else navigate(url);}}>{translations.map(pair=><option key={pair.id} value={pair.id}>{pair.locale.toUpperCase()}</option>)}</select>:<span className="tw-locale">{displayLocale.toUpperCase()}</span>}</span><h1>{String(state.item?.data.title || '載入行程…')}</h1></div></div>
      <div className="tw-actions"><span role="status" className={`tw-save-status ${state.dirty ? 'is-dirty' : ''}`}>{state.saving ? '儲存中…' : state.dirty ? changed.size ? `${changed.size} 天未儲存` : '有未儲存修改' : '已儲存'}</span>
        <button type="button" className="tw-primary" disabled={editingDisabled || !state.dirty || state.saving} onClick={() => void session.save()}>儲存草稿</button>
        <button type="button" aria-pressed={preview} onClick={() => { setPreview(v => !v); if (compact) setMode(mode === 'preview' ? 'edit' : 'preview'); }}>{preview ? '收起預覽' : '開啟預覽'}</button>
        <button type="button" disabled={!state.item||state.loading||state.saving} onClick={()=>setSettings(true)}>設定與發佈</button></div></header>
    <nav className="tw-sections" aria-label="行程編輯分區">{sections.map(s=><button type="button" key={s.id} className={section===s.id?'is-active':''} aria-current={section===s.id?'page':undefined} onClick={()=>{setSection(s.id);setMode('edit');}}>{s.label}{sectionDirty(s.id)&&<span className="tw-dirty-dot" aria-hidden="true" title="此分區有未儲存修改"/>}{s.id==='itinerary'&&<span>{rows.length}</span>}</button>)}</nav>
    {state.error && <div role="alert" className="tw-alert">{state.error}{(state.dirty||state.conflict)&&<button type="button" disabled={state.comparing||state.saving} onClick={()=>void session.compareLatest()}>{state.comparing?'正在對照…':'對照最新內容'}</button>}<button type="button" onClick={() => setLeaving('reload')}>重新讀取</button></div>}
    <RecoveryPanel state={state} session={session}/>
    {actionError&&<div role="alert" className="tw-alert">{actionError}<button type="button" onClick={()=>setActionError('')}>關閉</button></div>}
    {state.loading ? <div className="tw-empty">正在載入行程…</div> : !state.item ? <div className="tw-empty"><p>無法開啟此行程。</p><a href={listPath}>返回行程列表</a></div> : <>
      <div className="tw-mobile-controls">{section==='itinerary'&&<button type="button" onClick={() => setMode('list')} aria-pressed={mode === 'list'}>日程目錄</button>}<button type="button" onClick={() => setMode('edit')} aria-pressed={mode === 'edit'}>編輯</button><button type="button" onClick={() => { setPreview(true); setMode('preview'); }} aria-pressed={mode === 'preview'}>預覽</button></div>
      {section==='itinerary'&&<div className="tw-day-strip"><label>目前日程 <select aria-label="選擇日程" value={row ? dayId(row.ref) : ''} onChange={e => setSelected(e.target.value)}>{rows.map(r => <option key={dayId(r.ref)} value={dayId(r.ref)}>Day {r.ordinal} · {r.block.title || '未命名'}</option>)}</select></label><div className="tw-actions"><button type="button" disabled={index <= 0} onClick={() => jump(-1)}>← 上一天</button><button type="button" disabled={index < 0 || index >= rows.length - 1} onClick={() => jump(1)}>下一天 →</button></div></div>}
      <div className="tw-body">
        {section==='itinerary'&&<aside className="tw-day-list" aria-label="每日行程目錄"><div className="tw-list-heading"><strong>每日行程</strong><span>{rows.length} 天</span></div><input aria-label="搜尋日程" placeholder="搜尋日程標題…" value={query} onChange={e => setQuery(e.target.value)} />
          <div className="tw-day-links">{rows.filter(r => String(r.block.title || '').toLowerCase().includes(query.toLowerCase()) || String(r.ordinal) === query).map(r => <button type="button" key={dayId(r.ref)} draggable={!editingDisabled} onDragStart={e=>e.dataTransfer.setData('application/x-qualitour-day',JSON.stringify(r.ref))} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();try{const ref=JSON.parse(e.dataTransfer.getData('application/x-qualitour-day')) as DayRef;if(ref.field!==r.ref.field)throw new Error('這兩天分屬不同日程段落，暫時不能直接交換。');const siblings=rows.filter(x=>x.ref.field===r.ref.field);const from=siblings.findIndex(x=>x.ref.key===ref.key),to=siblings.findIndex(x=>x.ref.key===r.ref.key);act(data=>moveDay(data,ref,to-from),ref);}catch(error){setActionError(error instanceof Error?error.message:'無法移動日程。');}}} className={row && dayId(row.ref) === dayId(r.ref) ? 'is-active' : ''} aria-current={row && dayId(row.ref) === dayId(r.ref) ? 'step' : undefined} onClick={() => { setSelected(dayId(r.ref)); setMode('edit'); }}><span className="tw-day-number">{String(r.ordinal).padStart(2,'0')}</span><span><small>DAY {r.ordinal}{changed.has(dayId(r.ref)) ? ' · 已修改' : ''}</small><strong>{r.block.title || '未命名日程'}</strong></span></button>)}</div>
        </aside>}
        <div className="tw-edit-pane" role="region" aria-label="內容編輯">
          {section==='basic'&&<BasicSection data={state.draft} readOnly={editingDisabled} setField={setField}/>}
          {section==='overview'&&<OverviewSection data={state.draft} readOnly={editingDisabled} setField={setField}/>}
          {section==='media'&&<MediaSection data={state.draft} readOnly={editingDisabled} setField={setField}/>}
          {section==='notes'&&<NotesSection data={state.draft} readOnly={editingDisabled} setField={setField}/>}
          {section==='itinerary'&&(row ? <><div className="tw-editor-meta"><span>第 {row.ordinal} 天，共 {rows.length} 天</span><div className="tw-actions"><button type="button" disabled={index <= 0} onClick={() => jump(-1)} aria-label="上一天">←</button><button type="button" disabled={index >= rows.length - 1} onClick={() => jump(1)} aria-label="下一天">→</button></div></div><div className="tw-day-tools"><button type="button" disabled={editingDisabled} onClick={add}>＋ 新增一天</button><details className="tw-more" key={dayId(row.ref)}><summary>更多操作</summary><div className="tw-more-menu" onClick={event=>{if((event.target as Element).closest('button')){const details=event.currentTarget.closest('details');if(details)details.open=false;}}}><button type="button" disabled={editingDisabled||rowFieldIndex<=0} onClick={()=>act(data=>moveDay(data,row.ref,-1),row.ref)}>上移</button><button type="button" disabled={editingDisabled||rowFieldIndex>=rowFieldLength-1} onClick={()=>act(data=>moveDay(data,row.ref,1),row.ref)}>下移</button><button type="button" disabled={editingDisabled} onClick={()=>{const key=crypto.randomUUID();act(data=>duplicateDay(data,row.ref,key),{...row.ref,key});}}>複製當天</button><button type="button" disabled={editingDisabled} onClick={()=>setRemoving(true)}>移除當天</button></div></details></div><ItineraryEditor key={`${id}:${locale}:${dayId(row.ref)}`} row={row} readOnly={editingDisabled} patch={fn => session.patch(fn)} /></> : <div className="tw-empty"><p>此行程尚未有每日行程。</p><button type="button" disabled={editingDisabled} onClick={add}>新增第一天</button></div>)}
          <div className="tw-source-note">來源參考：{String(state.draft.source_key||'—')} · {String(state.draft.source_status||'—')}{Object.keys(state.draft).some(key=>!([...editableFields,'source_key','source_status'] as string[]).includes(key))&&<p>此行程另有來源資料，儲存時會保留。</p>}</div>
        </div>
        {preview && <PreviewPane item={state.item} dirty={state.dirty} section={previewSection} day={previewSection==='itinerary'?row?.ref:undefined} />}
      </div>
    </>}
    {settings&&state.item&&<TourSettings NavigationGuard={NavigationGuard} state={state} session={session} onClose={()=>setSettings(false)} onRevisionLoaded={()=>{setSettings(false);setActionError('已載入舊版本至本頁草稿，請檢查後儲存。');}} missingLocales={translationsLoaded?['en','zh'].filter(lang=>!translations.some(t=>t.locale===lang)&&lang!==displayLocale):[]}/>}
    {leaving && <WorkspaceDialog title="處理尚未儲存的修改" onClose={cancelLeave}><p>離開或重新讀取前，請選擇如何處理目前內容。</p><div className="tw-actions"><button type="button" onClick={cancelLeave}>取消</button><button type="button" disabled={state.saving} onClick={()=>{session.discard();continueLeave();}}>放棄修改</button><button type="button" className="tw-primary" disabled={editingDisabled||state.saving} onClick={async()=>{if(await session.save()&&!session.getSnapshot().dirty)continueLeave();}}>儲存後繼續</button></div></WorkspaceDialog>}
    {removing&&row&&<WorkspaceDialog title={`移除第 ${row.ordinal} 天？`} onClose={()=>setRemoving(false)}><p>移除會先保留在草稿修改中，儲存後才生效。</p><div className="tw-actions"><button type="button" onClick={()=>setRemoving(false)}>取消</button><button type="button" onClick={()=>{act(data=>deleteDay(data,row.ref));setSelected('');setRemoving(false);}}>確認移除</button></div></WorkspaceDialog>}
  </section>;
}
