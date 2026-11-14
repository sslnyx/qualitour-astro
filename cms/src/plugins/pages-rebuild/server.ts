/// <reference types="@cloudflare/workers-types" />

import { env } from 'cloudflare:workers';
import { definePlugin, type PluginContext, type PluginRoute, type RouteContext } from 'emdash';

import { createPagesRebuildHandler } from './notifier.mjs';
import { chipLabel, fetchReleaseRuns, renderBlocks, summarizeRuns } from './release-status.mjs';

const PLUGIN_ID = 'qualitour-pages-rebuild';
const PLUGIN_VERSION = '0.1.0';
const HOOK_TIMEOUT_MS = 5_500;

type RebuildEvent = { collection: string };

// The public site is rebuilt by the GitHub Actions workflow below. Its repository, workflow and branch are public
// configuration; only the dispatch token (a fine-grained token limited to "Actions: write") is a secret.
const GITHUB_DISPATCH = { repo: 'sslnyx/qualitour-astro', workflow: 'site-release.yml', ref: 'main' };

function readDeployHookUrls(): { githubDispatch?: unknown; workersHookUrl: unknown; pagesHookUrl: unknown } {
  const bindings = env as Record<string, unknown>;
  const token = bindings.GITHUB_DISPATCH_TOKEN;
  return {
    ...(token !== undefined ? { githubDispatch: { ...GITHUB_DISPATCH, token } } : {}),
    workersHookUrl: bindings.CF_WORKERS_DEPLOY_HOOK_URL,
    pagesHookUrl: bindings.CF_PAGES_DEPLOY_HOOK_URL,
  };
}

async function handlePublicTourChange(event: RebuildEvent, ctx: PluginContext): Promise<void> {
  const handler = createPagesRebuildHandler({
    getHookUrls: readDeployHookUrls,
    fetchImpl: (url: string, init: RequestInit) => {
      if (!ctx.http) throw new Error('Public site rebuild HTTP access unavailable');
      return ctx.http.fetch(url, init);
    },
    logError: (message: string) => ctx.log.error(message),
  });

  await handler(event);
}

// Editors open the dashboard and every tour page, so the GitHub read is shared for a few seconds per isolate.
const STATUS_CACHE_MS = 8_000;
let statusCache: { at: number; summary: ReturnType<typeof summarizeRuns> } | undefined;

async function readReleaseSummary(ctx: PluginContext) {
  const now = Date.now();
  if (statusCache && now - statusCache.at < STATUS_CACHE_MS) return statusCache.summary;
  const token = (env as Record<string, unknown>).GITHUB_DISPATCH_TOKEN;
  const result = await fetchReleaseRuns({
    token,
    repo: GITHUB_DISPATCH.repo,
    workflow: GITHUB_DISPATCH.workflow,
    fetchImpl: (url: string, init: RequestInit) => {
      if (!ctx.http) throw new Error('Release status HTTP access unavailable');
      return ctx.http.fetch(url, init);
    },
  });
  if (!result.ok) {
    ctx.log.warn(`Release status unavailable: ${result.reason}`);
    return summarizeRuns([], now);
  }
  const summary = summarizeRuns(result.runs, now);
  statusCache = { at: now, summary };
  return summary;
}

// Block Kit routes. Both are read-only; they reveal no secret and only the state of the public site release.
const releaseStatusRoutes: Record<string, PluginRoute> = {
  // Dashboard widget: the host posts { type: 'page_load' | 'block_action', page: 'widget:release-status' } here.
  admin: {
    permission: 'content:read' as const,
    async handler(ctx: RouteContext) {
      return { blocks: renderBlocks(await readReleaseSummary(ctx)) };
    },
  },
  // Compact JSON for the custom tour editor header (the host's sidebar panels are not shown on that page).
  'release-summary': {
    permission: 'content:read' as const,
    async handler(ctx: RouteContext) {
      const summary = await readReleaseSummary(ctx);
      return { state: summary.state, run: summary.run ?? null, ...chipLabel(summary) };
    },
  },
  // Panel on the tour and review edit screens (declared in `admin.editorPanels`).
  'release-panel': {
    permission: 'content:read' as const,
    async handler(ctx: RouteContext) {
      const entryRef = ctx.ui && 'entry' in ctx.ui ? ctx.ui.entry : undefined;
      let entry: { status: string; updatedAt: string } | undefined;
      if (entryRef && ctx.content) {
        const item = await ctx.content.get(entryRef.collection, entryRef.id).catch(() => null);
        if (item) entry = { status: item.status, updatedAt: item.updatedAt };
      }
      return { blocks: renderBlocks(await readReleaseSummary(ctx), { entry }) };
    },
  },
};

export function createPlugin() {
  return definePlugin({
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    capabilities: ['content:read', 'network:request'],
    allowedHosts: ['api.cloudflare.com', 'api.github.com'],
    routes: releaseStatusRoutes,
    admin: {
      widgets: [{ id: 'release-status', size: 'half', title: '網站發佈狀態' }],
      editorPanels: [
        { id: 'release-status', title: '網站發佈狀態', route: 'release-panel', collections: ['tours', 'google_reviews'], order: 100 },
      ],
    },
    hooks: {
      'content:afterPublish': {
        handler: handlePublicTourChange,
        timeout: HOOK_TIMEOUT_MS,
        errorPolicy: 'continue',
      },
      'content:afterUnpublish': {
        handler: handlePublicTourChange,
        timeout: HOOK_TIMEOUT_MS,
        errorPolicy: 'continue',
      },
      'content:afterDelete': {
        handler: handlePublicTourChange,
        timeout: HOOK_TIMEOUT_MS,
        errorPolicy: 'continue',
      },
    },
  });
}
