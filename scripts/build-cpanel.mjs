import { rename, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

// Content must be current; image transformations may be reused across builds.
await rm('.astro/wordpress-cache', { recursive: true, force: true });
const api = 'src/pages/api';
const excluded = 'src/cpanel-excluded-api';
if (existsSync(excluded)) throw new Error('Previous excluded API directory exists; inspect before building');
const moved = existsSync(api);
const started = performance.now();
try {
  if (moved) await rename(api, excluded);
  const result = spawnSync(process.execPath, ['node_modules/astro/astro.js', 'build', '--config', 'astro.config.cpanel.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, PUBLIC_WORDPRESS_CUSTOM_API_URL: 'https://qualitour.ca/wp-json/qualitour/v1' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Astro build failed (${result.status ?? result.signal})`);
  await cp('public/.htaccess-staging', 'dist/.htaccess');
} finally {
  if (moved && existsSync(excluded)) await rename(excluded, api);
  console.log(`[cPanel build] ${(performance.now() - started).toFixed(0)}ms`);
}
