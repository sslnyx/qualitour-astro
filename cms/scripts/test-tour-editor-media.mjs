import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAsset } from '../src/plugins/tour-editor/media-preview.ts';
test('raw native media responses without url still produce a usable file URL',()=>{
  const cached={id:'image-1',filename:'圖片.avif',meta:{storageKey:'file-1.avif'}};
  assert.equal(resolveAsset(cached,{id:'image-1',filename:'圖片.avif',storageKey:'file-1.avif'},'http://127.0.0.1:4327').url,'http://127.0.0.1:4327/_emdash/api/media/file/file-1.avif');
  assert.equal(resolveAsset(cached,{},'http://127.0.0.1:4327').filename,'圖片.avif');
});
test('asset references never turn into unsafe links or paths',()=>{
  for(const url of ['javascript:alert(1)','data:text/html,hello','file:///secret'])assert.equal(resolveAsset({url},{},'https://example.test').url,'');
  assert.equal(resolveAsset({meta:{storageKey:'../secret'}},{},'https://example.test').url,'');
});
