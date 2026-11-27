import { useEffect, useState } from 'react';
import { apiFetch, parseApiResponse } from '@emdash-cms/admin';
import type { TourData } from './tour-editor-model';
import type { DraftEntry } from './draft-session';

const ROUTE = '/_emdash/api/plugins/qualitour-editor/checks';
type Line = { place: string; text: string; editable: boolean };
type Check = { code: string; title: string; action: string; lines: Line[] };
type State = { status: 'checking' | 'failed' | 'done'; checks: Check[] };

export function ContentChecks({ item, data }: { item: DraftEntry; data: TourData }) {
  const [state, setState] = useState<State>({ status: 'checking', checks: [] });
  const [attempt, setAttempt] = useState(0);
  const { id, locale, slug, publishedAt } = item as DraftEntry & { slug?: string | null; publishedAt?: string | null };
  const draft = JSON.stringify({ id, locale, slug, publishedAt, data });

  useEffect(() => {
    let active = true;
    // Wait for a pause in typing, then check what is on screen, saved or not.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await parseApiResponse<{ ok: boolean; checks: Check[] }>(await apiFetch(ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: draft }));
          if (active) setState(result.ok ? { status: 'done', checks: result.checks } : { status: 'failed', checks: [] });
        } catch {
          if (active) setState({ status: 'failed', checks: [] });
        }
      })();
    }, 1500);
    return () => { active = false; clearTimeout(timer); };
  }, [draft, attempt]);

  if (state.status === 'checking') return <div className="tw-checks is-quiet" role="status">正在檢查團資料…</div>;
  if (state.status === 'failed') return <div className="tw-checks is-quiet" role="status">暫時無法自動檢查這個團（不影響儲存和發佈）。<button type="button" onClick={() => { setState({ status: 'checking', checks: [] }); setAttempt(value => value + 1); }}>再試一次</button></div>;
  if (!state.checks.length) return <div className="tw-checks is-quiet" role="status">自動檢查沒有發現問題（圖片和 PDF 裡的文字沒有檢查）。</div>;
  return <details className="tw-checks">
    <summary>⚠ 這個團有 {state.checks.length} 項要確認<span>{state.checks.map(check => check.title).join('、')}</span></summary>
    <div className="tw-checks-body">
      {state.checks.map(check => <section key={check.code}>
        <strong>{check.title}</strong>
        <p>{check.action}</p>
        {check.lines.length > 0 && <ul>{check.lines.map((line, index) => <li key={index}>
          <span className="tw-checks-place">{line.place}</span>「{line.text}」
          {!line.editable && <em>後台看不到這行（舊系統匯入的內容），要修改請通知網站管理員。</em>}
        </li>)}</ul>}
      </section>)}
      <p className="tw-checks-note">網站照原文顯示，系統沒有改位置或內容。提醒不會阻止儲存或發佈，由電腦判斷，可能有誤。</p>
    </div>
  </details>;
}
