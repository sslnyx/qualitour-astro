import {defineConfig,passthroughImageService} from 'astro/config';
import react from '@astrojs/react';
import cloudflare from '@astrojs/cloudflare';
import tailwindcss from '@tailwindcss/vite';
import emdash from 'emdash/astro';
import {d1,r2} from '@emdash-cms/cloudflare';
import {tourEditorPlugin} from './cms/src/plugins/tour-editor/index.ts';
import {pagesRebuildPlugin} from './cms/src/plugins/pages-rebuild/index.ts';
import {tourAdminPlugin} from './cms/scripts/lib/tour-admin-routes.mjs';
import {emdashFreeCpuPlugin} from './cms/scripts/lib/emdash-free-cpu.mjs';

const origin=process.env.QUALITOUR_WORKER_ORIGIN||'https://qualitour.qualitour.workers.dev';
export default defineConfig({
 srcDir:'./cms/src',publicDir:'./public',output:'server',site:origin,base:'/',trailingSlash:'never',outDir:process.env.WORKER_CMS_OUT_DIR||'./.astro/worker-release/cms',
 i18n:{defaultLocale:'en',locales:['en','zh'],routing:{prefixDefaultLocale:false}},
 adapter:cloudflare({configPath:'./wrangler.qualitour.jsonc',imageService:'custom'}),
 image:{service:passthroughImageService(),endpoint:{entrypoint:'./cms/src/server/emdash-free-image.ts'},remotePatterns:[{protocol:'https',hostname:'qualitour.ca'},{protocol:'https',hostname:'**.qualitour.ca'},{protocol:'https',hostname:'**.googleusercontent.com'},{protocol:'https',hostname:'**.isquarestudio.com'},{protocol:'https',hostname:'qualitour-cms-free-test.qualitour.workers.dev'},{protocol:'https',hostname:'qualitour.qualitour.workers.dev'}]},
 integrations:[react(),{name:'qualitour-cms-runtime-routes',hooks:{'astro:config:setup':({injectRoute})=>{
  injectRoute({pattern:'/[...lang]/cms-proof/tours/[id]',entrypoint:new URL('./cms/src/server/emdash-tour.astro',import.meta.url),prerender:false});
  injectRoute({pattern:'/[...lang]/cms-proof/tours',entrypoint:new URL('./cms/src/server/emdash-catalog.astro',import.meta.url),prerender:false});
 }}},emdash({database:d1({binding:'DB'}),storage:r2({binding:'MEDIA'}),maxUploadSize:96*1024*1024,plugins:[tourEditorPlugin(),pagesRebuildPlugin()],admin:{hiddenNavItems:['calendar','comments','menus','redirects','widgets','sections','bylines','import']}})],
 vite:{plugins:[tailwindcss(),tourAdminPlugin(),emdashFreeCpuPlugin()],envPrefix:['PUBLIC_'],optimizeDeps:{exclude:['@emdash-cms/admin']},define:{'import.meta.env.PUBLIC_SITE_INDEXABLE':JSON.stringify('false')}},devToolbar:{enabled:false}
});
