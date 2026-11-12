// Optimized visitor frontend for the combined Qualitour Worker asset collection.
// The CMS runtime is built separately; this target writes only frontend static files.
import { resolve, sep } from 'node:path';
import { mergeConfig } from 'astro/config';
import staticConfig from './astro.config.mjs';
import { resolveCmsOrigin } from './src/lib/cms/read-client.mjs';

const DEFAULT_WORKER_ORIGIN = 'https://qualitour.qualitour.workers.dev';
const PUBLIC_ORIGINS = new Set([DEFAULT_WORKER_ORIGIN, 'https://qualitour.ca']);
const origin = process.env.QUALITOUR_WORKER_ORIGIN || DEFAULT_WORKER_ORIGIN;
if (!PUBLIC_ORIGINS.has(origin)) {
  throw new Error('QUALITOUR_WORKER_ORIGIN is not an approved HTTPS origin');
}
const cmsOrigin = resolveCmsOrigin(process.env.QUALITOUR_CMS_ORIGIN || DEFAULT_WORKER_ORIGIN);
const indexableValue = process.env.QUALITOUR_WORKER_INDEXABLE || 'false';
if (!['true', 'false'].includes(indexableValue)) {
  throw new Error('QUALITOUR_WORKER_INDEXABLE must be true or false');
}
if (indexableValue === 'true' && origin.endsWith('.workers.dev')) {
  throw new Error('workers.dev frontend cannot be indexable');
}
const outDir = process.env.WORKER_STATIC_OUT_DIR || './.astro/worker-release/frontend';
const resolvedOutDir = resolve(outDir);
const rootDist = resolve('dist');
if (resolvedOutDir === resolve('.') || resolvedOutDir === rootDist || resolvedOutDir.startsWith(`${rootDist}${sep}`)) {
  throw new Error('WORKER_STATIC_OUT_DIR must be separate from the repository root and root dist');
}

export default mergeConfig(staticConfig, {
  site: origin,
  base: '/',
  outDir,
  image: {
    remotePatterns: [{ protocol: 'https', hostname: new URL(cmsOrigin).hostname }],
  },
  vite: {
    define: { 'import.meta.env.PUBLIC_SITE_INDEXABLE': JSON.stringify(indexableValue) },
  },
});
