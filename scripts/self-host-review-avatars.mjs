#!/usr/bin/env node
// Self-host Google review avatars so visitors never wait on lh3.googleusercontent.com.
//
// Reads cms/src/data/native-site-support.json, downloads every remote reviewer photo once, shrinks it to a
// 96x96 webp (displayed at 40-56 CSS px, so this covers 1.7x density) into public/reviews/avatars/<id>.webp,
// and rewrites `profile_photo_url` to the site-relative path /reviews/avatars/<id>.webp.
//
// Re-runnable: reviews that already point at /reviews/avatars/ are skipped, and a new review's lh3 URL is
// fetched on the next run. Pass --refresh to re-download everything that still has a remote URL recorded
// in the `profile_photo_source` field. Usage: node scripts/self-host-review-avatars.mjs [--dry-run]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = join(root, 'cms/src/data/native-site-support.json');
const outDir = join(root, 'public/reviews/avatars');
const prefix = '/reviews/avatars/';
const dryRun = process.argv.includes('--dry-run');
const refresh = process.argv.includes('--refresh');

const raw = await readFile(dataPath, 'utf8');
const data = JSON.parse(raw);
await mkdir(outDir, { recursive: true });

let done = 0, skipped = 0, failed = 0;
for (const review of data.reviews ?? []) {
  const current = review.profile_photo_url;
  const source = review.profile_photo_source || (current && !current.startsWith(prefix) ? current : '');
  if (!current) { skipped++; continue; }
  const file = join(outDir, `${review.id}.webp`);
  if (current.startsWith(prefix) && existsSync(file) && !refresh) { skipped++; continue; }
  if (!source || !/^https:\/\/lh3\.googleusercontent\.com\//.test(source)) { skipped++; continue; }
  try {
    // Ask Google for a 96px crop directly so the download is small; fall back to the recorded size.
    const sized = source.replace(/=s\d+[^/]*$/, '=s96-c');
    const res = await fetch(sized, { headers: { 'user-agent': 'qualitour-avatar-self-host/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const input = Buffer.from(await res.arrayBuffer());
    const webp = await sharp(input).resize(96, 96, { fit: 'cover' }).webp({ quality: 80 }).toBuffer();
    if (!dryRun) await writeFile(file, webp);
    review.profile_photo_source = source;
    review.profile_photo_url = `${prefix}${review.id}.webp`;
    done++;
    console.log(`ok   ${review.id} ${webp.length}B`);
  } catch (error) {
    failed++;
    console.log(`FAIL ${review.id} ${String(error).slice(0, 80)}`);
  }
}
if (!dryRun && done) await writeFile(dataPath, JSON.stringify(data) + '\n');
console.log(JSON.stringify({ downloaded: done, skipped, failed, dryRun }));
process.exit(failed ? 1 : 0);
