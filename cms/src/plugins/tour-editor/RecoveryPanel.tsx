import { useState } from 'react';
import type { DraftState, TourDraftSession } from './draft-session';
import { WorkspaceDialog } from './WorkspaceDialog';
import { describeConflictValue as describe } from './conflict-summary';
const labels:Record<string,string>={title:'行程名稱',tour_code:'團號',summary:'簡介',price:'價格說明',currency:'幣別',duration:'天數',location:'地點',overview:'行程介紹',itinerary:'每日行程',itinerary_continued:'延續行程',hero:'封面照片',gallery:'相簿',brochure:'行程 PDF',additional_info:'附加資訊',faq:'常見問題'};
export function RecoveryPanel({state,session}:{state:DraftState;session:TourDraftSession}){
 const [choices,setChoices]=useState<Record<string,'local'|'server'>>({});
 const comparison=state.comparison;
 return <>
  {state.localError&&<div role="alert" className="tw-alert">{state.localError}</div>}
  {state.recovery.length>0&&<div className="tw-recovery" aria-label="本機未儲存副本"><strong>找到本機未儲存副本</strong><p>僅在這部瀏覽器保留 7 天。先對照最新伺服器版本，再決定是否恢復；其他分頁可能仍在編輯。</p>{state.recovery.map(record=><div className="tw-recovery-copy" key={record.key}><span>{new Date(record.updatedAt).toLocaleString()} · {Object.keys(record.draft).filter(k=>JSON.stringify(record.draft[k])!==JSON.stringify(record.base[k])).map(k=>labels[k]||k).join('、')}</span><button type="button" disabled={state.comparing||state.saving||state.dirty} onClick={()=>{setChoices({});void session.compareRecovery(record.key);}}>對照並恢復</button><button type="button" disabled={state.comparing} onClick={()=>session.discardRecovery(record.key)}>捨棄此副本</button></div>)}</div>}
  {state.localSavedAt&&state.dirty&&!state.localError&&<p role="status" className="tw-local-status">已暫存於這部瀏覽器 · {new Date(state.localSavedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · 尚未儲存至伺服器</p>}
  {comparison&&<WorkspaceDialog title={comparison.record?'恢復本機未儲存內容':'對照最新伺服器版本'} onClose={()=>session.cancelComparison()}><p>以最新伺服器版本為底稿。套用後先留在編輯頁，按「儲存草稿」才會寫入伺服器。</p><div className="tw-comparison">
   {comparison.result.conflicts.length===0?<p>修改的欄位沒有衝突，可以保留本機修改及伺服器其他更新。</p>:comparison.result.conflicts.map(conflict=><fieldset key={conflict.field}><legend>{labels[conflict.field]||conflict.field}</legend><div className="tw-compare-columns"><label><input type="radio" aria-label={`保留我的內容：${labels[conflict.field]||conflict.field}`} name={`resolve-${conflict.field}`} checked={choices[conflict.field]==='local'} onChange={()=>setChoices(v=>({...v,[conflict.field]:'local'}))}/>保留我的內容<pre>{describe(conflict.local)}</pre></label><label><input type="radio" aria-label={`保留伺服器內容：${labels[conflict.field]||conflict.field}`} name={`resolve-${conflict.field}`} checked={choices[conflict.field]==='server'} onChange={()=>setChoices(v=>({...v,[conflict.field]:'server'}))}/>保留伺服器內容<pre>{describe(conflict.server)}</pre></label></div><details><summary>查看修改前內容</summary><pre>{describe(conflict.base)}</pre></details>{['itinerary','itinerary_continued','gallery','faq'].includes(conflict.field)&&<p>此欄位整組選擇，請先對照每一天或每一項，未自動拼接。</p>}</fieldset>)}
  </div><div className="tw-actions"><button type="button" onClick={()=>session.cancelComparison()}>取消，保留原修改</button><button type="button" className="tw-primary" disabled={comparison.result.conflicts.some(c=>!choices[c.field])} onClick={()=>{session.applyComparison(choices);setChoices({});}}>套用到編輯頁</button></div></WorkspaceDialog>}
 </>;
}
