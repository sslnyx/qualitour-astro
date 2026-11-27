import { definePlugin, type PluginDescriptor, type RouteContext } from 'emdash';
import { fileURLToPath } from 'node:url';

export function tourEditorPlugin(): PluginDescriptor {
  const adminEntry = fileURLToPath(new URL('./admin.tsx', import.meta.url));
  return {
    id: 'qualitour-editor', version: '0.1.0', format: 'native',
    entrypoint: fileURLToPath(new URL('./index.ts', import.meta.url)),
    adminEntry, options: { adminEntry },
  };
}

export function createPlugin(options: { adminEntry: string }) {
  return definePlugin({
    id: 'qualitour-editor', version: '0.1.0',
    routes: {
      // Reminders for the draft on screen. Signed-in editors only; the draft arrives in the request, nothing is saved.
      checks: {
        permission: 'content:read' as const,
        async handler(ctx: RouteContext) {
          // Loaded on first use: the import data is large and this file is also read by the build config.
          const [{ checkDraft }, compatibility] = await Promise.all([
            import('./checks-route.mjs'), import('../../../../src/data/cms-legacy-compat.json', { with: { type: 'json' } }),
          ]);
          return checkDraft(ctx.input, compatibility.default, new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver' }).format(new Date()));
        },
      },
    },
    admin: {
      entry: options.adminEntry,
    },
  });
}
