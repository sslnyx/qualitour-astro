import assert from 'node:assert/strict';
import test from 'node:test';
import { TourDraftSession } from '../src/plugins/tour-editor/draft-session.ts';
import { LocalDraftStore } from '../src/plugins/tour-editor/local-draft.ts';
const base={title:'Original',price:'100',itinerary:[{_type:'day',_key:'d',title:'Day1',content:[]}],source_key:'keep'};
const entry=(rev='r1',data=base)=>({id:'a',locale:'en',_rev:rev,draftRevisionId:rev,status:'published',data:structuredClone(data)});
function fixture(){const values=new Map();const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let server=entry();let saves=0;const transport={load:async()=>structuredClone(server),acquire:async()=>({enabled:true,heldByCaller:true}),release:async()=>{},save:async(id,locale,payload)=>{saves++;if(payload._rev!==server._rev)throw Object.assign(new Error('Conflict'),{status:409});server=entry('r'+(Number(server._rev.slice(1))+1),{...server.data,...payload.data});return structuredClone(server);}};return {storage,transport,setServer:e=>{server=e;},getServer:()=>server,saves:()=>saves};}
test('reload offers a local copy without auto-restore; explicit recovery uses latest server and never auto-saves',async()=>{
 const f=fixture(),old=new TourDraftSession(f.transport,new LocalDraftStore(f.storage,'u','old'));await old.load('a','en');old.patch(d=>({...d,title:'Unsaved'}));old.close();
 f.setServer(entry('r2',{...base,price:'200',source_key:'latest'}));const fresh=new TourDraftSession(f.transport,new LocalDraftStore(f.storage,'u','new'));await fresh.load('a','en');
 assert.equal(fresh.getSnapshot().draft.title,'Original');assert.equal(fresh.getSnapshot().recovery.length,1);
 await fresh.compareRecovery(fresh.getSnapshot().recovery[0].key);fresh.applyComparison({});
 assert.equal(fresh.getSnapshot().draft.title,'Unsaved');assert.equal(fresh.getSnapshot().draft.price,'200');assert.equal(fresh.getSnapshot().item._rev,'r2');assert.equal(f.saves(),0);
 await fresh.save();assert.equal(f.getServer().data.title,'Unsaved');assert.equal(new LocalDraftStore(f.storage,'u','check').list('a','en').length,0);
});
test('409 comparison requires choices; second concurrent change causes another conflict instead of overwriting',async()=>{
 const f=fixture(),session=new TourDraftSession(f.transport,new LocalDraftStore(f.storage,'u','one'));await session.load('a','en');session.patch(d=>({...d,title:'Mine'}));f.setServer(entry('r2',{...base,title:'Theirs',source_key:'server'}));await session.save();assert.equal(session.getSnapshot().conflict,true);
 await session.compareLatest();assert.equal(session.getSnapshot().comparison.result.conflicts[0].field,'title');assert.throws(()=>session.applyComparison({}),/選擇/);session.applyComparison({title:'local'});
 assert.equal(session.getSnapshot().draft.source_key,'server');assert.equal(session.getSnapshot().item._rev,'r2');assert.equal(session.getSnapshot().dirty,true);
 f.setServer(entry('r3',{...base,title:'Third'}));assert.equal(await session.save(),false);assert.equal(session.getSnapshot().draft.title,'Mine');assert.equal(f.getServer().data.title,'Third');
});
test('discard and successful save clear owned recovery; later typing during a save remains recoverable',async()=>{
 const f=fixture(),store=new LocalDraftStore(f.storage,'u','one'),session=new TourDraftSession(f.transport,store);await session.load('a','en');session.patch(d=>({...d,title:'Discard me'}));session.discard();assert.equal(store.list('a','en').length,0);assert.equal(session.getSnapshot().dirty,false);
 let finish;f.transport.save=()=>new Promise(resolve=>{finish=resolve;});session.patch(d=>({...d,title:'First'}));const saving=session.save();await new Promise(resolve=>setImmediate(resolve));session.patch(d=>({...d,title:'Later'}));finish(entry('r2',{...base,title:'First'}));await saving;
 assert.equal(store.list('a','en')[0].draft.title,'Later');assert.equal(store.list('a','en')[0].base.title,'First');
});
test('a late comparison never replaces newer entry identity, and denied storage preserves edits with visible warning',async()=>{
 const f=fixture(),session=new TourDraftSession(f.transport,new LocalDraftStore({...f.storage,setItem:()=>{throw new Error('Quota');}},'u','one'));await session.load('a','en');session.patch(d=>({...d,title:'Keep'}));assert.equal(session.getSnapshot().draft.title,'Keep');assert.match(session.getSnapshot().localError,/暫存/);
 let finish;f.transport.load=()=>new Promise(resolve=>{finish=resolve;});const comparing=session.compareLatest();session.close();finish(entry('r2',{...base,title:'Late'}));await comparing;assert.equal(session.getSnapshot().draft.title,'Keep');assert.equal(session.getSnapshot().comparison,null);
});
test('restoring an offered copy cannot replace new typing in the current editor',async()=>{
 const f=fixture(),old=new LocalDraftStore(f.storage,'u','old');old.write({entryId:'a',locale:'en',baseRev:'r1',base,draft:{...base,title:'Old copy'}});
 const session=new TourDraftSession(f.transport,new LocalDraftStore(f.storage,'u','new'));await session.load('a','en');session.patch(d=>({...d,title:'New typing'}));await session.compareRecovery(session.getSnapshot().recovery[0].key);
 assert.equal(session.getSnapshot().comparison,null);assert.equal(session.getSnapshot().draft.title,'New typing');assert.match(session.getSnapshot().error,/目前修改/);
});
test('an old comparison choice cannot overwrite later typing after its dialog has closed',async()=>{
 const f=fixture(),session=new TourDraftSession(f.transport);await session.load('a','en');session.patch(d=>({...d,title:'Mine'}));await session.compareLatest();session.cancelComparison();session.patch(d=>({...d,title:'Later typing'}));session.applyComparison({});assert.equal(session.getSnapshot().draft.title,'Later typing');
});
test('choosing server for every recovered field consumes the old copy even when no save is needed',async()=>{
 const f=fixture(),old=new LocalDraftStore(f.storage,'u','old');old.write({entryId:'a',locale:'en',baseRev:'r1',base,draft:{...base,title:'Mine'}});f.setServer(entry('r2',{...base,title:'Server'}));
 const store=new LocalDraftStore(f.storage,'u','new'),session=new TourDraftSession(f.transport,store);await session.load('a','en');await session.compareRecovery(session.getSnapshot().recovery[0].key);session.applyComparison({title:'server'});
 assert.equal(session.getSnapshot().dirty,false);assert.equal(store.list('a','en').length,0);assert.equal(f.saves(),0);
});
test('corrupt matching local copies are reported without hiding or discarding current server content',async()=>{
 const f=fixture(),old=new LocalDraftStore(f.storage,'u','old');old.write({entryId:'a',locale:'en',baseRev:'r1',base,draft:{...base,title:'Mine'}});const key=f.storage.key(0);f.storage.setItem(key,'{broken');
 const session=new TourDraftSession(f.transport,new LocalDraftStore(f.storage,'u','new'));await session.load('a','en');assert.match(session.getSnapshot().localError,/損壞|不相容/);assert.equal(session.getSnapshot().draft.title,'Original');assert.equal(f.storage.getItem(key),'{broken');
});
