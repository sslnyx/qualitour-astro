// The original frontend with its CMS build snapshot, hosted at the Pages preview root.
// Keep the legacy SSR/WordPress target separate, and preserve the cPanel dist for recovery.
import { mergeConfig } from 'astro/config';
import staticConfig from './astro.config.mjs';

export default mergeConfig(staticConfig, {
  site: 'https://staging.qualitour-astro.pages.dev',
  base: '/',
  outDir: process.env.PAGES_STATIC_OUT_DIR || './.astro/cloudflare-release/dist',
  vite: {
    define: { 'import.meta.env.PUBLIC_SITE_INDEXABLE': JSON.stringify('false') },
  },
});
