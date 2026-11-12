import assert from 'node:assert/strict';

// Read-only metadata avoids downloading every private source payload before
// each small cloud batch. Content writes and hash checks still use EmDash APIs.
export const CLOUD_IMPORT_INVENTORY_SQL = `
SELECT 'legacy_tours' AS collection,id,locale,source_key FROM ec_legacy_tours
WHERE deleted_at IS NULL AND locale IN ('en','zh') AND source_key IS NOT NULL AND source_key!=''
UNION ALL
SELECT 'tours' AS collection,id,locale,source_key FROM ec_tours
WHERE deleted_at IS NULL AND locale IN ('en','zh') AND source_key IS NOT NULL AND source_key!=''`;

export function indexImportInventory(rows) {
 assert.ok(Array.isArray(rows),'Invalid cloud inventory response');
 const legacy=new Map(),tours=new Map();
 for(const row of rows){
  assert.ok(['legacy_tours','tours'].includes(row.collection),'Unexpected cloud inventory collection');
  assert.ok(['en','zh'].includes(row.locale),'Unexpected cloud inventory locale');
  assert.ok(typeof row.id==='string'&&row.id&&typeof row.source_key==='string'&&row.source_key,'Invalid cloud source identity');
  const map=row.collection==='legacy_tours'?legacy:tours;
  assert.ok(!map.has(row.source_key),'Duplicate source key found');
  map.set(row.source_key,{id:row.id,locale:row.locale,data:{source_key:row.source_key}});
 }
 return {legacy,tours};
}
