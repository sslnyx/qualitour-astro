import { useEffect, useState } from 'react';
import { apiFetch, parseApiResponse } from '@emdash-cms/admin';

type Chip = { state: string; tone: 'ok' | 'busy' | 'warn' | 'error'; label: string; hint: string };

const ROUTE = '/_emdash/api/plugins/qualitour-pages-rebuild/release-summary';

// Shows whether the public site has caught up with the CMS, so editors do not save or publish again while the
// static site is rebuilding. Polls faster while a release is in progress; shows nothing if the status is unavailable.
export function ReleaseChip() {
  const [chip, setChip] = useState<Chip | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      let next = 60_000;
      try {
        const body = await parseApiResponse<Chip>(await apiFetch(ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }), '無法讀取發佈狀態');
        if (active) setChip(body.label ? body : null);
        if (body.state === 'queued' || body.state === 'running') next = 15_000;
      } catch {
        if (active) setChip(null);
      }
      if (active) timer = setTimeout(() => void load(), next);
    };
    const refresh = () => { if (document.visibilityState === 'visible') { if (timer) clearTimeout(timer); void load(); } };
    void load();
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  if (!chip) return null;
  return <span role="status" className={`tw-release tw-release-${chip.tone}`} title={chip.hint}>{chip.label}</span>;
}
