import { useEffect, useRef, useState } from 'react';
import { getPreviewUrl } from '@emdash-cms/admin';
import { matchesPreviewAck, previewRevision, type PreviewRequest, type PreviewSection, type DayRef } from '../../lib/cms/preview-focus';
import type { DraftEntry } from './draft-session';

export function PreviewPane({ item, section, day, dirty }: { item: DraftEntry; section: PreviewSection; day?: DayRef; dirty: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const pending = useRef<PreviewRequest | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [url, setUrl] = useState('');
  const [frameVersion,setFrameVersion]=useState(0);
  const [status, setStatus] = useState('預覽載入中…');
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState(0);
  const [narrow, setNarrow] = useState(false);
  const revision = previewRevision(item as unknown as Record<string, unknown>);
  const identity = `${item.id}:${item.locale}`;
  const context = `${identity}:${revision}`;
  const fullPreviewUrl = new URL(url || window.location.origin);
  fullPreviewUrl.searchParams.delete('workspace');
  const lastIdentity = useRef(identity);
  const request = { type: 'qualitour:preview-focus', requestId: '', entryId: item.id, locale: item.locale as 'en' | 'zh', revision: revision || '', section, ...(day ? { day } : {}) } satisfies PreviewRequest;
  const targetRef = useRef(request); targetRef.current = request;
  const send = () => {
    if (pending.current) frame.current?.contentWindow?.postMessage(pending.current, window.location.origin);
  };

  const beginCheck = () => {
    const next={...targetRef.current,requestId:crypto.randomUUID()};
    pending.current=next;clearTimeout(timeoutRef.current);
    setReady(false);setStatus('正在對照已儲存內容…');
    timeoutRef.current=setTimeout(()=>{if(pending.current===next){setReady(false);setStatus('預覽未能確認最新內容，請重試。');}},20000);
    send();
  };

  useEffect(() => {
    let active = true;
    if (lastIdentity.current !== identity) { setUrl(''); lastIdentity.current = identity; }
    setReady(false); setStatus('預覽載入中…');
    if (!revision) { setStatus('這份內容沒有可核對的儲存版本，請先儲存草稿。'); return; }
    void getPreviewUrl('tours', item.id, { pathPattern: '/{locale}/cms-proof/tours/{id}' }).then(result => {
      if (!active) return;
      if (!result?.url) throw new Error('preview unavailable');
      const signed = new URL(result.url, window.location.origin);
      if (signed.origin !== window.location.origin) throw new Error('preview origin mismatch');
      signed.searchParams.set('workspace', '1');
      setUrl(signed.href);
      // Signed URLs can be identical within one second, including after a
      // new draft save. A successful refresh must still reload the document.
      setFrameVersion(version=>version+1);
    }).catch(() => { if (active) { setReady(false); setStatus('無法開啟草稿預覽。請重試；目前畫面可能是較早的版本。'); } });
    return () => { active = false; };
  }, [context, reload]);

  useEffect(() => {
    beginCheck();
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      const current = pending.current;
      if (!current) return;
      if (event.data.type === 'qualitour:preview-mounted' && event.data.entryId === current.entryId && event.data.locale === current.locale && event.data.revision === current.revision) {
        send(); return;
      }
      if (event.data.type !== 'qualitour:preview-ready' || event.data.requestId !== current.requestId) return;
      clearTimeout(timeoutRef.current);
      if (matchesPreviewAck(event.data, current)) { setReady(true); setStatus(`已更新 · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`); }
      else { setReady(false); setStatus('預覽內容與已儲存版本或選取位置不一致，請重試。'); }
    };
    window.addEventListener('message', receive);
    return () => { clearTimeout(timeoutRef.current); window.removeEventListener('message', receive); };
  }, [context, section, day?.field, day?.key, reload]);

  return <aside className="tw-preview" aria-label="行程預覽">
    <div className="tw-preview-head"><div><strong>內容預覽</strong><span className="tw-muted">前台版面 · 已儲存草稿</span></div>
      <div className="tw-actions"><button type="button" onClick={() => setNarrow(v => !v)} aria-pressed={narrow}>{narrow ? '寬版' : '窄版'}</button><button type="button" onClick={() => setReload(v => v + 1)}>更新預覽</button></div></div>
    <p role="status" className={`tw-preview-status ${ready ? 'is-ready' : ''}`}>{status}{dirty ? ' · 尚未包含未儲存修改' : ''}</p>
    <div className={`tw-frame-wrap ${narrow ? 'is-narrow' : ''}`}>
      {url ? <iframe key={frameVersion} ref={frame} src={url} title="已儲存的行程草稿預覽" referrerPolicy="no-referrer" onLoad={beginCheck} /> : <div className="tw-empty">正在準備私人預覽…</div>}
    </div>
    <div className="tw-preview-foot">{narrow ? '窄版排版檢查 · 非真機測試' : '預覽會定位目前選取的內容'}{url && <a href={fullPreviewUrl.href} target="_blank" rel="noreferrer">開啟完整預覽 ↗</a>}</div>
  </aside>;
}
