import assert from 'node:assert/strict';
import test from 'node:test';

import {
  fetchReleaseRuns,
  formatDuration,
  renderBlocks,
  summarizeRuns,
} from '../src/plugins/pages-rebuild/release-status.mjs';

const NOW = Date.parse('2026-11-14T20:00:00Z');
const iso = (secondsAgo) => new Date(NOW - secondsAgo * 1000).toISOString();

function run(number, status, conclusion, startedAgo, endedAgo = startedAgo) {
  return {
    run_number: number,
    status,
    conclusion,
    created_at: iso(startedAgo + 3),
    run_started_at: iso(startedAgo),
    updated_at: iso(status === 'completed' ? Math.min(endedAgo, startedAgo) : 0),
  };
}

test('an in-progress run is "running" with its elapsed time and the previous live version', () => {
  const summary = summarizeRuns([run(12, 'in_progress', null, 75), run(11, 'completed', 'success', 900, 720)], NOW);
  assert.equal(summary.state, 'running');
  assert.equal(summary.run, 12);
  assert.equal(summary.elapsedSeconds, 75);
  assert.equal(summary.slow, false);
  assert.equal(summary.followUpQueued, false);
  assert.equal(summary.lastLive.number, 11);
});

test('a waiting run behind a building run is reported as a follow-up, not as the state', () => {
  const summary = summarizeRuns([run(13, 'queued', null, 20), run(12, 'in_progress', null, 100)], NOW);
  assert.equal(summary.state, 'running');
  assert.equal(summary.run, 12);
  assert.equal(summary.followUpQueued, true);
});

test('only a queued run is "queued"', () => {
  const summary = summarizeRuns([run(13, 'queued', null, 40), run(12, 'completed', 'success', 500, 330)], NOW);
  assert.equal(summary.state, 'queued');
  assert.equal(summary.waitingSeconds, 43);
});

test('a run stuck for more than 12 minutes is flagged slow', () => {
  assert.equal(summarizeRuns([run(5, 'in_progress', null, 13 * 60)], NOW).slow, true);
  assert.equal(summarizeRuns([run(5, 'in_progress', null, 11 * 60)], NOW).slow, false);
});

test('a successful newest run is "live" with its duration', () => {
  const summary = summarizeRuns([run(20, 'completed', 'success', 400, 220)], NOW);
  assert.equal(summary.state, 'live');
  assert.equal(summary.run, 20);
  assert.equal(summary.durationMs, 180_000);
});

test('a failed newest run is "failed" and keeps the last good version', () => {
  const summary = summarizeRuns([run(21, 'completed', 'failure', 300, 200), run(20, 'completed', 'success', 900, 700)], NOW);
  assert.equal(summary.state, 'failed');
  assert.equal(summary.run, 21);
  assert.equal(summary.lastLive.number, 20);
});

test('a later success clears an earlier failure', () => {
  const summary = summarizeRuns([run(22, 'completed', 'success', 100, 10), run(21, 'completed', 'failure', 500, 400)], NOW);
  assert.equal(summary.state, 'live');
});

test('a run cancelled by the concurrency group is not a failure', () => {
  const summary = summarizeRuns([
    run(24, 'completed', 'cancelled', 30, 20),
    run(23, 'completed', 'success', 300, 120),
  ], NOW);
  assert.equal(summary.state, 'live');
  assert.equal(summary.run, 23);
});

test('no usable runs, or garbage input, is "unknown" without throwing', () => {
  assert.equal(summarizeRuns([], NOW).state, 'unknown');
  assert.equal(summarizeRuns(undefined, NOW).state, 'unknown');
  assert.equal(summarizeRuns([null, 5, 'x'], NOW).state, 'unknown');
  assert.equal(summarizeRuns([run(1, 'completed', 'cancelled', 50)], NOW).state, 'unknown');
});

