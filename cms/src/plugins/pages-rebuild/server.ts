/// <reference types="@cloudflare/workers-types" />

import { env } from 'cloudflare:workers';
import { definePlugin, type PluginContext } from 'emdash';

import { createPagesRebuildHandler } from './notifier.mjs';

const PLUGIN_ID = 'qualitour-pages-rebuild';
const PLUGIN_VERSION = '0.1.0';
const HOOK_TIMEOUT_MS = 5_500;

type RebuildEvent = { collection: string };

function readDeployHookUrls(): { workersHookUrl: unknown; pagesHookUrl: unknown } {
  const bindings = env as Record<string, unknown>;
  return {
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

export function createPlugin() {
  return definePlugin({
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    capabilities: ['content:read', 'network:request'],
    allowedHosts: ['api.cloudflare.com'],
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
