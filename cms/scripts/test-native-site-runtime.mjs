import test from 'node:test';import assert from 'node:assert/strict';import {resolve} from 'node:path';
import {nativeSiteRuntimePlugin,configureNativeRoute} from './lib/native-site-runtime.mjs';
test('runtime aliases replace only the original build API/image helpers',()=>{
 const plugin=nativeSiteRuntimePlugin();const importer=resolve('src/pages/[...lang]/index.astro');
 for(const [source,end] of [['../../lib/wordpress/api','native-site-api.mjs'],['../../lib/wordpress/image','native-site-image.mjs'],['../../lib/wordpress/tour-build-data','native-site-build-data.mjs']])assert.ok(plugin.resolveId(source,importer).endsWith(end));
 assert.equal(plugin.resolveId('../lib/wordpress/types',resolve('src/components/TourCard.astro')),undefined);
});
test('original route prerender exports are overridden for relative and absolute injected components only',()=>{
 for(const component of ['src/pages/[...lang]/tours/[slug].astro',resolve('src/pages/[...lang]/tours/[slug].astro')]){const route={component,prerender:true};configureNativeRoute(route);assert.equal(route.prerender,false);}
 const admin={component:'cms/src/pages/404.astro',prerender:true};configureNativeRoute(admin);assert.equal(admin.prerender,true);
});
