// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Astro config for cPanel/Apache static hosting deployment.
 * Used by: npm run build:cpanel
 *
 * Key differences from default (Cloudflare) config:
 * - No Cloudflare adapter (pure static output)
 * - build.format: 'file' for clean URLs on Apache
 * - base: '/staging' for subfolder deployment
 * - site: 'https://qualitour.ca'
 */
export default defineConfig({
  // Image optimization for remote images
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.isquarestudio.com',
      },
      {
        protocol: 'https',
        hostname: '**.qualitour.ca',
      },
    ],
  },

  // Pure static output (no server adapter needed)
  output: 'static',

  // Base path for staging subfolder
  base: '/staging',

  // i18n configuration
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      prefixDefaultLocale: false,
    },
  },

  // React integration
  integrations: [
    react({
      include: ['**/react/*', '**/components/**/*.tsx'],
    }),
  ],

  // Tailwind via Vite plugin
  vite: {
    plugins: [tailwindcss()],
    envPrefix: ['PUBLIC_', 'WORDPRESS_'],
  },

  // Site URL
  site: 'https://qualitour.ca',

  // Build configuration for Apache
  build: {
    // Output /about.html instead of /about/index.html
    // Avoids Apache directory redirects that strip hash fragments
    format: 'file',
    inlineStylesheets: 'auto',
  },
});
