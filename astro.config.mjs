// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Use SSG (static) output for Cloudflare Pages - no runtime CPU concerns!
  output: 'static',

  // i18n configuration - matches your Next.js setup
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: false, // /tours instead of /en/tours
    },
  },

  // React integration for your existing components
  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*.tsx'],
    }),
  ],

  // Tailwind via Vite plugin
  vite: {
    plugins: [tailwindcss()],
    // Environment variables
    envPrefix: ['PUBLIC_', 'WORDPRESS_'],
  },

  // Cloudflare Pages adapter for static deployment
  adapter: cloudflare({
    imageService: 'cloudflare',
  }),

  // Site configuration
  site: 'https://qualitour-fe.sslnyx.workers.dev',

  // Build configuration
  build: {
    // Inline small assets
    inlineStylesheets: 'auto',
  },
});