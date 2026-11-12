import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTourSave, appendDay, duplicateDay, deleteDay, moveDay } from '../src/plugins/tour-editor/tour-editor-fields.ts';
import { updateDay } from '../src/plugins/tour-editor/tour-editor-model.ts';
const day = key => ({ _key: key, _type: 'day', _version: 1, title: key, content: [], custom: { preserve: true } });
const base = () => ({ title: 'Original', price: 'From $499', source_key: 'source', custom: { untouched: true }, itinerary: [day('a'), day('b')], itinerary_continued: [day('a')], gallery: [{ image: { id: 'photo', provider: 'local' }, caption: 'original', alt: 'alt', custom: true }] });
test('saving another section sends only changed fields without changing source or metadata', () => {
  const a=base(), b={...a,price:'Contact us',gallery:[{...a.gallery[0],caption:'Updated'}]};
  assert.deepEqual(buildTourSave(a,b),{data:{price:'Contact us',gallery:b.gallery}});
  assert.throws(()=>buildTourSave(a,{...a,source_key:'tamper'}));
  assert.throws(()=>buildTourSave(a,{...a,custom:{untouched:false}}));
});
test('duplicate, move and delete affect only the specified field and preserve block attributes', () => {
  const a=base(); const b=duplicateDay(a,{field:'itinerary',key:'a'},'copy');
  assert.deepEqual(b.itinerary.map(x=>x._key),['a','copy','b']);assert.deepEqual(b.itinerary[1].custom,{preserve:true});
  assert.deepEqual(b.itinerary_continued,a.itinerary_continued);assert.deepEqual(a.itinerary.map(x=>x._key),['a','b']);
  const c=moveDay(b,{field:'itinerary',key:'copy'},1);assert.deepEqual(c.itinerary.map(x=>x._key),['a','b','copy']);
  assert.deepEqual(deleteDay(c,{field:'itinerary_continued',key:'a'}).itinerary_continued,[]);
  assert.throws(()=>moveDay(a,{field:'itinerary_continued',key:'a'},-1));
});
test('append uses continuation at the 100-day boundary without truncation', () => {
  const a={...base(),itinerary:Array.from({length:100},(_,i)=>day(`d${i}`)),itinerary_continued:[]};
  const b=appendDay(a,'new');assert.equal(b.itinerary.length,100);assert.equal(b.itinerary_continued.length,1);assert.equal(b.itinerary_continued[0]._key,'new');
  assert.throws(()=>appendDay({...a,itinerary_continued:Array.from({length:100},(_,i)=>day(`c${i}`))},'too-many'));
  assert.throws(()=>duplicateDay(a,{field:'itinerary',key:'d0'},'copy'));
});
test('day operations reject key collisions and missing refs instead of modifying the wrong day',()=>{
  const a=base();assert.throws(()=>duplicateDay(a,{field:'itinerary',key:'a'},'b'));
  assert.throws(()=>deleteDay(a,{field:'itinerary',key:'missing'}));
});
test('unknown JSON object keys survive editing without changing object prototypes',()=>{
  const a=JSON.parse('{"title":"x","itinerary":[{"_type":"day","_key":"a","title":"a","content":[],"__proto__":{"keep":"safe"}}],"__proto__":{"root":"keep"}}');
  const b=updateDay(a,{field:'itinerary',key:'a'},{title:'new'});
  assert.equal(Object.hasOwn(b,'__proto__'),true);assert.equal(Object.hasOwn(b.itinerary[0],'__proto__'),true);
  assert.equal(Object.getPrototypeOf(b),Object.prototype);assert.equal(b.itinerary[0].keep,undefined);
});
