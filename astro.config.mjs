// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Image optimization for remote images
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com', // For Google profile images
      },
      {
        // Local WordPress development
        protocol: 'http',
        hostname: 'qualitour.local',
      },
      {
        // Production WordPress (isquarestudio staging/subdomain)
        protocol: 'https',
        hostname: '**.isquarestudio.com',
      },
      {
        // Real Production WordPress
        protocol: 'https',
        hostname: '**.qualitour.ca',
      },
    ],
  },

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
  // Using 'passthrough' to COMPLETELY DISABLE build-time image optimization.
  // This ensures lightning fast builds and lets Cloudflare Transformations handle resizing at the edge.
  adapter: cloudflare({
    imageService: 'passthrough',
  }),

  // Site configuration
  site: 'https://qualitour.isquarestudio.com',

  // Build configuration
  build: {
    // Inline small assets
    inlineStylesheets: 'auto',
  },
});