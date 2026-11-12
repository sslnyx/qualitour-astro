import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalDraftStore } from '../src/plugins/tour-editor/local-draft.ts';
import { reconcileDraft, applyResolution } from '../src/plugins/tour-editor/draft-reconcile.ts';
const memory=()=>{const map=new Map();return {get length(){return map.size;},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const base={title:'Old',price:'100',itinerary:[{_type:'day',_key:'one',title:'Day1',content:[]}],source_key:'untouched'};
const snapshot={entryId:'a',locale:'en',baseRev:'r1',base,draft:{...base,title:'Mine'}};
test('records isolate account, entry, locale and writers; all matching recoverable copies survive',()=>{
 const storage=memory();const one=new LocalDraftStore(storage,'user1','tab1',()=>1000),two=new LocalDraftStore(storage,'user1','tab2',()=>1001);
 one.write(snapshot);two.write({...snapshot,draft:{...base,title:'Second'}});
 assert.equal(one.list('a','en').length,2);assert.equal(one.list('a','zh').length,0);assert.equal(one.list('b','en').length,0);assert.equal(new LocalDraftStore(storage,'user2','tab3').list('a','en').length,0);
 one.clearOwn('a','en');assert.equal(two.list('a','en').length,1);assert.equal(two.list('a','en')[0].draft.title,'Second');
});
test('expiry and malformed records never become drafts; quota errors are observable',()=>{
 const storage=memory();new LocalDraftStore(storage,'u','t',()=>1000).write(snapshot);
 assert.equal(new LocalDraftStore(storage,'u','new',()=>1000+8*86400000).list('a','en').length,0);
 storage.setItem('qualitour:tour-draft:v1:broken','{invalid');assert.equal(new LocalDraftStore(storage,'u','next').list('a','en').length,0);
 const denied={...storage,setItem:()=>{throw new Error('QuotaExceeded');}};assert.throws(()=>new LocalDraftStore(denied,'u','x').write(snapshot),/QuotaExceeded/);
});
test('removing an offered snapshot cannot remove a newer write from that tab',()=>{
 const storage=memory(),old=new LocalDraftStore(storage,'u','old',()=>1000),fresh=new LocalDraftStore(storage,'u','new',()=>1001);
 old.write(snapshot);const offered=fresh.list('a','en')[0];old.write({...snapshot,draft:{...base,title:'New typing'}});fresh.remove(offered);
 assert.equal(fresh.list('a','en')[0].draft.title,'New typing');
});
test('nonoverlapping local and server changes preserve latest server metadata',()=>{
 const result=reconcileDraft(base,{...base,title:'Mine'},{...base,price:'200',source_key:'latest',new_schema_field:'keep'});
 assert.deepEqual(result.conflicts,[]);assert.deepEqual(applyResolution(result,{}),{...base,title:'Mine',price:'200',source_key:'latest',new_schema_field:'keep'});
});
test('same-value concurrent changes are safe; changed itinerary arrays need explicit choices',()=>{
 const local={...base,title:'Same',itinerary:[{...base.itinerary[0],title:'Mine'}]};const server={...base,title:'Same',itinerary:[{...base.itinerary[0],title:'Theirs'}]};
 const result=reconcileDraft(base,local,server);assert.deepEqual(result.conflicts.map(x=>x.field),['itinerary']);
 assert.throws(()=>applyResolution(result,{}),/選擇/);
 assert.equal(applyResolution(result,{itinerary:'local'}).itinerary[0].title,'Mine');assert.equal(applyResolution(result,{itinerary:'server'}).itinerary[0].title,'Theirs');
});
test('uneditable changed recovery data is rejected; untouched server field deletion stays deleted',()=>{
 assert.throws(()=>reconcileDraft(base,{...base,source_key:'tamper'},base),/欄位/);
 const server={title:'Old',itinerary:base.itinerary,source_key:'untouched'};
 assert.equal(Object.hasOwn(applyResolution(reconcileDraft(base,{...base,title:'Mine'},server),{}),'price'),false);
});
