import test from 'node:test';
import assert from 'node:assert/strict';
import { preserveRichText } from '../src/plugins/tour-editor/rich-text.ts';
test('native editor normalization retains extra metadata on untouched blocks and spans',()=>{
  const original=[{_type:'block',_key:'a',style:'normal',children:[{_type:'span',_key:'s1',text:'First',marks:[]}]},{_type:'block',_key:'b',style:'normal',supplier:{source:'legacy'},textAlign:'center',children:[{_type:'span',_key:'s2',text:'Untouched',marks:['strong'],externalId:'keep'}]}];
  const normalized=[{...original[0],children:[{_type:'span',_key:'s1',text:'Edited first',marks:[]}]},{_type:'block',_key:'b',style:'normal',children:[{_type:'span',_key:'s2',text:'Untouched',marks:['strong']}]}];
  const merged=preserveRichText(original,normalized);
  assert.deepEqual(merged[1].supplier,{source:'legacy'});assert.equal(merged[1].children[0].externalId,'keep');
  assert.equal(merged[1].textAlign,undefined,'A deliberately cleared known formatting field must stay cleared');
  assert.equal(merged[0].children[0].text,'Edited first');assert.equal(original[0].children[0].text,'First');
});
test('intentional deletion and removed marks are not resurrected by metadata preservation',()=>{
  const original=[{_type:'block',_key:'a',style:'normal',custom:true,markDefs:[{_type:'link',_key:'link',href:'https://example.test',tracking:'keep'}],children:[{_type:'span',_key:'s',text:'Link',marks:['link'],custom:true}]},{_type:'block',_key:'removed',children:[]}];
  const result=preserveRichText(original,[{_type:'block',_key:'a',style:'normal',children:[{_type:'span',_key:'s',text:'Link'}]}]);
  assert.equal(result.length,1);assert.equal(result[0].children[0].marks,undefined);assert.equal(result[0].markDefs,undefined);assert.equal(result[0].custom,true);assert.equal(result[0].children[0].custom,true);
});
