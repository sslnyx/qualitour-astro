// Release status for editors: is the public site (static Worker `qualitour-site`) up to date with the CMS?
// The truth lives in the GitHub Actions runs of the release workflow, so this reads them (read-only) and turns
// them into one of: queued, running, live, failed, unknown. Pure functions; the plugin route does the I/O.

const ACTIVE_STATUSES = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
// Typical release is ~3 minutes (2m45s to 3m30s measured); cold caches take ~4.5 minutes.
export const TYPICAL_RELEASE_SECONDS = 180;
export const SLOW_RELEASE_SECONDS = 12 * 60;
// A publish becomes a GitHub run within seconds; inside this window an entry edit may not be visible there yet.
const DISPATCH_GAP_MS = 30_000;
const TIME_ZONE = 'America/Vancouver';
const MAX_RUNS = 10;

const GITHUB_REPO = /^(?!\.+\/)(?!.*\/\.+$)[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const GITHUB_WORKFLOW = /^[A-Za-z0-9_.-]+\.ya?ml$/;

function toTime(value) {
  const parsed = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function describeRun(run) {
  return {
    number: Number.isInteger(run.run_number) ? run.run_number : null,
    status: run.status,
    conclusion: run.conclusion ?? null,
    createdAt: toTime(run.created_at),
    startedAt: toTime(run.run_started_at) ?? toTime(run.created_at),
    finishedAt: run.status === 'completed' ? toTime(run.updated_at) : null,
  };
}

/**
 * runs: GitHub workflow runs, newest first. A run cancelled by GitHub's concurrency group is a burst being
 * coalesced into a newer run, not a failure, so cancelled runs never decide the state.
 */
export function summarizeRuns(runs, now = Date.now()) {
  const list = (Array.isArray(runs) ? runs : []).filter((run) => run && typeof run === 'object').map(describeRun);
  const lastLive = list.find((run) => run.status === 'completed' && run.conclusion === 'success') ?? null;
  const active = list.filter((run) => ACTIVE_STATUSES.has(run.status));
  const decisive = list.find((run) => run.status === 'completed' && run.conclusion !== 'cancelled' && run.conclusion !== 'skipped');

  const live = lastLive ? { number: lastLive.number, finishedAt: lastLive.finishedAt, durationMs: durationOf(lastLive) } : null;

  if (active.length) {
    // The one that is actually building wins over one still waiting behind it.
    const building = active.find((run) => run.status === 'in_progress') ?? active[0];
    const since = building.startedAt ?? building.createdAt ?? now;
    const oldestWaiting = active.reduce((min, run) => Math.min(min, run.createdAt ?? now), now);
    return {
      state: building.status === 'in_progress' ? 'running' : 'queued',
      run: building.number,
      elapsedSeconds: Math.max(0, Math.round((now - since) / 1000)),
      waitingSeconds: Math.max(0, Math.round((now - oldestWaiting) / 1000)),
      followUpQueued: active.length > 1,
      slow: (now - since) / 1000 > SLOW_RELEASE_SECONDS,
      lastLive: live,
    };
  }
  if (!decisive) return { state: 'unknown', lastLive: live };
  if (decisive.conclusion === 'success') {
    return { state: 'live', run: decisive.number, finishedAt: decisive.finishedAt, durationMs: durationOf(decisive), lastLive: live };
  }
  if (FAILED_CONCLUSIONS.has(decisive.conclusion)) {
    return { state: 'failed', run: decisive.number, finishedAt: decisive.finishedAt, lastLive: live };
  }
  return { state: 'unknown', lastLive: live };
}

function durationOf(run) {
  return run.startedAt && run.finishedAt && run.finishedAt >= run.startedAt ? run.finishedAt - run.startedAt : null;
}

export function formatTime(ms) {
  if (!Number.isFinite(ms)) return '—';
  return new Intl.DateTimeFormat('zh-TW', {
    timeZone: TIME_ZONE, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms));
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} 分 ${String(seconds % 60).padStart(2, '0')} 秒` : `${seconds} 秒`;
}

const WAIT_HINT = '前端通常約 3 分鐘後更新。更新完成前請不要重複儲存或發佈；重複操作不會加快，只會多排一次建置。';

/**
 * summary: from summarizeRuns. entry: optional { status, updatedAt } of the entry open in the editor.
 * Returns Block Kit blocks (@emdash-cms/blocks) for the dashboard widget and the editor panel.
 * @param {any} summary
 * @param {{ entry?: { status: string, updatedAt: string }, now?: number }} [options]
 */
export function renderBlocks(summary, { entry, now = Date.now() } = {}) {
  const blocks = [];
  const lastLive = summary.lastLive?.finishedAt ? `前端目前是 ${formatTime(summary.lastLive.finishedAt)} 的版本。` : '';
  const justEdited = entry?.status === 'published' && toTime(entry.updatedAt) !== null
    && now - toTime(entry.updatedAt) < DISPATCH_GAP_MS && now - toTime(entry.updatedAt) >= 0;

  switch (summary.state) {
    case 'queued':
      blocks.push({
        type: 'banner', variant: 'default',
        title: '已送出，排隊等待建置',
        description: `已排隊 ${formatDuration(summary.waitingSeconds)}。${WAIT_HINT}`,
      });
      break;
    case 'running':
      blocks.push(summary.slow
        ? {
          type: 'banner', variant: 'alert',
          title: '發佈比平常久',
          description: `已進行 ${formatDuration(summary.elapsedSeconds)}（平常約 3 分鐘）。請先不要重複發佈，若超過 15 分鐘仍未完成請通知技術人員。${lastLive}`,
        }
        : {
          type: 'banner', variant: 'default',
          title: `發佈中（已 ${formatDuration(summary.elapsedSeconds)}）`,
          description: `${WAIT_HINT}${lastLive}`,
        });
      if (summary.followUpQueued) {
        blocks.push({ type: 'context', text: '之後又有新的發佈，將在這次完成後接著更新一次。' });
      }
      break;
    case 'failed':
      blocks.push({
        type: 'banner', variant: 'error',
        title: '最近一次發佈失敗，前端沒有更新',
        description: `${lastLive || '前端維持上一個版本，訪客看到的網站沒有壞。'}請不要反覆重試，請通知技術人員並提供發佈編號 #${summary.run ?? '—'}（${formatTime(summary.finishedAt)}）。`,
      });
      break;
    case 'live':
      if (justEdited) {
        blocks.push({
          type: 'banner', variant: 'default',
          title: '剛送出更新，正在確認',
          description: '請稍候幾秒後按「重新整理」；確認後這裡會顯示「發佈中」。',
        });
      } else {
        blocks.push({
          type: 'banner', variant: 'default',
          title: '前端已是最新',
          description: `最近一次發佈 #${summary.run ?? '—'} 於 ${formatTime(summary.finishedAt)} 完成${summary.durationMs ? `，花了 ${formatDuration(summary.durationMs / 1000)}` : ''}。`,
        });
      }
      break;
    default:
      blocks.push({
        type: 'banner', variant: 'alert',
        title: '暫時無法取得發佈狀態',
        description: '這不影響內容儲存。請稍後按「重新整理」；若持續出現請通知技術人員。',
      });
  }

  if (entry) {
    const pieces = [];
    if (entry.status === 'published') pieces.push('此內容目前是「已發佈」，');
    else pieces.push('此內容目前不是「已發佈」，儲存草稿不會更新前端；');
    pieces.push('只有「發佈、取消發佈、刪除」才會觸發前端更新。');
    blocks.push({ type: 'context', text: pieces.join('') });
  }
  blocks.push({
    type: 'actions',
    elements: [{ type: 'button', action_id: 'refresh', label: '重新整理', style: 'secondary' }],
  });
  return blocks;
}

