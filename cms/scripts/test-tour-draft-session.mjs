import assert from 'node:assert/strict';
import test from 'node:test';
import { TourDraftSession } from '../src/plugins/tour-editor/draft-session.ts';
const data = { title: 'Original', overview: [{ _type: 'block', custom: true }], itinerary: [{ _key: 'd1', _type: 'day', title: 'Day one', content: [] }], source_key: 'preserve' };
const item = (id = 'a', locale = 'en', rev = 'r1') => ({ id, locale, _rev: rev, data: structuredClone(data), draftRevisionId: 'draft1', status: 'published' });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };
test('slug or language-less entry lookup resolves once before locking the canonical identity',async()=>{
 let reads=0;const locks=[];const session=new TourDraftSession(transport({load:async(id,locale)=>{reads++;assert.equal(id,'old-slug');assert.equal(locale,'');return item('real-id','zh');},acquire:async(id,locale)=>{locks.push([id,locale]);return {enabled:true,heldByCaller:true};}}));
 assert.equal(session.getSnapshot().loading,true);
 await session.load('old-slug','',{resolveIdentity:true});
 assert.equal(reads,1);assert.deepEqual(locks,[['real-id','zh']]);assert.equal(session.getSnapshot().item.id,'real-id');assert.equal(session.getSnapshot().item.locale,'zh');assert.equal(session.getSnapshot().readOnly,false);
});
test('resolved lookup still refuses the wrong language or another canonical ID',async()=>{
 for(const [id,locale] of [['old-slug','en'],['01M765MK8RM5PF2VKR1G1YTC9E','']]){
  const session=new TourDraftSession(transport({load:async()=>item('other-id','zh')}));await session.load(id,locale,{resolveIdentity:true});assert.equal(session.getSnapshot().readOnly,true);assert.equal(session.getSnapshot().item,null);
 }
});
function transport(overrides = {}) { return { load: async (id, locale) => item(id, locale), acquire: async () => ({ enabled: true, heldByCaller: true }), release: async () => {}, save: async (id, locale, payload) => ({ ...item(id, locale, 'r2'), data: { ...structuredClone(data), ...payload.data }, draftRevisionId: 'draft2' }), ...overrides }; }
test('entry actions require a clean writable draft and preserve revision identity',async()=>{
  const session=new TourDraftSession(transport());await session.load('a','en');let calls=0;
  session.patch(d=>({...d,title:'unsaved'}));
  assert.equal(await session.runEntryAction(async()=>{calls++;return item();}),false);assert.equal(calls,0);
  await session.save();
  assert.equal(await session.runEntryAction(async current=>{calls++;assert.equal(current._rev,'r2');return {...current,_rev:'r3',slug:'new-slug'};}),true);
  assert.equal(calls,1);assert.equal(session.getSnapshot().item.slug,'new-slug');assert.equal(session.getSnapshot().item._rev,'r3');
});
test('entry actions serialize writers, block edits while running, and retain state on conflict',async()=>{
  const session=new TourDraftSession(transport());await session.load('a','en');const write=deferred();
  const action=session.runEntryAction(()=>write.promise);session.patch(d=>({...d,title:'must not apply'}));
  assert.equal(session.getSnapshot().draft.title,'Original');assert.equal(await session.save(),false);
  assert.equal(await session.runEntryAction(async()=>item()),false);
  write.reject(Object.assign(new Error('Conflict'),{status:409}));assert.equal(await action,false);
  assert.equal(session.getSnapshot().item._rev,'r1');assert.equal(session.getSnapshot().readOnly,true);assert.equal(session.getSnapshot().operating,false);
});
test('late entry actions cannot replace another tour or locale',async()=>{
  const session=new TourDraftSession(transport());await session.load('a','en');const write=deferred();
  const action=session.runEntryAction(()=>write.promise);await session.load('b','zh');write.resolve({...item(),_rev:'r2'});
  assert.equal(await action,false);assert.equal(session.getSnapshot().item.id,'b');assert.equal(session.getSnapshot().item.locale,'zh');
});
test('entry actions refresh the lease before writing and reject malformed responses',async()=>{
  let allowed=true,calls=0;const session=new TourDraftSession(transport({acquire:async()=>({enabled:true,heldByCaller:allowed})}));await session.load('a','en');
  allowed=false;assert.equal(await session.runEntryAction(async()=>{calls++;return item();}),false);assert.equal(calls,0);
  allowed=true;await session.load('a','en');assert.equal(await session.runEntryAction(async()=>item('a','zh')),false);assert.equal(session.getSnapshot().item.locale,'en');
});
test('loading an old version blocks intervening edits and keeps it as an unsaved draft',async()=>{
 const session=new TourDraftSession(transport());await session.load('a','en');const read=deferred();
 const loading=session.loadDraftVersion(()=>read.promise);session.patch(d=>({...d,title:'intervening'}));
 assert.equal(session.getSnapshot().draft.title,'Original');assert.equal(session.getSnapshot().saving,true);
 assert.equal(await session.runEntryAction(async()=>item()),false);
 read.resolve({...structuredClone(data),title:'Old revision'});assert.equal(await loading,true);
 assert.equal(session.getSnapshot().base.title,'Original');assert.equal(session.getSnapshot().draft.title,'Old revision');assert.equal(session.getSnapshot().dirty,true);assert.equal(session.getSnapshot().item._rev,'r1');
});
test('a slower old language load cannot replace the selected entry', async () => {
  const old = deferred(); const session = new TourDraftSession(transport({ load: (id, locale) => locale === 'en' ? old.promise : Promise.resolve(item(id, locale)) }));
  const first = session.load('a', 'en'); await session.load('b', 'zh'); old.resolve(item()); await first;
  assert.equal(session.getSnapshot().item.id, 'b'); assert.equal(session.getSnapshot().item.locale, 'zh');
});
test('saving keeps new edits dirty and preserves all untouched data', async () => {
  const write = deferred(); const session = new TourDraftSession(transport({ save: () => write.promise })); await session.load('a','en');
  session.patch(d => ({ ...d, itinerary: [{ ...d.itinerary[0], title: 'First edit' }] }));
  const saving = session.save();
  session.patch(d => ({ ...d, itinerary: [{ ...d.itinerary[0], title: 'Later typing' }] }));
  write.resolve({ ...item('a','en','r2'), data: { ...structuredClone(data), itinerary: [{ ...data.itinerary[0], title: 'First edit' }] }, draftRevisionId: 'draft2' }); await saving;
  assert.equal(session.getSnapshot().base.itinerary[0].title, 'First edit');
  assert.equal(session.getSnapshot().draft.itinerary[0].title, 'Later typing');
  assert.equal(session.getSnapshot().dirty, true); assert.equal(session.getSnapshot().item._rev, 'r2');
  assert.deepEqual(session.getSnapshot().draft.overview, data.overview);
});
test('a revision conflict preserves local edits and prevents a silent retry', async () => {
  const session = new TourDraftSession(transport({ save: async () => { throw Object.assign(new Error('Conflict'), { status: 409 }); } })); await session.load('a','en');
  session.patch(d => ({ ...d, itinerary: [{ ...d.itinerary[0], title: 'Keep my text' }] })); await session.save();
  assert.equal(session.getSnapshot().draft.itinerary[0].title, 'Keep my text');
  assert.equal(session.getSnapshot().dirty, true); assert.equal(session.getSnapshot().readOnly, true); assert.match(session.getSnapshot().error,/衝突/);
});
test('missing revision, wrong locale and lost locks never become writable sessions', async () => {
  for (const overrides of [{ load: async () => ({ ...item(), _rev: undefined }) }, { load: async () => item('a','zh') }, { acquire: async () => ({ enabled: true, heldByCaller: false }) }]) {
    const session = new TourDraftSession(transport(overrides)); await session.load('a','en'); assert.equal(session.getSnapshot().readOnly, true);
  }
});
test('a save completed after switching entries cannot update the new identity', async () => {
  const write=deferred();const session=new TourDraftSession(transport({save:()=>write.promise}));await session.load('a','en');
  session.patch(d=>({...d,itinerary:[{...d.itinerary[0],title:'A pending'}]}));const saving=session.save();
  await session.load('b','zh');write.resolve(item('a','en','r2'));await saving;
  assert.equal(session.getSnapshot().item.id,'b');assert.equal(session.getSnapshot().item._rev,'r1');assert.equal(session.getSnapshot().dirty,false);
});
test('a heartbeat completed after leaving releases its late lease',async()=>{
  const delayed=deferred();let slow=false,held=false;
  const session=new TourDraftSession(transport({acquire:async()=>{if(slow)await delayed.promise;held=true;return {enabled:true,heldByCaller:true};},release:async()=>{held=false;}}));
  await session.load('a','en');slow=true;const heartbeat=session.refreshLock();session.close();delayed.resolve();await heartbeat;
  assert.equal(held,false,'A closed editor must not leave a newly reacquired lease behind');
});
test('other sections save sparsely while preserving source fields and the existing itinerary',async()=>{
  let stored=item();const session=new TourDraftSession(transport({save:async(id,locale,payload)=>{stored={...stored,_rev:'r2',draftRevisionId:'draft2',data:{...stored.data,...payload.data}};return structuredClone(stored);}}));
  await session.load('a','en');session.patch(d=>({...d,title:'Changed title',price:'Contact us'}));await session.save();
  assert.equal(stored.data.title,'Changed title');assert.equal(stored.data.source_key,'preserve');assert.deepEqual(stored.data.itinerary,data.itinerary);assert.equal(session.getSnapshot().dirty,false);
});
test('a read-only observer never silently acquires and renews an expired colleague lease',async()=>{
  let holder='colleague';
  const session=new TourDraftSession(transport({acquire:async()=>{if(holder==='colleague')return {enabled:true,heldByCaller:false};holder='workspace';return {enabled:true,heldByCaller:true};}}));
  await session.load('a','en');assert.equal(session.getSnapshot().readOnly,true);
  holder=null;await session.refreshLock();assert.equal(holder,null,'An observing read-only tab must leave the lock available');
  await session.load('a','en');assert.equal(holder,'workspace');assert.equal(session.getSnapshot().readOnly,false);
});
