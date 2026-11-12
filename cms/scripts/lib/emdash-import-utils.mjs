import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export function assertLocalTarget(value) {
  const url=new URL(value);
  assert.ok(url.protocol==='http:' && url.hostname==='127.0.0.1' && url.port==='4327' && !url.username && !url.password && url.pathname==='/' && !url.search && !url.hash, 'Import is restricted to http://127.0.0.1:4327');
  return url;
}
export function sourceIdentity(record,locale) {
  assert.ok(['en','zh'].includes(locale) && /^\d+$/.test(String(record?.post?.ID)), 'Invalid archived tour identity');
  return `wp-${locale}-${record.post.ID}`;
}
export function publicationPolicy(record) { return record.post.post_status==='publish' && !record.post.post_password; }
export function shouldPublishImportedEntry({checkpoint,sourcePublished,current,expectedHash}) {
  if(checkpoint?.phase==='complete'||!sourcePublished||current.status==='published')return false;
  assert.equal(current.status,'draft','Only an untouched new imported draft can be automatically published');
  assert.ok(!current.publishedAt,'Entry was previously published/unpublished; preserve the editor decision');
  assert.equal(importWriteHash(current.data),expectedHash,'Imported draft was edited; refusing automatic publication');
  return true;
}
export async function publishCheckedImportedEntry(request,id,locale,revision) {
  assert.ok(revision,'Publication requires the revision whose source mapping was checked');
  // A fresh read here could silently publish an editor change made after the
  // source-hash check. Let EmDash reject the original revision on conflict.
  return request(`/_emdash/api/content/tours/${encodeURIComponent(id)}/publish?locale=${encodeURIComponent(locale)}`,{method:'POST',body:{_rev:revision}});
}
export function assertImportedMedia(cached,live,asset,base) {
  assert.ok(live&&live.id===cached.id&&live.status==='ready','Cached media is missing or no longer ready on this target');
  assert.equal(cached.sourceSha256,asset.sha256,'Cached media source hash differs');
  assert.equal(live.size,asset.bytes,'Cached media size differs');
  assert.equal(live.mimeType,cached.mimeType,'Cached media MIME differs');
  const url=new URL(cached.url,base);const prefix='/_emdash/api/media/file/';
  assert.ok(url.origin===base.origin&&!url.username&&!url.password&&url.pathname.startsWith(prefix),'Cached media escaped this target');
  assert.equal(decodeURIComponent(url.pathname.slice(prefix.length)),live.storageKey,'Cached media was replaced or journal belongs to another target');
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
export function canonicalHash(value) { return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex'); }
export function importWriteHash(data) {
  const result={...data};delete result.import_hash;
  for (const key of Object.keys(result)) if (result[key]==null) delete result[key];
  for (const field of ['hero','brochure']) if (result[field] && typeof result[field]==='object') result[field]=result[field].id;
  if (Array.isArray(result.gallery)) result.gallery=result.gallery.map(item=>({...item,image:typeof item.image==='object'?item.image?.id:item.image}));
  return canonicalHash(result);
}
export function archivedSourcePayload(record,snapshot,taxonomy,sourceKey) {
  const relationships=taxonomy.hyp_term_relationships.filter(x=>x.object_id===record.post.ID);
  const ids=new Set(relationships.map(x=>x.term_taxonomy_id));
  const nodes=taxonomy.hyp_term_taxonomy.filter(x=>ids.has(x.term_taxonomy_id));
  const termIds=new Set(nodes.map(x=>x.term_id));
  return JSON.stringify({schema_version:1,source_key:sourceKey,record,snapshot,taxonomy:{relationships,nodes,terms:taxonomy.hyp_terms.filter(x=>termIds.has(x.term_id)),termmeta:taxonomy.hyp_termmeta.filter(x=>termIds.has(x.term_id))}});
}
