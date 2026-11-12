// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { deploymentConfig } from './src/lib/site-config.ts';
import { cmsEnabled, syncCmsSnapshot } from './src/lib/cms/content-server.mjs';

const site = deploymentConfig(process.env.DEPLOY_TARGET || 'staging');
process.env.PUBLIC_WORDPRESS_CUSTOM_API_URL ||= site.wordpressApi;

export default defineConfig({
  output: 'static',
  site: site.origin,
  base: site.base,
  trailingSlash: 'never',
  i18n: { defaultLocale: 'en', locales: ['en', 'zh'], routing: { prefixDefaultLocale: false } },
  integrations: [react(), {
    name: 'qualitour-cms-build-snapshot',
    hooks: { 'astro:build:start': async () => { if (cmsEnabled()) await syncCmsSnapshot(); } },
  }],
  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qualitour.ca' },
      { protocol: 'https', hostname: '**.qualitour.ca' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
      { protocol: 'https', hostname: '**.isquarestudio.com' },
      { protocol: 'https', hostname: 'qualitour-cms-free-test.qualitour.workers.dev' },
    ],
  },
  vite: {
    plugins: [tailwindcss()],
    envPrefix: ['PUBLIC_'],
    define: { 'import.meta.env.PUBLIC_SITE_INDEXABLE': JSON.stringify(String(site.indexable)) },
  },
  build: { format: 'file', inlineStylesheets: 'auto' },
});
