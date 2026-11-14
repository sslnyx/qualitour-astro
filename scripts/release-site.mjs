#!/usr/bin/env node
// One command for the content release of `qualitour-site` (Workers Builds build command, or a workstation):
//   1. build the CMS client assets (hashed JS/CSS, fonts, public files) with the unchanged Astro config;
//   2. crawl the CMS rendering and assemble the static site (scripts/build-site.mjs).
// Deploying is a separate step (`npm run deploy:site`, or the Workers Builds deploy command) so a failed build
// never replaces the live release. Needs EMDASH_TOKEN (read access to the CMS) outside a logged-in workstation.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origin = process.env.QUALITOUR_CMS_ORIGIN || 'https://qualitour.qualitour.workers.dev';
const cmsOut = resolve(process.env.SITE_CMS_BUILD_DIR || '.astro/site-cms');
const env = { ...process.env, QUALITOUR_CMS_ORIGIN: origin, WORKER_CMS_OUT_DIR: cmsOut, SITE_BASE_ASSETS: cmsOut + '/client' };

function run(command, args) {
  const started = Date.now();
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) { console.error(`${args[0]} failed (${result.status})`); process.exit(result.status || 1); }
  console.log(`[release-site] ${args[0]} took ${Math.round((Date.now() - started) / 1000)}s`);
}

const astro = JSON.parse(readFileSync('node_modules/astro/package.json', 'utf8'));
const astroBin = resolve('node_modules/astro', typeof astro.bin === 'string' ? astro.bin : astro.bin.astro);
run(process.execPath, [astroBin, 'build', '--config', 'astro.config.worker-cms.mjs']);
run(process.execPath, ['scripts/build-site.mjs']);
