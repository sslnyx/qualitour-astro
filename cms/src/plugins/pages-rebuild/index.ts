import { fileURLToPath } from 'node:url';
import type { PluginDescriptor } from 'emdash';

const PLUGIN_ID = 'qualitour-pages-rebuild';
const PLUGIN_VERSION = '0.1.0';

export function pagesRebuildPlugin(): PluginDescriptor {
  return {
    id: PLUGIN_ID,
    version: PLUGIN_VERSION,
    format: 'native',
    entrypoint: fileURLToPath(new URL('./server.ts', import.meta.url)),
    options: {},
  };
}
