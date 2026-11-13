import assert from 'node:assert/strict';
import test from 'node:test';
import { deepOptimizeTourData, getImageSafe, imageTransformUrl, getTourImageUrl, optimizeResponsiveImage, optimizeTourHero, optimizeTourImages, optimizeTourPresentation } from '../src/lib/cms/native-site-image.mjs';

const owned='https://qualitour.qualitour.workers.dev/_emdash/api/media/file/hero.jpg';
const inline='https://qualitour-cms-free-test.qualitour.workers.dev/_emdash/api/media/file/inline.jpg';
const supplier='https://supplier.example/large-map.jpg';

test('same-Worker media receives official WebP derivatives without a remote size read',async()=>{
  const image=await getImageSafe({src:owned,width:600,height:450,widths:[300,600],quality:80});
  assert.match(image.src,/^\/_image\?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fhero\.jpg&w=600&f=webp&q=80$/);
  assert.match(image.srcSet.attribute,/w=300.* 300w, .*w=600.* 600w/);
  assert.deepEqual(image.attributes,{width:600,height:450});
  const responsive=await optimizeResponsiveImage(owned);
  assert.equal(responsive.width,1920);assert.equal(responsive.height,1080);assert.match(responsive.srcSet,/480w/);
});

test('presentation decoration preserves complete HTML and supplier images',async()=>{
  const tour={id:'native',slug:'native',featured_image_url:owned,content:{rendered:`<p><img src="${inline}"><img src="${supplier}"></p>`},excerpt:{rendered:''},title:{rendered:'Native'},featured_media:0,goodlayers_data:{tour_gallery:[{url:owned}]}};
  const before=structuredClone(tour);
  const result=await optimizeTourPresentation(tour);
  assert.deepEqual(tour,before);
  assert.equal(result.content.rendered,before.content.rendered);
  assert.match(result.optimizedHero.src,/^\/_image\?/);
  assert.match(result.optimizedPhotos[owned].thumbnail,/w=600/);
  assert.match(result.optimizedInlineImages[inline].src,/w=1200/);
  assert.equal(result.optimizedInlineImages[supplier],undefined);
  assert.equal(getTourImageUrl(result),owned);
  assert.equal((await deepOptimizeTourData(tour)).content.rendered,before.content.rendered);
});

test('existing supplier sources remain visible and list decoration is immutable',async()=>{
  assert.equal((await getImageSafe({src:supplier,width:600})).src,supplier);
  const tours=[{id:1,slug:'supplier',featured_image_url:supplier,title:{rendered:'Supplier'},excerpt:{rendered:''},featured_media:0}];
  const result=await optimizeTourImages(tours);
  assert.equal(result[0].optimizedImageUrl,supplier);
  assert.equal(tours[0].optimizedImageUrl,undefined);
});

test('legacy Qualitour uploads are transformed while malformed R2 paths fail closed',async()=>{
  const legacy='https://qualitour.ca/wp-content/uploads/2024/01/rockies.jpg';
  assert.match((await getImageSafe({src:legacy,width:600})).src,/^\/_image\?href=https%3A%2F%2Fqualitour\.ca%2Fwp-content%2Fuploads%2F2024%2F01%2Frockies\.jpg&w=600/);
  await assert.rejects(getImageSafe({src:'https://qualitour.qualitour.workers.dev/_emdash/api/media/file/../private.jpg',width:600}),/unsafe CMS media/);
});

test('catalogue presentation adds only the hero, in place, and detail presentation still gets photo sizes',async()=>{
  const key=Symbol.for('qualitour:native-media-dimensions');
  const tour={id:'native',slug:'native',featured_image_url:owned,content:{rendered:`<p><img src="${inline}"></p>`},excerpt:{rendered:''},title:{rendered:'Native'},featured_media:0,goodlayers_data:{tour_gallery:[{url:owned}]}};
  Object.defineProperty(tour,key,{value:{[owned]:{width:1200,height:800},[inline]:{width:700,height:500}},enumerable:false});
  const result=await optimizeTourHero(tour);
  assert.equal(result,tour,'decorated in place');
  assert.match(result.optimizedHero.src,/^\/_image\?/);
  assert.equal(result.optimizedHero.width,1200);
  assert.equal('optimizedPhotos' in result,false);assert.equal('optimizedInlineImages' in result,false);
  const detail=await optimizeTourPresentation(result);
  assert.equal(detail.optimizedPhotos[owned].width,1200,'media-size hints survive for the detail page');
  assert.equal(detail.optimizedHero,result.optimizedHero);
});

test('images from both WordPress installs (English and /zh) are transformed, other paths and hosts are not',()=>{
 for(const url of ['https://qualitour.ca/wp-content/uploads/2024/04/a.jpg','https://qualitour.ca/zh/wp-content/uploads/2021/02/whistler-6.jpg','https://www.qualitour.ca/zh/wp-content/uploads/x.avif'])
  assert.match(imageTransformUrl(url,600),/^\/_image\?href=https%3A%2F%2F.*qualitour\.ca.*wp-content%2Fuploads.*&w=600&f=webp&q=80$/,url);
 for(const url of ['https://qualitour.ca/zh/wp-content/plugins/x.jpg','https://qualitour.ca/fr/wp-content/uploads/x.jpg','https://evil.example/zh/wp-content/uploads/x.jpg'])
  assert.equal(imageTransformUrl(url,600),undefined,url);
});
