import test from 'node:test';
import assert from 'node:assert/strict';
import {settingsFromEntry,settingsPayload,revisionDraft,requireCurrentTerms,requireCurrentSchedule} from '../src/plugins/tour-editor/tour-settings.ts';
test('preflight catches assignments or schedules already changed in another session',()=>{
 assert.doesNotThrow(()=>requireCurrentTerms(['a','b'],['b','a']));assert.throws(()=>requireCurrentTerms(['a'],['b']),{status:409});
 assert.doesNotThrow(()=>requireCurrentSchedule({_rev:'r1',scheduledAt:'time1'},{_rev:'r1',scheduledAt:'time1'}));
 assert.throws(()=>requireCurrentSchedule({_rev:'r1',scheduledAt:'time1'},{_rev:'r2',scheduledAt:'time2'}),{status:409});
});
test('settings produce only slug and SEO and preserve untouched image metadata',()=>{
 const entry={slug:'original',seo:{title:null,description:'desc',image:'media1',canonical:null,noIndex:false}};
 const form=settingsFromEntry(entry);form.slug=' new-slug ';form.title='SEO';
 assert.deepEqual(settingsPayload(form),{slug:'new-slug',seo:{title:'SEO',description:'desc',image:'media1',canonical:null,noIndex:false}});
 for(const canonical of ['javascript:alert(1)','//external.test','ftp://external.test'])assert.throws(()=>settingsPayload({...form,canonical}),/完整/);
 assert.equal(settingsPayload({...form,canonical:'https://qualitour.ca/tour'}).seo.canonical,'https://qualitour.ca/tour');
});
test('revision loading restores editable data only, preserves source and unknown values, rejects foreign entries',()=>{
 const current={title:'Now',itinerary:[],gallery:[{image:'recent'}],source_key:'keep',custom:{keep:true}};
 const revision={collection:'tours',entryId:'a',data:{title:'Before',itinerary:[],source_key:'old',custom:'wrong'}};
 const next=revisionDraft('a',current,revision);assert.equal(next.title,'Before');assert.deepEqual(next.gallery,[]);assert.equal(next.source_key,'keep');assert.deepEqual(next.custom,{keep:true});
 assert.throws(()=>revisionDraft('b',current,revision),/此行程/);assert.throws(()=>revisionDraft('a',current,{...revision,collection:'pages'}),/此行程/);
});
