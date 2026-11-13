import assert from 'node:assert/strict';
import test from 'node:test';
import { createKvSnapshotStore, bumpNativeSnapshotVersion, SNAPSHOT_VERSION_KEY } from '../src/lib/cms/native-snapshot-kv.mjs';

function fakeKv(){
  const values=new Map(), log=[];
  return {values,log,
    async get(key,type){log.push(['get',key]);const v=values.get(key);return v===undefined?null:(type==='json'?JSON.parse(v):v);},
    async put(key,value,options){log.push(['put',key,options?.expirationTtl]);values.set(key,value);}};
}
test('the first read creates a version marker with a bounded lifetime, later reads reuse it',async()=>{
  const kv=fakeKv(), store=createKvSnapshotStore({getKv:()=>kv});
  const first=await store.version();
  assert.match(first,/^[0-9a-f-]{36}$/);
  assert.equal(await store.version(),first);
  const puts=kv.log.filter(entry=>entry[0]==='put');
  assert.equal(puts.length,1,'the marker is written once');
  assert.ok(puts[0][2]>=60&&puts[0][2]<=24*3600,'a missed purge cannot leave a stale snapshot for long');
});
test('bumping the marker leaves the old snapshot behind and points readers at a new key',async()=>{
  const kv=fakeKv(), store=createKvSnapshotStore({getKv:()=>kv});
  const before=await store.version();
  await store.put(before,{catalogues:{en:{tours:[]},zh:{tours:[]}},entryIds:{}});
  assert.ok(await store.get(before));
  await bumpNativeSnapshotVersion(kv);
  const after=await store.version();
  assert.notEqual(after,before);
  assert.equal(await store.get(after),null,'a bumped marker finds no snapshot, so the next render rebuilds');
  assert.equal(kv.values.has(SNAPSHOT_VERSION_KEY),true);
});
test('without a KV binding there is no marker and no error',async()=>{
  const store=createKvSnapshotStore({getKv:()=>null});
  assert.equal(await store.version(),null);
  assert.equal(await store.get('x'),null);
  await store.put('x',{});
  await assert.rejects(bumpNativeSnapshotVersion(null),/KV/,'a purge that cannot bump the marker must fail loudly');
});
test('KV trouble reads as a miss, never as an exception',async()=>{
  const broken={async get(){throw new Error('down');},async put(){throw new Error('down');}};
  const store=createKvSnapshotStore({getKv:()=>broken});
  assert.equal(await store.version(),null);
  assert.equal(await store.get('x'),null);
  await store.put('x',{});
  await assert.rejects(bumpNativeSnapshotVersion(broken),/down/);
});
