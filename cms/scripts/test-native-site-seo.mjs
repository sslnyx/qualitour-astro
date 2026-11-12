import test from 'node:test';import assert from 'node:assert/strict';import {applyNativeTourSeo} from '../src/lib/cms/native-site-seo.mjs';
test('empty CMS SEO preserves original generated metadata and cannot enable indexing',()=>{
 const metadata={title:'Legacy title',description:'Legacy description',image:'https://example.test/cover.webp'};
 const result=applyNativeTourSeo(metadata,{});assert.deepEqual(result.metadata,metadata);assert.equal(result.canonical,undefined);assert.equal(result.noindex,undefined);
});
test('explicit published SEO overrides are plain text with safe URL fields only',()=>{
 const result=applyNativeTourSeo({title:'Legacy',description:'Original'},{title:'New <b>title</b>',description:'Published description',image:'https://example.test/image.webp',canonical:'https://example.test/tours/selected',noIndex:true});
 assert.equal(result.metadata.title,'New title');assert.equal(result.metadata.description,'Published description');assert.equal(result.canonical,'https://example.test/tours/selected');assert.equal(result.noindex,true);
 const unsafe=applyNativeTourSeo({title:'Legacy'},{image:'javascript:alert(1)',canonical:'javascript:alert(1)'});assert.equal(unsafe.metadata.image,undefined);assert.equal(unsafe.canonical,undefined);
});
