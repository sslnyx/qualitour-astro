#!/usr/bin/env node
// Copy every image that tour content takes from the old WordPress site (and partner sites) into the CMS media library,
// and record where each copy lives in src/data/remote-image-map.json. The site build then swaps the old addresses for
// the copies, so the public site no longer depends on those hosts (the old site can be switched off).
//
// Source of each image, in order: the local WordPress backup (exact file, then the original WordPress resized it from),
// then the network (throttled; the old site rate-limits). Stored as webp, max 1600 px wide.
// Idempotent and resumable: addresses already in the map are skipped.
// Usage: node scripts/mirror-remote-images.mjs [--dry-run] [--limit=N] [--host=wetu.com]
import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCmsWriter } from './lib/cms-write.mjs';
import { uploadImageBytes } from './lib/media-mirror.mjs';
import { backupCandidates, mirrorFilename, remoteImagePattern } from './lib/remote-images.mjs';

const dryRun = process.argv.includes('--dry-run');
const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '').slice(8)) || Infinity;
const onlyHost = (process.argv.find(a => a.startsWith('--host=')) || '').slice(7);
const BACKUP = '/Users/ning/Local Sites/qualitour/backups/production-tours-2026-11-11';
const MAP_FILE = fileURLToPath(new URL('../src/data/remote-image-map.json', import.meta.url));
const SOURCES = ['../src/data/cms-legacy-compat.json', '../cms/src/data/native-site-support.json'];
const sleep = ms => new Promise(done => setTimeout(done, ms));

const map = await readFile(MAP_FILE, 'utf8').then(JSON.parse, () => ({}));
const urls = new Set();
for (const source of SOURCES) {
  const text = await readFile(new URL(source, import.meta.url), 'utf8');
  for (const match of text.matchAll(remoteImagePattern)) urls.add(match[0]);
}
const todo = [...urls].filter(url => !map[url] && (!onlyHost || new URL(url).hostname.endsWith(onlyHost))).sort().slice(0, limit);

// Backup index: decoded URL path -> file.
const backupFiles = new Map();
for (const [dir] of [['english'], ['chinese']]) {
  const root = await realpath(resolve(BACKUP, dir));
  for (const asset of JSON.parse(await readFile(resolve(root, 'media-manifest.json'), 'utf8')))
    if (asset.ok) { try { backupFiles.set(decodeURIComponent(new URL(asset.source_url).pathname), { file: resolve(root, asset.path), sha256: asset.sha256 }); } catch { /* skip */ } }
}
function fromBackup(url) {
  if (!/^https?:\/\/(?:www\.)?qualitour\.ca\//.test(url)) return null;
  for (const [index, path] of backupCandidates(url).entries()) {
    const hit = backupFiles.get(path);
    if (hit) return { ...hit, kind: index === 0 ? 'backup' : 'backup-original' };
  }
  return null;
}

const plan = todo.map(url => ({ url, local: fromBackup(url) }));
const summary = { distinct: urls.size, alreadyMapped: urls.size - plan.length - 0, todo: plan.length, fromBackup: plan.filter(p => p.local?.kind === 'backup').length, fromBackupOriginal: plan.filter(p => p.local?.kind === 'backup-original').length, network: plan.filter(p => !p.local).length };
console.log(JSON.stringify({ ...summary, dryRun }));
if (dryRun) { for (const p of plan.filter(p => !p.local).slice(0, 8)) console.log('network:', p.url); process.exit(0); }

const cms = await createCmsWriter();
const lastRequest = new Map(); // host -> time of the previous network request
async function download(url) {
  const host = new URL(url).hostname;
  const gap = host.endsWith('qualitour.ca') ? 1200 : 400;
  await sleep(Math.max(0, (lastRequest.get(host) ?? 0) + gap - Date.now()));
  lastRequest.set(host, Date.now());
  const response = await fetch(url, { headers: { 'user-agent': 'qualitour-site-mirror/1.0' }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return Buffer.from(await response.arrayBuffer());
}
async function save() {
  const sorted = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(MAP_FILE + '.tmp', JSON.stringify(sorted, null, 1) + '\n');
  await rename(MAP_FILE + '.tmp', MAP_FILE);
}

const failures = [], via = { backup: 0, 'backup-original': 0, network: 0 };
let done = 0;
async function worker(queue) {
  while (queue.length) {
    const { url, local } = queue.shift();
    try {
      const bytes = local ? await readFile(local.file) : await download(url);
      const name = mirrorFilename(url, createHash('sha1').update(url).digest('hex'));
      map[url] = await uploadImageBytes(cms, bytes, name);
      via[local?.kind ?? 'network']++;
    } catch (error) { failures.push(`${url} ${String(error.message).slice(0, 80)}`); }
    if (++done % 25 === 0) { await save(); console.log(JSON.stringify({ done, of: plan.length, failed: failures.length })); }
  }
}
// Files from the backup upload in parallel; network downloads share one throttled queue per host.
const queue = plan.filter(p => p.local), remote = plan.filter(p => !p.local);
await Promise.all([worker(queue), worker(queue), worker(queue), ...Object.values(Object.groupBy(remote, p => new URL(p.url).hostname)).map(list => worker(list))]);
await save();
console.log(JSON.stringify({ mapped: Object.keys(map).length, via, failed: failures.length }));
if (failures.length) { console.log('failed:\n' + failures.join('\n')); process.exitCode = 1; }
