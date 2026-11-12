import assert from 'node:assert/strict';
import test from 'node:test';
import { tourListPath, safeTourReturnPath, tourWorkspaceHref } from '../src/plugins/tour-editor/tour-navigation.ts';

test('returning to the native list keeps language, search, status and page query intact',()=>{
 const path='/_emdash/admin/content/tours?locale=zh&search=day+8&status=draft&page=2';
 assert.equal(safeTourReturnPath(path,'en'),path);
 assert.equal(tourListPath('zh'),'/_emdash/admin/content/tours?locale=zh');
 assert.equal(tourListPath('fr'),'/_emdash/admin/content/tours');
});
test('unsafe or unrelated return targets fall back to the entry language list',()=>{
 for(const input of ['https://evil.example/','//evil.example/','/\\evil.example/path','/_emdash/admin/content/tours-archive','/_emdash/admin/content/tours/record','/_emdash/admin/content/tours#fragment','javascript:alert(1)',null]){
  assert.equal(safeTourReturnPath(input,'zh'),'/_emdash/admin/content/tours?locale=zh',String(input));
 }
});
test('each row links its own identity and locale even when the native list shows all languages',()=>{
 const path='/_emdash/admin/content/tours?search=mountains&status=published';
 const url=new URL(tourWorkspaceHref({id:'zh/id&one',locale:'zh'},path),'https://example.test');
 assert.equal(url.pathname,'/_emdash/admin/content/tours/zh%2Fid%26one');
 assert.equal(url.searchParams.get('locale'),'zh');assert.equal(url.searchParams.get('returnTo'),path);
});
test('editor links never propagate external return destinations',()=>{
 const url=new URL(tourWorkspaceHref({id:'entry',locale:'en'},'https://evil.example/'),'https://example.test');
 assert.equal(url.searchParams.get('returnTo'),'/_emdash/admin/content/tours?locale=en');
});
