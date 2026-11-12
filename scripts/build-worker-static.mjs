import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_WORKER_ORIGIN = 'https://qualitour.qualitour.workers.dev';
const DEFAULT_CMS_ORIGIN = DEFAULT_WORKER_ORIGIN;
const PUBLIC_ORIGINS = new Set([DEFAULT_WORKER_ORIGIN, 'https://qualitour.ca']);
const CMS_ORIGINS = new Set([
  'https://qualitour-cms-free-test.qualitour.workers.dev',
  DEFAULT_WORKER_ORIGIN,
  'https://qualitour.ca',
]);

function approved(value, values, name) {
  if (!values.has(value)) throw new Error(`${name} is not an approved HTTPS origin`);
  return value;
}

const workerOrigin = approved(
  process.env.QUALITOUR_WORKER_ORIGIN || DEFAULT_WORKER_ORIGIN,
  PUBLIC_ORIGINS,
  'QUALITOUR_WORKER_ORIGIN',
);
const cmsOrigin = approved(
  process.env.QUALITOUR_CMS_ORIGIN || DEFAULT_CMS_ORIGIN,
  CMS_ORIGINS,
  'QUALITOUR_CMS_ORIGIN',
);
const indexableValue = process.env.QUALITOUR_WORKER_INDEXABLE || 'false';
if (!['true', 'false'].includes(indexableValue)) {
  throw new Error('QUALITOUR_WORKER_INDEXABLE must be true or false');
}
if (indexableValue === 'true' && workerOrigin.endsWith('.workers.dev')) {
  throw new Error('workers.dev frontend cannot be indexable');
}

const outputDirectory = process.env.WORKER_STATIC_OUT_DIR || '.astro/worker-release/frontend';
const resolvedOutput = resolve(outputDirectory);
const rootDist = resolve('dist');
if (resolvedOutput === resolve('.') || resolvedOutput === rootDist || resolvedOutput.startsWith(`${rootDist}${sep}`)) {
  throw new Error('WORKER_STATIC_OUT_DIR must be separate from the repository root and root dist');
}

const astroPackage = JSON.parse(await readFile('node_modules/astro/package.json', 'utf8'));
const executable = typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro;
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' });
const releaseCommit = process.env.WORKER_RELEASE_COMMIT || process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || (git.status === 0 ? git.stdout.trim() : 'local');
const environment = {
  ...process.env,
  WORKER_RELEASE_COMMIT: releaseCommit,
  DEPLOY_TARGET: 'production',
  WORKER_STATIC_OUT_DIR: outputDirectory,
  QUALITOUR_WORKER_ORIGIN: workerOrigin,
  QUALITOUR_CMS_ORIGIN: cmsOrigin,
  QUALITOUR_WORKER_INDEXABLE: indexableValue,
};

const build = spawnSync(
  process.execPath,
  [resolve('node_modules/astro', executable), 'build', '--config', 'astro.config.worker-static.mjs'],
  { stdio: 'inherit', env: environment },
);
if (build.error) throw build.error;
if (build.status !== 0) throw new Error(`Astro Worker static build failed (${build.status ?? build.signal})`);

const finalize = spawnSync(
  'python3',
  [
    'scripts/finalize-pages-static.py',
    '--dist', outputDirectory,
    '--origin', workerOrigin,
    '--cms-origin', cmsOrigin,
    '--target', 'worker-static',
    '--indexable', indexableValue,
  ],
  { stdio: 'inherit', env: environment },
);
if (finalize.error) throw finalize.error;
if (finalize.status !== 0) throw new Error(`Worker static finalization failed (${finalize.status ?? finalize.signal})`);
