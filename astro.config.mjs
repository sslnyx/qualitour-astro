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
    // Build optimization
    build: {
      // Minify CSS
      cssMinify: 'lightningcss',
      // Custom asset naming
      rollupOptions: {
        output: {
          // Rename CSS from 'about-us' to 'styles'
          assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith('.css')) {
              return '_astro/styles.[hash].css';
            }
            return '_astro/[name].[hash][extname]';
          },
        },
      },
    },
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