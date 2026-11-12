import { useEffect, useState, useId } from 'react';
import { PortableTextEditor, MediaPickerModal, fetchMediaItem, type MediaItem } from '@emdash-cms/admin';
import type { TourData } from './tour-editor-model';
import { resolveAsset } from './media-preview';
import { preserveRichText } from './rich-text';

type Props = { data: TourData; readOnly: boolean; setField: (field: string, value: unknown) => void };
const text = (value: unknown) => typeof value === 'string' ? value : '';
const obj = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
const list = (value: unknown): Record<string,unknown>[] => Array.isArray(value) ? value as Record<string,unknown>[] : [];

export function RichField({ label, value, disabled, onChange }: { label: string; value: unknown; disabled: boolean; onChange: (value: unknown[]) => void }) {
  const labelId=useId();
  return <div className="tw-field"><label id={labelId}>{label}</label><PortableTextEditor className="tw-native-editor" aria-labelledby={labelId} value={(Array.isArray(value) ? value : []) as never[]} editable={!disabled}
    onChange={next => { if (!disabled) onChange(preserveRichText(value,next)); }} /></div>;
}

export function BasicSection({ data, readOnly, setField }: Props) {
  const fields = [['title','行程名稱'],['tour_code','團號'],['price','價格說明'],['currency','幣別'],['duration','天數'],['location','地點說明']];
  return <div className="tw-section-content"><h2>基本資料</h2><p className="tw-section-description">快速更新旅客最先看到的行程資訊。</p><div className="tw-field-grid">{fields.map(([field,label]) => <label className={`tw-field ${field === 'title' ? 'tw-span-full' : ''}`} key={field}><span>{label}</span><input value={text(data[field])} disabled={readOnly} onChange={e => setField(field,e.target.value)} /></label>)}</div><label className="tw-field"><span>簡介</span><textarea rows={4} value={text(data.summary)} disabled={readOnly} onChange={e => setField('summary',e.target.value)} /></label></div>;
}

export function OverviewSection({ data, readOnly, setField }: Props) {
  return <div className="tw-section-content"><h2>行程介紹</h2><p className="tw-section-description">整理概述與行程亮點，保留原有內容及格式。</p><RichField label="行程介紹" value={data.overview} disabled={readOnly} onChange={v => setField('overview',v)} /></div>;
}

function useAsset(value: unknown) {
  const cached = obj(value);
  const [asset,setAsset]=useState<Record<string,unknown>>(cached);
  const id=typeof value==='string'?value:text(cached.id);
  useEffect(()=>{
    let active=true;setAsset(obj(value));
    if(id && (!cached.provider || cached.provider==='local')) void fetchMediaItem(id).then(item=>{if(active)setAsset(item as unknown as Record<string,unknown>);}).catch(()=>{});
    return()=>{active=false;};
  },[id,value]);
  return resolveAsset(value,asset,window.location.origin);
}
function Asset({ value, kind='image' }: { value: unknown; kind?: 'image' | 'file' }) {
  const asset=useAsset(value);
  return kind==='image' ? asset.url ? <img src={asset.url} alt="" loading="lazy" /> : <div className="tw-asset-empty">尚未選擇圖片</div>
    : <div className="tw-pdf"><strong>{value?asset.filename:'尚未選擇 PDF'}</strong>{asset.url&&<a href={asset.url} target="_blank" rel="noreferrer">開啟檔案 ↗</a>}</div>;
}
function mediaValue(item:MediaItem){return {provider:item.provider||'local',id:item.id,filename:item.filename,mimeType:item.mimeType,...(item.meta?{meta:item.meta}:{}),...(item.storageKey?{meta:{...item.meta,storageKey:item.storageKey}}:{}),url:item.url};}

