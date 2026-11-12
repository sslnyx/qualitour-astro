import assert from 'node:assert/strict';
import test from 'node:test';
import { describeConflictValue } from '../src/plugins/tour-editor/conflict-summary.ts';
test('gallery comparison reveals different selected images even when captions and alt are identical',()=>{
 const local=[{image:{id:'local-image',filename:'mountain.jpg'},caption:'Scenery',alt:'View'}],server=[{image:{id:'server-image',filename:'harbour.jpg'},caption:'Scenery',alt:'View'}];
 const a=describeConflictValue(local),b=describeConflictValue(server);assert.match(a,/mountain.jpg/);assert.match(b,/harbour.jpg/);assert.notEqual(a,b);assert.match(a,/Scenery/);
});
test('all days remain available to compare beyond a long array instead of truncating the final difference',()=>{
 const days=Array.from({length:101},(_,i)=>({title:`Day ${i+1}`,content:[{children:[{text:i===100?'Final day difference':'A'.repeat(100)}]}]}));assert.match(describeConflictValue(days),/Final day difference/);
});
