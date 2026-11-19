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
test('transient source dimension failure retries within a bound and never substitutes raw media',async()=>{
 const {inferImageDimensions}=await import('../src/lib/image-delivery.mjs');let calls=0;const waits=[];
 const r=await inferImageDimensions(async()=>{if(++calls===1)throw Error('temporary origin failure');return {width:800,height:600};},{wait:async ms=>waits.push(ms)});
 assert.deepEqual(r,{width:800,height:600});assert.equal(calls,2);assert.equal(waits.length,1);
 let failures=0;await assert.rejects(inferImageDimensions(async()=>{failures++;throw Error('unavailable');},{wait:async()=>{}}),/unavailable/);assert.equal(failures,3);
});
test('official runtime image derivatives are never nested inside a second transform', async()=>{
 const d=createImageDelivery({transform:s=>s,infer:async()=>{throw Error('unexpected read')},optimize:async()=>({src:'wrong-second-transform.webp'})});
 const source='/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fcover.png&w=960&f=webp&q=80';
 assert.equal((await d.image({src:source,width:600,height:450})).src,source);
});

test('the same picture stored under different URLs shows once, keeping the first and ignoring flat or unmatched images', async()=>{
 const {dedupePhotoSources,collectTourPhotoSources,hashDistance}=await import('../src/lib/image-delivery.mjs');
 assert.equal(hashDistance('ffffffffffffffff','fffffffffffffffe'),1);
 const prints={
  '/img/cover.webp':{hash:'f0f0f0f0aaaa5555',width:1169,height:768},
  '/img/figure.webp':{hash:'f0f0f0f0aaaa5555',width:1169,height:862},   // same hash, other proportions: a different picture
  '/img/copy.webp':{hash:'f0f0f0f0aaaa5554',width:1169,height:768},      // one bit off, same proportions: a copy
  '/img/far.webp':{hash:'f0f0f0f0aaaa503f',width:1169,height:768},       // 6+ bits away: a different picture
  '/img/flat-a.webp':{hash:'0000000000000000',width:800,height:600},
  '/img/flat-b.webp':{hash:'0000000000000000',width:800,height:600},     // flat images hash alike but are not copies
 };
 const sources=['/img/cover.webp','/img/figure.webp','/img/copy.webp','/img/far.webp','/img/flat-a.webp','/img/flat-b.webp','/img/unknown.webp'];
 assert.deepEqual(dedupePhotoSources(sources,prints),['/img/cover.webp','/img/figure.webp','/img/far.webp','/img/flat-a.webp','/img/flat-b.webp','/img/unknown.webp']);
 assert.deepEqual(dedupePhotoSources(sources,{}),sources);
 assert.deepEqual(dedupePhotoSources(['https://cms/img/copy.webp','https://cms/img/cover.webp'],prints,{key:u=>u.replace('https://cms','')}),['https://cms/img/copy.webp']);
 assert.deepEqual(collectTourPhotoSources({photoSources:['/img/cover.webp'],featured_image_url:'/img/other.webp'}),['/img/cover.webp']);
});

test('copies keep the first position but show the largest file; flat pictures match only by colour thumbnail', async()=>{
 const {analyzePhotoSources,dedupePhotoSources}=await import('../src/lib/image-delivery.mjs');
 const prints={
  '/a/small.jpg':{hash:'f0f0f0f0aaaa5555',width:600,height:400},
  '/a/other.jpg':{hash:'0ff00ff0cc33aa55',width:900,height:600},
  '/a/large.jpg':{hash:'f0f0f0f0aaaa5555',width:1800,height:1200},   // copy of small, larger: replaces it in place
  '/a/dark1.jpg':{hash:'0800402101008000',width:1200,height:633,thumb:Buffer.alloc(192,20).toString('base64')},
  '/a/dark2.jpg':{hash:'0800402101008000',width:1200,height:633,thumb:Buffer.alloc(192,22).toString('base64')},   // same dark picture
  '/a/dark3.jpg':{hash:'0800402101008000',width:1200,height:633,thumb:Buffer.alloc(192,200).toString('base64')},  // a different, bright flat picture
  '/a/dark4.jpg':{hash:'0800402101008000',width:1200,height:633},                                                  // no thumbnail: never merged
 };
 const result=analyzePhotoSources(['/a/small.jpg','/a/other.jpg','/a/large.jpg','/a/dark1.jpg','/a/dark2.jpg','/a/dark3.jpg','/a/dark4.jpg'],prints);
 assert.deepEqual(result.kept,['/a/large.jpg','/a/other.jpg','/a/dark1.jpg','/a/dark3.jpg','/a/dark4.jpg']);
 assert.deepEqual(result.groups,[{keep:'/a/large.jpg',copies:['/a/small.jpg']},{keep:'/a/dark1.jpg',copies:['/a/dark2.jpg']}]);
 assert.deepEqual(dedupePhotoSources(['/a/small.jpg','/a/large.jpg'],prints),['/a/large.jpg']);
});

test('among copies of similar size the site-hosted file is preferred over an old WordPress link', async()=>{
 const {analyzePhotoSources}=await import('../src/lib/image-delivery.mjs');
 const prints={'wp.jpg':{hash:'f0f0f0f0aaaa5555',width:1000,height:667},'cms.avif':{hash:'f0f0f0f0aaaa5555',width:1000,height:667},'cms-small.avif':{hash:'f0f0f0f0aaaa5555',width:500,height:333}};
 const own=s=>s.startsWith('cms');
 assert.deepEqual(analyzePhotoSources(['wp.jpg','cms.avif','cms-small.avif'],prints,{prefer:own}),{kept:['cms.avif'],groups:[{keep:'cms.avif',copies:['wp.jpg','cms-small.avif']}]});
 assert.deepEqual(analyzePhotoSources(['wp.jpg','cms.avif'],prints).kept,['wp.jpg']);
});

test('a tiny WordPress crop of a larger photo counts as its thumbnail copy, a tiny unrelated image does not', async()=>{
 const {analyzePhotoSources}=await import('../src/lib/image-delivery.mjs');
 const prints={
  'big.jpg':{hash:'f0f0f0f0aaaa5555',width:864,height:432},
  'crop150.jpg':{hash:'f0f0f0f0aaaa5e55',width:150,height:150},      // 3 bits away: centre crop of big.jpg
  'icon150.jpg':{hash:'0ff00ff0cc33aa55',width:150,height:150},       // unrelated tiny image: kept
  'near300.jpg':{hash:'f0f0f0f0aaaa5e55',width:300,height:300},       // not a thumbnail by size: kept
 };
 assert.deepEqual(analyzePhotoSources(['big.jpg','crop150.jpg','icon150.jpg','near300.jpg'],prints).kept,['big.jpg','icon150.jpg','near300.jpg']);
 assert.deepEqual(analyzePhotoSources(['crop150.jpg','big.jpg'],prints).kept,['big.jpg']);
});
