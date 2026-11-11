import { rm, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { deploymentConfig } from '../src/lib/site-config.ts';

const site = deploymentConfig(process.env.DEPLOY_TARGET || 'staging');
const started = performance.now();
// Always refresh CMS content, while retaining Astro's independent image cache.
await rm('.astro/wordpress-cache', { recursive: true, force: true });
const astroPackage = JSON.parse(await readFile('node_modules/astro/package.json', 'utf8'));
const executable = typeof astroPackage.bin === 'string' ? astroPackage.bin : astroPackage.bin.astro;
const args = [resolve('node_modules/astro', executable), 'build'];
if (process.env.ASTRO_BUILD_TIMINGS === 'true') args.push('--timings');
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env: { ...process.env, DEPLOY_TARGET: site.target, PUBLIC_WORDPRESS_CUSTOM_API_URL: site.wordpressApi },
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`Astro build failed (${result.status ?? result.signal})`);
const finalize = spawnSync('python3', ['scripts/finalize-static-build.py', '--target', site.target], { stdio: 'inherit' });
if (finalize.status !== 0) throw new Error('Static output finalization failed');
console.log(`[cPanel build] ${(performance.now() - started).toFixed(0)}ms`);