export function MediaSection({data,readOnly,setField}:Props){
  const [picker,setPicker]=useState<null|'hero'|'brochure'|'gallery'>(null);
  const gallery=list(data.gallery);
  const patch=(i:number,key:string,value:unknown)=>setField('gallery',gallery.map((item,n)=>n===i?{...item,[key]:value}:item));
  const reorder=(i:number,offset:number)=>{const next=[...gallery];const [item]=next.splice(i,1);next.splice(i+offset,0,item);setField('gallery',next);};
  return <div className="tw-section-content"><h2>照片與 PDF</h2><p className="tw-section-description">設定封面、相簿與行程手冊。</p>
    <h3>封面照片</h3><div className="tw-cover"><Asset value={data.hero}/><div className="tw-actions"><button type="button" disabled={readOnly} onClick={()=>setPicker('hero')}>{data.hero?'替換封面':'選擇封面'}</button>{!!data.hero&&<button type="button" disabled={readOnly} onClick={()=>setField('hero',null)}>移除封面</button>}</div></div>
    <div className="tw-inline-heading"><h3>相簿 <span className="tw-muted">{gallery.length} 張照片</span></h3><button type="button" disabled={readOnly||gallery.length>=100} onClick={()=>setPicker('gallery')}>新增照片</button></div>
    <div className="tw-gallery">{gallery.map((item,i)=><div className="tw-gallery-card" key={`${obj(item.image).id||'image'}:${i}`}><Asset value={item.image}/><label className="tw-field"><span>照片標題</span><input value={text(item.caption)} disabled={readOnly} onChange={e=>patch(i,'caption',e.target.value)}/></label><label className="tw-field"><span>圖片說明（替代文字）</span><input value={text(item.alt)} disabled={readOnly} onChange={e=>patch(i,'alt',e.target.value)}/></label><div className="tw-actions"><button type="button" disabled={readOnly||i===0} aria-label={`照片 ${i+1} 前移`} onClick={()=>reorder(i,-1)}>←</button><button type="button" disabled={readOnly||i===gallery.length-1} aria-label={`照片 ${i+1} 後移`} onClick={()=>reorder(i,1)}>→</button><button type="button" disabled={readOnly} onClick={()=>setField('gallery',gallery.filter((_,n)=>i!==n))}>移除</button></div></div>)}</div>
    <h3>行程 PDF</h3><Asset value={data.brochure} kind="file"/><div className="tw-actions"><button type="button" disabled={readOnly} onClick={()=>setPicker('brochure')}>{data.brochure?'替換 PDF':'選擇 PDF'}</button>{!!data.brochure&&<button type="button" disabled={readOnly} onClick={()=>setField('brochure',null)}>移除 PDF</button>}</div>
    <MediaPickerModal open={picker!==null} onOpenChange={open=>{if(!open)setPicker(null);}} mediaKind={picker==='brochure'?'file':'image'} mimeTypeFilter={picker==='brochure'?'application/pdf':undefined} multiple={picker==='gallery'} onSelectMany={items=>{setField('gallery',[...gallery,...items.slice(0,100-gallery.length).map(item=>({image:mediaValue(item),alt:item.alt||'',caption:item.caption||''}))]);setPicker(null);}} onSelect={item=>{if(picker==='gallery')setField('gallery',[...gallery,{image:mediaValue(item),alt:item.alt||'',caption:item.caption||''}]);else if(picker)setField(picker,mediaValue(item));setPicker(null);}} />
  </div>;
}

export function NotesSection({data,readOnly,setField}:Props){
  const [active,setActive]=useState(0);const faq=list(data.faq);const item=faq[active];
  const patch=(key:string,value:unknown)=>setField('faq',faq.map((row,i)=>i===active?{...row,[key]:value}:row));
  return <div className="tw-section-content"><h2>附加資訊與 FAQ</h2><p className="tw-section-description">整理參團須知與常見問題。</p><RichField label="附加資訊" value={data.additional_info} disabled={readOnly} onChange={v=>setField('additional_info',v)}/>
    <div className="tw-inline-heading"><h3>常見問題</h3><button type="button" disabled={readOnly||faq.length>=100} onClick={()=>{setField('faq',[...faq,{_type:'question',_version:1,_key:crypto.randomUUID(),title:'',content:[]}]);setActive(faq.length);}}>新增問題</button></div>
    {item?<><label className="tw-field"><span>選擇問題</span><select value={active} onChange={e=>setActive(Number(e.target.value))}>{faq.map((row,i)=><option value={i} key={text(row._key)||i}>{i+1}. {text(row.title)||'未命名問題'}</option>)}</select></label><label className="tw-field"><span>問題</span><input disabled={readOnly} value={text(item.title)} onChange={e=>patch('title',e.target.value)}/></label><RichField key={text(item._key)} label="回答" value={item.content} disabled={readOnly} onChange={v=>patch('content',v)}/><button type="button" disabled={readOnly} onClick={()=>{setField('faq',faq.filter((_,i)=>i!==active));setActive(Math.max(0,active-1));}}>移除此問題</button></>:<p className="tw-muted">尚未有常見問題。</p>}
  </div>;
}