/**
 * Short label for the tour editor's header. tone: 'ok' | 'busy' | 'warn' | 'error'. Empty label = show nothing.
 * @param {any} summary
 */
export function chipLabel(summary) {
  switch (summary?.state) {
    case 'queued': return { tone: 'busy', label: '前端：排隊等待發佈', hint: WAIT_HINT };
    case 'running': {
      const clock = `${Math.floor(summary.elapsedSeconds / 60)}:${String(summary.elapsedSeconds % 60).padStart(2, '0')}`;
      return summary.slow
        ? { tone: 'warn', label: `前端：發佈較久（${clock}）`, hint: '比平常久，請先不要重複發佈；超過 15 分鐘請通知技術人員。' }
        : { tone: 'busy', label: `前端：發佈中 ${clock}`, hint: WAIT_HINT };
    }
    case 'failed': return { tone: 'error', label: `前端：發佈失敗 #${summary.run ?? '—'}`, hint: '前端維持上一個版本。請不要反覆重試，通知技術人員並提供發佈編號。' };
    case 'live': return { tone: 'ok', label: `前端已最新 · ${formatTime(summary.finishedAt)}`, hint: `最近一次發佈 #${summary.run ?? '—'}。` };
    default: return { tone: 'warn', label: '', hint: '' };
  }
}

/** Newest-first run list for the release workflow. Never throws: a failure is reported as `unknown`. */
export async function fetchReleaseRuns({ token, repo, workflow, fetchImpl }) {
  if (typeof token !== 'string' || !token.trim() || !GITHUB_REPO.test(repo ?? '') || !GITHUB_WORKFLOW.test(workflow ?? '')) {
    return { ok: false, reason: 'configuration' };
  }
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=${MAX_RUNS}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'qualitour-pages-rebuild',
        },
        signal: AbortSignal.timeout(4_000),
      },
    );
    if (!response.ok) return { ok: false, reason: `http-${response.status}` };
    const body = await response.json();
    return { ok: true, runs: Array.isArray(body?.workflow_runs) ? body.workflow_runs : [] };
  } catch {
    return { ok: false, reason: 'request' };
  }
}
