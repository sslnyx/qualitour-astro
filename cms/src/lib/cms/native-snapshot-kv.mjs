/**
 * The catalogue snapshot lives in KV under a *version marker*, not under a key computed from the database.
 *
 * Computing a key from the database meant reading every term assignment and every taxonomy term (about 5,700 rows)
 * on each page render that missed the edge cache, which exhausted D1's free daily row-read allowance. EmDash already
 * calls the cache provider's `invalidate` after every publish, unpublish, restore, edit, term assignment and taxonomy
 * change, and that is the same signal that purges the cached pages, so the marker is replaced there. A render then
 * costs one KV read for the marker and one for the snapshot, and no D1 rows at all.
 *
 * Publishing and rendering both run in the CMS Durable Object, so a replaced marker is read back at once. The marker
 * also expires on its own, which bounds how long a snapshot could outlive a purge that somehow never reached us.
 */
export const SNAPSHOT_VERSION_KEY = 'native-catalogue-version';
const SNAPSHOT_FORMAT = 1;
const SNAPSHOT_TTL_SECONDS = 7 * 24 * 3600;
const VERSION_TTL_SECONDS = 6 * 3600;

let snapshotKv = null;
/** Called per request by the middleware with the Worker's KV binding; without one, catalogues are just not cached. */
export function setNativeSnapshotKv(kv) { snapshotKv = kv || null; }

export function createKvSnapshotStore({ getKv = () => snapshotKv } = {}) {
  const name = version => `native-catalogue:v${SNAPSHOT_FORMAT}:${version}`;
  return {
    /** The current marker, created on first use; null when KV is missing or failing (the caller then just computes). */
    async version() {
      const kv = getKv(); if (!kv) return null;
      try {
        const found = await kv.get(SNAPSHOT_VERSION_KEY);
        if (typeof found === 'string' && found) return found;
        // Written before the catalogue is read, so a purge that lands during the build leaves our snapshot orphaned, not stale.
        const created = crypto.randomUUID();
        await kv.put(SNAPSHOT_VERSION_KEY, created, { expirationTtl: VERSION_TTL_SECONDS });
        return created;
      } catch { return null; }
    },
    async get(version) {
      const kv = getKv(); if (!kv) return null;
      try { return await kv.get(name(version), 'json'); } catch { return null; }
    },
    async put(version, value) {
      const kv = getKv(); if (!kv) return;
      try { await kv.put(name(version), JSON.stringify(value), { expirationTtl: SNAPSHOT_TTL_SECONDS }); } catch { /* the next request recomputes */ }
    },
  };
}

/** Makes every stored snapshot unreachable. Throws when it cannot, so the caller does not purge pages that would be rebuilt from stale data. */
export async function bumpNativeSnapshotVersion(kv) {
  if (!kv) throw new Error('Cannot bump the catalogue version: no KV binding');
  await kv.put(SNAPSHOT_VERSION_KEY, crypto.randomUUID(), { expirationTtl: VERSION_TTL_SECONDS });
}
