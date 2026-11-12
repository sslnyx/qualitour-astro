import assert from 'node:assert/strict';

function parseWp(value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value)||value.startsWith('0000-'))return null;
 const date=new Date(value.replace(' ','T')+'Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,19)===value.replace(' ','T')?date:null;
}
export function wordpressDates(post){
 const fields=['date','modified'];
 const pair=fields.map(field=>({local:parseWp(post[`post_${field}`]),gmt:parseWp(post[`post_${field}_gmt`])}));
 const known=pair.find(({local,gmt})=>local&&gmt);
 const offset=known?known.local.getTime()-known.gmt.getTime():null;
 const dates=pair.map(({local,gmt})=>{
  if(gmt)return gmt.toISOString();
  assert.ok(local,'Invalid WordPress local date');
  assert.ok(offset!==null&&Math.abs(offset)<=14*3600000,'Missing trustworthy same-post UTC offset');
  // A date's season can have a different UTC offset. Without archived site
  // timezone settings, only an identical civil timestamp proves the offset.
  assert.equal(local.getTime(),known.local.getTime(),'Missing GMT date requires a same civil timestamp or verified site timezone');
  return new Date(local.getTime()-offset).toISOString();
 });
 return {createdAt:dates[0],updatedAt:dates[1]};
}
const quote=value=>{assert.equal(typeof value,'string');return "'"+value.replaceAll("'","''")+"'";};
export function planWpDateRepair(rows,sources,completed=[]){
 const bySource=new Map(sources.map(source=>[source.key,source]));
 assert.equal(bySource.size,sources.length,'Duplicate archived source');
 const done=new Set(completed),seen=new Set(),changes=[],unchanged=[],skipped=[];
 for(const row of rows){
  assert.ok(!seen.has(row.source_key),'Duplicate tour source key');seen.add(row.source_key);
  const source=bySource.get(row.source_key);assert.ok(source,'Unknown tour source');
  assert.equal(row.locale,source.locale,'Source locale mismatch');assert.ok(row.id&&row.created_at&&row.updated_at,'Missing tour date metadata');
  if(done.has(row.source_key)){skipped.push(row.source_key);continue;}
  const dates=wordpressDates(source.post);
  if(row.created_at===dates.createdAt&&row.updated_at===dates.updatedAt){unchanged.push(row.source_key);continue;}
  changes.push({id:row.id,locale:row.locale,sourceKey:row.source_key,beforeCreatedAt:row.created_at,beforeUpdatedAt:row.updated_at,...dates});
 }
 const update=(c,rollback=false)=>`UPDATE ec_tours SET created_at=${quote(rollback?c.beforeCreatedAt:c.createdAt)},updated_at=${quote(rollback?c.beforeUpdatedAt:c.updatedAt)} WHERE id=${quote(c.id)} AND locale=${quote(c.locale)} AND source_key=${quote(c.sourceKey)} AND deleted_at IS NULL AND created_at=${quote(rollback?c.createdAt:c.beforeCreatedAt)} AND updated_at=${quote(rollback?c.updatedAt:c.beforeUpdatedAt)};`;
 return {changes,unchanged,skipped,sql:changes.map(c=>update(c)).join('\n')+'\n',rollbackSql:changes.map(c=>update(c,true)).join('\n')+'\n'};
}
export function verifyWpDateRepair(plan,rows){
 const byId=new Map(rows.map(row=>[row.id,row]));assert.equal(byId.size,rows.length,'Duplicate tour ID');
 for(const c of plan.changes){const row=byId.get(c.id);assert.ok(row&&row.source_key===c.sourceKey&&row.locale===c.locale,'Tour identity changed');assert.equal(row.created_at,c.createdAt,'Creation date did not match');assert.equal(row.updated_at,c.updatedAt,'Modification date did not match');}
 return [...plan.unchanged,...plan.changes.map(c=>c.sourceKey)];
}
