// Who may use which public identity, and why the site leaves a tour out. One tour's problem never stops the rest.
// The CMS "Duplicate" button copies every field, `source_key` included, so the key alone cannot say which entry is
// the original. This file is also bundled into the tour editor: keep it free of server-only imports.
import published from '../../data/cms-tour-owners.json' with { type: 'json' };

export const tourOwners = published.owners;

const NEVER_PUBLIC = new Set(['draft', 'pending', 'private']);
/**
 * Whether an entry is one of the imported WordPress tours. The live loader exposes unset columns as null, so a
 * native tour carries `source_key: null`; any string (even an empty one, which then fails identity checks) claims
 * an import.
 */
export function claimsImport(data) {
  // Tours that were never public on WordPress (draft, pending, private) have no frozen public snapshot to compare
  // with; once an editor publishes one it renders like any native tour, from its CMS fields alone.
  if (NEVER_PUBLIC.has(data?.source_status)) return false;
  return ['source_key', 'source_status'].some(field => typeof data?.[field] === 'string');
}

/**
 * Why this entry may not use its import identity, or null. `known` says whether the site holds that import.
 * Ownership is fixed by entry ID: a copy stays a copy even while the original is unpublished or deleted, and the
 * answer needs no other entry, so the CMS pages, the static site build and the editor always agree.
 */
export function importProblem(entryId, data, { owners = tourOwners, known = key => Object.hasOwn(owners, key) } = {}) {
  if (!claimsImport(data)) return null;
  const sourceKey = data.source_key;
  if (typeof sourceKey !== 'string' || !sourceKey) return { code: 'missing-source-key', sourceKey: '' };
  if (!known(sourceKey)) return { code: 'unknown-source-key', sourceKey };
  const ownerId = Object.hasOwn(owners, sourceKey) ? owners[sourceKey] : undefined;
  return ownerId && ownerId !== entryId ? { code: 'copy', sourceKey, ownerId } : null;
}

const earlier = (a, b) => Number(b.imported) - Number(a.imported)
  || Date.parse(a.publishedAt) - Date.parse(b.publishedAt)
  || (a.entryId < b.entryId ? -1 : a.entryId > b.entryId ? 1 : 0);

/**
 * The claims that lose when two tours ask for one identity or one address: imported tours keep their old address,
 * otherwise whoever was published first does. The order the claims arrive in makes no difference.
 */
export function claimPublicIdentities(claims) {
  const identities = new Map(), addresses = new Map(), lost = [];
  for (const claim of [...claims].sort(earlier)) {
    const sameIdentity = identities.get(claim.identity), sameAddress = addresses.get(claim.slug);
    if (sameIdentity !== undefined) lost.push({ entryId: claim.entryId, code: 'copy', sourceKey: claim.identity, ownerId: sameIdentity });
    else if (sameAddress !== undefined) lost.push({ entryId: claim.entryId, code: 'url-taken', ownerId: sameAddress });
    else { identities.set(claim.identity, claim.entryId); addresses.set(claim.slug, claim.entryId); }
  }
  return lost;
}

/** Operator log lines: which tours a build left out, and why. */
export function reportHiddenTours(locale, rejected, log = console.warn) {
  for (const row of rejected) log(`[tours] ${locale} entry ${row.entryId} left out of the site (${row.code}${row.sourceKey ? `, ${row.sourceKey}` : ''}${row.ownerId ? `, kept by ${row.ownerId}` : ''})`);
}

/** What the tour editor tells staff about the tour on screen; null when its identity is fine. */
export function tourIdentityNotice(entryId, data, owners = tourOwners) {
  const problem = importProblem(entryId, data, { owners });
  if (!problem) return null;
  if (problem.code === 'copy') return {
    ...problem,
    title: '這是複製出來的團，網站不會顯示它',
    message: `複製時連原團的舊系統編號（${problem.sourceKey}）也一併複製了，網站只認原團。這個複本即使發佈，客人也看不到；原團的內容和網址不受影響。`,
    action: '要改原團，請打開原團修改。要開新團，請在行程列表新增行程，不要用「複製」。這個複本可以刪除；如果已經發佈，也可以下架。',
  };
  return {
    ...problem,
    title: '系統認不出這個團的舊系統編號，網站不會顯示它',
    message: `舊系統編號：${problem.sourceKey || '（空白）'}。其他團不受影響。`,
    action: '請通知網站管理員。',
  };
}
