import assert from 'node:assert/strict';
import { test } from 'node:test';
import { planMediaFilenames } from './lib/emdash-media-filenames.mjs';

const asset=(filename,sha256='a'.repeat(64))=>({source_url:`https://qualitour.ca/zh/wp-content/uploads/2024/01/${encodeURIComponent(filename)}`,locale:'zh',sha256});
test('valid Chinese, accented names and original bytes are preserved',()=>{
  const input=[asset('加拿大極光.jpg'),asset('Café.jpg','b'.repeat(64))];
  const before=JSON.stringify(input);
  assert.equal(planMediaFilenames(input,[]).size,0);
  assert.equal(JSON.stringify(input),before);
});
test('garbled originals and their converted variants use the associated tour with unique hashes',()=>{
  const original=asset('18.-▌▌½▌G.jpg');
  const converted=asset('18.-▌▌½▌G-scaled.avif','b'.repeat(64));
  const plan=planMediaFilenames([original,converted],[{asset:converted,title:'黃刀鎮 / 極光之旅',sourceKey:'wp-zh-42'}]);
  assert.equal(plan.get(original.sha256).filename,'黃刀鎮 極光之旅-圖片-aaaaaaaaaaaa.jpg');
  assert.equal(plan.get(converted.sha256).filename,'黃刀鎮 極光之旅-圖片-bbbbbbbbbbbb.avif');
  assert.equal(plan.get(original.sha256).originalFilename,'18.-▌▌½▌G.jpg');
  assert.deepEqual(planMediaFilenames([converted,original],[{asset:converted,title:'黃刀鎮 / 極光之旅',sourceKey:'wp-zh-42'}]),plan);
});
test('unknown and already corrupt titles get a readable neutral label, without guessing Chinese',()=>{
  const input=asset('bad�.jpg');
  assert.equal(planMediaFilenames([input],[{asset:input,title:'▌▌½▌G',sourceKey:'wp-zh-1'}]).get(input.sha256).filename,'Qualitour-圖片-aaaaaaaaaaaa.jpg');
});
