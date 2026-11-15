// Plan (not apply) the WordPress created/modified dates for the imported non-public tours.
// 1. Export the rows:  CLOUDFLARE_ACCOUNT_ID=<id> wrangler d1 execute qualitour-cms-free-test --remote --json \
//      --command "SELECT id,locale,source_key,source_status,status,created_at,updated_at FROM ec_tours WHERE deleted_at IS NULL AND source_status IN ('draft','pending','private')" > rows.json
// 2. node scripts/plan-wp-dates.mjs rows.json   -> apply.sql, rollback.sql, plan.json in the private backups folder
// 3. wrangler d1 execute qualitour-cms-free-test --remote --yes --file apply.sql ; verify with verifyWpDateRepair.
// Optional 3rd argument: another output folder (keep earlier apply/rollback files). Any tour with source_key wp-* can be planned.
// Posts without a GMT date use the install's fixed offset (en UTC-7, zh UTC-8).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { wordpressDates, planWpDateRepair } from '../cms/scripts/lib/tour-wp-dates.mjs';
const backup = '/Users/ning/Local Sites/qualitour/backups/production-tours-2026-11-11';
const out = process.argv[3] || '/Users/ning/Local Sites/qualitour/backups/wp-dates-2026-11-15';
await mkdir(out, { recursive: true, mode: 0o700 });
const rows = JSON.parse(await readFile(process.argv[2], 'utf8'))[0].results;
// The two WordPress installs keep a fixed UTC offset (en UTC-7, zh UTC-8; 348/366 and 152/173 tour dates agree).
const FIXED = { en: 7, zh: 8 };
const toGmt = (local, hours) => new Date(new Date(local.replace(' ', 'T') + 'Z').getTime() + hours * 3600000).toISOString().slice(0, 19).replace('T', ' ');
const sources = [], fallback = [];
for (const [lang, locale] of [['english', 'en'], ['chinese', 'zh']])
  for (const r of JSON.parse(await readFile(`${backup}/${lang}/data/tours.raw.json`, 'utf8'))) {
    const post = { ...r.post };
    try { wordpressDates(post); } catch {
      post.post_date_gmt = toGmt(post.post_date, FIXED[locale]); post.post_modified_gmt = toGmt(post.post_modified, FIXED[locale]);
      fallback.push(`wp-${locale}-${post.ID}`);
    }
    sources.push({ key: `wp-${locale}-${post.ID}`, locale, post });
  }
const plan = planWpDateRepair(rows, sources);
await writeFile(`${out}/apply.sql`, plan.sql, { mode: 0o600 });
await writeFile(`${out}/rollback.sql`, plan.rollbackSql, { mode: 0o600 });
await writeFile(`${out}/plan.json`, JSON.stringify({ changes: plan.changes, unchanged: plan.unchanged, fallbackFixedOffset: fallback.filter(k => rows.some(r => r.source_key === k)) }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ rows: rows.length, changes: plan.changes.length, unchanged: plan.unchanged.length, fallback: fallback.filter(k => rows.some(r => r.source_key === k)) }));
for (const c of plan.changes.slice(0, 3)) console.log(c.sourceKey, c.beforeCreatedAt, '->', c.createdAt, '|', c.beforeUpdatedAt, '->', c.updatedAt);
