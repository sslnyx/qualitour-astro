import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageDelivery } from '../src/lib/image-delivery.mjs';

test('an unchanged CDN URL is resized by the build service, not treated as optimized', async () => {
  const calls=[];const d=createImageDelivery({transform:s=>s,infer:async()=>({width:1448,height:1086}),optimize:async o=>{calls.push(o);return {src:'/_astro/cover.webp'};}});
  assert.equal((await d.image({src:'https://cms.example/cover.png',width:600,height:450})).src,'/_astro/cover.webp');
  assert.equal(calls.length,1);
});
test('a real CDN transformation is retained without an unnecessary source download', async () => {
  const d=createImageDelivery({transform:(s,o)=>`https://cdn.example/w=${o.width}/${s}`,infer:async()=>{throw Error('unexpected source read')},optimize:async()=>{throw Error('unexpected build conversion')}});
  const r=await d.image({src:'image.png',width:600,height:450,widths:[300,600]});
  assert.match(r.src,/w=600/);assert.match(r.srcSet.attribute,/w=300.*300w/);
});
test('responsive poster variants preserve ratio, cap at original pixels and share identical work', async () => {
  const calls=[];let inferred=0;const d=createImageDelivery({transform:s=>s,infer:async()=>{inferred++;return {width:1448,height:1086}},optimize:async o=>{calls.push(o);return {src:'/_astro/cover.webp',attributes:{width:o.width,height:o.height},srcSet:{attribute:o.widths.map(w=>`/_astro/${w}.webp ${w}w`).join(', ')}}}});
  const [a,b]=await Promise.all([d.responsive('poster.png'),d.responsive('poster.png')]);
  assert.equal(inferred,1);assert.equal(calls.length,1);assert.deepEqual(a,b);
  assert.deepEqual(calls[0].widths,[480,960,1280,1448]);assert.equal(calls[0].width,1280);assert.equal(calls[0].height,960);
  assert.equal(a.sizes,'100vw');assert.equal(a.width,1280);assert.equal(a.height,960);assert.match(a.srcSet,/1448w/);
});
test('width-only inferred images keep the actual aspect ratio and input options immutable', async () => {
  const options={src:'poster.png',width:600,inferSize:true};let actual;
  const d=createImageDelivery({transform:s=>s,infer:async()=>({width:1448,height:1086}),optimize:async o=>{actual=o;return {src:'/_astro/600.webp'}}});
  await d.image(options);assert.equal(actual.height,450);assert.deepEqual(options,{src:'poster.png',width:600,inferSize:true});
});
test('failed conversion rejects instead of quietly returning the original megabyte image; retries remain possible', async()=>{
 let n=0;const d=createImageDelivery({transform:s=>s,infer:async()=>({width:800,height:600}),optimize:async()=>{if(!n++)throw Error('conversion failed');return{src:'/_astro/retry.webp'}}});
 await assert.rejects(d.responsive('bad.png'),/conversion failed/);assert.equal((await d.responsive('bad.png')).src,'/_astro/retry.webp');
});
test('already-generated Astro files are served directly rather than transformed a second time', async()=>{
 const d=createImageDelivery({transform:s=>s,infer:async()=>{throw Error('unexpected read')},optimize:async()=>({src:'wrong-second-transform.webp'})});
 const source='/staging/_astro/generated.webp';assert.equal((await d.image({src:source,width:600,height:450})).src,source);
});
test('gallery sources include cover, section images and both legacy galleries without duplicates or PDF downloads', async()=>{
 const {collectTourPhotoSources}=await import('../src/lib/image-delivery.mjs');
 const tour={featured_image_url:{full:{url:'https://cms/cover.png'}},goodlayers_data:{sections:[{items:[{type:'gallery',value:{gallery:[{thumbnail:'https://cms/photo.jpg'},'https://cms/cover.png']}},{type:'image',value:{url:'https://cms/map.png'}}]}],tour_gallery:['https://cms/photo.jpg',{url:'https://cms/end.jpg'}],'tourmaster-tour-gallery':['not-a-media-url']},tour_meta:{brochure:{url:'https://cms/file.pdf'}}};
 assert.deepEqual(collectTourPhotoSources(tour),['https://cms/cover.png','https://cms/photo.jpg','https://cms/map.png','https://cms/end.jpg']);
});
test('image preparation overlaps bounded work and keeps catalogue order stable', async()=>{
 const {mapWithConcurrency}=await import('../src/lib/image-delivery.mjs');let active=0,max=0;const input=[1,2,3,4,5];
 const result=await mapWithConcurrency(input,async n=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,6-n));active--;return n*2},3);
 assert.equal(max,3);assert.deepEqual(result,[2,4,6,8,10]);assert.deepEqual(input,[1,2,3,4,5]);
});
test('gallery lightbox source uses the full URL when a separate thumbnail is available',async()=>{
 const {collectTourPhotoSources}=await import('../src/lib/image-delivery.mjs');assert.deepEqual(collectTourPhotoSources({goodlayers_data:{tour_gallery:[{thumbnail:'https://cms/thumb-150.jpg',url:'https://cms/full.jpg'}]}}),['https://cms/full.jpg']);
});
test('responsive failure clears source candidates and applies a fallback only once',async()=>{
 const {applyImageFallback}=await import('../src/lib/image-delivery.mjs');const attributes=new Map([['srcset','broken.webp 960w'],['sizes','100vw']]);const img={dataset:{},src:'broken.webp',removeAttribute:key=>attributes.delete(key)};
 applyImageFallback(img,'fallback.jpg');assert.equal(img.src,'fallback.jpg');assert.equal(attributes.has('srcset'),false);assert.equal(attributes.has('sizes'),false);applyImageFallback(img,'second.jpg');assert.equal(img.src,'fallback.jpg');
});
