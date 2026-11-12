import { definePlugin, type PluginDescriptor } from 'emdash';
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
    admin: {
      entry: options.adminEntry,
    },
  });
}
