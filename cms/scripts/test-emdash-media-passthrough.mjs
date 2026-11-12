import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmsMediaRedirect } from '../src/lib/cms/media-passthrough.mjs';
const origin='https://qualitour-cms-free-test.qualitour.workers.dev';
test('CMS thumbnails resolve to the same-origin media file, preserving identity',()=>{
  assert.equal(cmsMediaRedirect(`${origin}/_emdash/api/media/file/01ABC.01DEF.jpg?_emdash_media=sha1:abc`,origin),'/_emdash/api/media/file/01ABC.01DEF.jpg');
  assert.equal(cmsMediaRedirect('/_emdash/api/media/file/01ABC.png',origin),'/_emdash/api/media/file/01ABC.png');
});
test('remote origins, traversal, missing keys and non-CMS sources are not redirected',()=>{
  for(const href of ['https://evil.example/_emdash/api/media/file/01ABC.jpg','/_emdash/api/media/file/../../secret','/_emdash/api/media/file/','/_emdash/api/media/file/a%2fb.jpg','/images/logo.png',null])assert.equal(cmsMediaRedirect(href,origin),null);
});