test('blocks: running tells editors not to save again; failed is an error banner with the run number', () => {
  const running = renderBlocks(summarizeRuns([run(12, 'in_progress', null, 75)], NOW), { now: NOW });
  assert.equal(running[0].type, 'banner');
  assert.match(running[0].title, /發佈中.*1 分 15 秒/);
  assert.match(running[0].description, /請不要重複儲存或發佈/);

  const failed = renderBlocks(summarizeRuns([run(21, 'completed', 'failure', 300, 200), run(20, 'completed', 'success', 900, 700)], NOW), { now: NOW });
  assert.equal(failed[0].variant, 'error');
  assert.match(failed[0].description, /#21/);
  assert.match(failed[0].description, /上一個版本|前端目前是/);
  assert.equal(failed.at(-1).type, 'actions');
  assert.equal(failed.at(-1).elements[0].action_id, 'refresh');
});

test('blocks: an entry saved moments ago but not yet seen by GitHub shows "confirming", not "up to date"', () => {
  const live = summarizeRuns([run(20, 'completed', 'success', 900, 700)], NOW);
  const fresh = renderBlocks(live, { entry: { status: 'published', updatedAt: iso(8) }, now: NOW });
  assert.match(fresh[0].title, /正在確認/);
  const old = renderBlocks(live, { entry: { status: 'published', updatedAt: iso(600) }, now: NOW });
  assert.match(old[0].title, /已是最新/);
});

test('blocks: a draft entry explains that saving does not update the front end', () => {
  const blocks = renderBlocks(summarizeRuns([], NOW), { entry: { status: 'draft', updatedAt: iso(5) }, now: NOW });
  assert.ok(blocks.some((block) => block.type === 'context' && /儲存草稿不會更新前端/.test(block.text)));
});

test('every block type used is a valid Block Kit block', async () => {
  const { validateBlockResponse } = await import('@emdash-cms/blocks/server');
  for (const runs of [
    [], [run(1, 'queued', null, 10)], [run(1, 'in_progress', null, 10)], [run(1, 'in_progress', null, 20 * 60)],
    [run(2, 'completed', 'failure', 100, 50)], [run(2, 'completed', 'success', 100, 50)],
  ]) {
    const response = { blocks: renderBlocks(summarizeRuns(runs, NOW), { entry: { status: 'published', updatedAt: iso(500) }, now: NOW }) };
    const result = validateBlockResponse(response, {});
    assert.equal(result.valid, true, JSON.stringify(result.errors));
  }
});

test('fetchReleaseRuns validates configuration, reads read-only and never throws', async () => {
  assert.deepEqual(await fetchReleaseRuns({ token: '', repo: 'a/b', workflow: 'w.yml', fetchImpl: async () => assert.fail() }), { ok: false, reason: 'configuration' });
  assert.deepEqual(await fetchReleaseRuns({ token: 't', repo: '../x', workflow: 'w.yml', fetchImpl: async () => assert.fail() }), { ok: false, reason: 'configuration' });

  let seen;
  const ok = await fetchReleaseRuns({
    token: ' secret ', repo: 'sslnyx/qualitour-astro', workflow: 'site-release.yml',
    fetchImpl: async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ workflow_runs: [{ run_number: 1 }] })); },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.runs.length, 1);
  assert.equal(seen.init.method, 'GET');
  assert.equal(seen.init.headers.Authorization, 'Bearer secret');
  assert.match(seen.url, /^https:\/\/api\.github\.com\/repos\/sslnyx\/qualitour-astro\/actions\/workflows\/site-release\.yml\/runs\?per_page=10$/);

  const denied = await fetchReleaseRuns({ token: 't', repo: 'a/b', workflow: 'w.yml', fetchImpl: async () => new Response('no', { status: 403 }) });
  assert.deepEqual(denied, { ok: false, reason: 'http-403' });
  const broken = await fetchReleaseRuns({ token: 't', repo: 'a/b', workflow: 'w.yml', fetchImpl: async () => { throw new Error('boom secret'); } });
  assert.deepEqual(broken, { ok: false, reason: 'request' });
});

test('formatDuration', () => {
  assert.equal(formatDuration(45), '45 秒');
  assert.equal(formatDuration(75), '1 分 15 秒');
  assert.equal(formatDuration(180), '3 分 00 秒');
});

test('chipLabel: short header label per state, empty when unknown', async () => {
  const { chipLabel } = await import('../src/plugins/pages-rebuild/release-status.mjs');
  assert.match(chipLabel(summarizeRuns([run(12, 'in_progress', null, 75)], NOW)).label, /發佈中 1:15/);
  assert.equal(chipLabel(summarizeRuns([run(12, 'in_progress', null, 75)], NOW)).tone, 'busy');
  assert.equal(chipLabel(summarizeRuns([run(12, 'in_progress', null, 20 * 60)], NOW)).tone, 'warn');
  assert.equal(chipLabel(summarizeRuns([run(13, 'queued', null, 10)], NOW)).tone, 'busy');
  assert.match(chipLabel(summarizeRuns([run(21, 'completed', 'failure', 300, 200)], NOW)).label, /發佈失敗 #21/);
  assert.equal(chipLabel(summarizeRuns([run(21, 'completed', 'failure', 300, 200)], NOW)).tone, 'error');
  assert.match(chipLabel(summarizeRuns([run(20, 'completed', 'success', 400, 220)], NOW)).label, /前端已最新/);
  assert.equal(chipLabel(summarizeRuns([], NOW)).label, '');
});
