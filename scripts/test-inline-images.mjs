import test from 'node:test';
import assert from 'node:assert/strict';
import {collectInlineImageSources,renderInlineImages} from '../src/lib/inline-images.mjs';
test('collects nested section images and HTML image sources without treating downloads as images',()=>{
 const tour={content:{rendered:'<a href="https://wp/file.png">Download</a><img src="https://wp/one.png">'},goodlayers_data:{sections:[{items:[{type:'column',items:[{type:'image',value:{url:'https://wp/two.png'}}]},{type:'text-box',value:{content:"<img alt='Map' src='https://wp/one.png'>"}}]}]},tour_meta:{brochure:{url:'https://wp/brochure.pdf'}}};
 assert.deepEqual(collectInlineImageSources(tour),['https://wp/one.png','https://wp/two.png']);
});
test('replaces only display image attributes, retains links and adds responsive dimensions',()=>{
 const original='<a href="https://wp/full.png">Download</a><img alt="Map" src="https://wp/full.png" srcset="https://wp/huge.png 2000w" width="4000" height="3000">';
 const out=renderInlineImages(original,{'https://wp/full.png':{src:'/_astro/map.webp',srcSet:'/_astro/map480.webp 480w, /_astro/map.webp 1200w',sizes:'100vw',width:1200,height:900}});
 assert.match(out,/<a href="https:\/\/wp\/full.png">/);assert.match(out,/src="\/_astro\/map.webp"/);assert.match(out,/width="1200" height="900"/);assert.match(out,/srcset="\/_astro\/map480.webp 480w/);assert.match(out,/loading="lazy"/);assert.doesNotMatch(out,/huge.png/);assert.match(out,/alt="Map"/);assert.match(original,/4000/);
});
test('normalizes lookup URLs and preserves unrelated markup and missing derivatives',()=>{
 const html='<p>Hello</p><img src="http://old/a.png"><img src="https://other/a.png">';
 const out=renderInlineImages(html,{'https://new/a.png':{src:'/_astro/a.webp',width:100,height:50}},s=>s.replace('http://old/','https://new/'));
 assert.match(out,/src="\/_astro\/a.webp"/);assert.match(out,/<img src="https:\/\/other\/a.png">/);assert.match(out,/<p>Hello<\/p>/);
});
test('quoted captions containing attribute-like text and angle brackets survive rewriting',()=>{
 const html='<img alt="Map > example src=caption width=20" data-note="src=caption" src="https://wp/map.png">';
 const out=renderInlineImages(html,{'https://wp/map.png':{src:'/_astro/map.webp',width:600,height:400}});
 assert.match(out,/alt="Map > example src=caption width=20"/);assert.match(out,/data-note="src=caption"/);assert.match(out,/src="\/_astro\/map.webp"/);
});
