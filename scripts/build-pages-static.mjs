import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const outputDirectory = process.env.PAGES_STATIC_OUT_DIR || '.astro/cloudflare-release/dist';
const astroPackage = JSON.parse(await readFile('node_modules/astro/package.json', 'utf8'));
const executable = typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro;
const environment = {
  ...process.env,
  DEPLOY_TARGET: 'staging',
  PAGES_STATIC_OUT_DIR: outputDirectory,
};

const build = spawnSync(
  process.execPath,
  [resolve('node_modules/astro', executable), 'build', '--config', 'astro.config.pages-static.mjs'],
  { stdio: 'inherit', env: environment },
);
if (build.error) throw build.error;
if (build.status !== 0) throw new Error(`Astro Pages static build failed (${build.status ?? build.signal})`);

const finalize = spawnSync(
  'python3',
  ['scripts/finalize-pages-static.py', '--dist', outputDirectory],
  { stdio: 'inherit', env: environment },
);
if (finalize.error) throw finalize.error;
if (finalize.status !== 0) throw new Error(`Pages static finalization failed (${finalize.status ?? finalize.signal})`);
