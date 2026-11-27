// What staff are told when the site leaves a tour out, and the list of which CMS entry owns each imported tour.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reportHiddenTours, tourIdentityNotice, tourOwners } from '../src/lib/cms/tour-identity.mjs';
import { checkDraft } from '../cms/src/plugins/tour-editor/checks-route.mjs';

const compat = JSON.parse(readFileSync(new URL('../src/data/cms-legacy-compat.json', import.meta.url), 'utf8'));
const OWNER = '01M75ZNPEHVC6NF9M7C8HW092V';
const COPY = '01M9ZZZZZZZZZZZZZZZZZZZZZ1';

test('every imported tour has exactly one owning CMS entry', () => {
  const keys = Object.values(compat.locales).flatMap(locale => Object.keys(locale.tours));
  assert.deepEqual(Object.keys(tourOwners).sort(), keys.sort());
  assert.equal(new Set(Object.values(tourOwners)).size, keys.length);
  assert.ok(Object.values(tourOwners).every(id => /^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)));
  assert.equal(tourOwners['wp-zh-6712'], OWNER);
});

test('the editor says why a copy or an unknown identity is not on the site, and says nothing otherwise', () => {
  const copy = tourIdentityNotice(COPY, { source_key: 'wp-zh-6712', source_status: 'publish' });
  assert.equal(copy.code, 'copy');
  assert.equal(copy.ownerId, OWNER);
  assert.match(copy.title, /複製.*網站不會顯示/);
  assert.match(copy.message, /wp-zh-6712/);
  assert.match(copy.action, /新增行程/);
  assert.equal(tourIdentityNotice(COPY, { source_key: 'wp-zh-999999' }).code, 'unknown-source-key');
  assert.equal(tourIdentityNotice(COPY, { source_key: '', source_status: 'publish' }).code, 'missing-source-key');
  for (const data of [{ source_key: 'wp-zh-6712', source_status: 'publish' }]) assert.equal(tourIdentityNotice(OWNER, data), null);
  for (const data of [{}, { source_key: null, source_status: null }, { source_key: 'wp-zh-999999', source_status: 'draft' }]) assert.equal(tourIdentityNotice(COPY, data), null);
});

test('a build reports each tour it leaves out', () => {
  const lines = [];
  reportHiddenTours('zh', [{ entryId: COPY, code: 'copy', sourceKey: 'wp-zh-6712', ownerId: OWNER }], line => lines.push(line));
  assert.equal(lines.length, 1);
  for (const part of ['zh', COPY, 'copy', 'wp-zh-6712', OWNER]) assert.ok(lines[0].includes(part), part);
});

const draft = (data, extra = {}) => ({ id: COPY, locale: 'zh', slug: 'copy', publishedAt: null, data: { title: '示範團', ...data }, ...extra });

test('the content check never calls a hidden copy problem-free', () => {
  assert.deepEqual(checkDraft(draft({ source_key: 'wp-zh-6712', source_status: 'publish' }), compat, '2026-11-27'), { ok: false, checks: [] });
});

test('the content check warns a new tour that uses an old imported address', () => {
  const slug = compat.locales.zh.tours['wp-zh-6712'].tour.slug;
  const clash = checkDraft(draft({ price: '500' }, { slug }), compat, '2026-11-27');
  assert.equal(clash.ok, true);
  assert.equal(clash.checks[0].code, 'address-of-imported-tour');
  const free = checkDraft(draft({ price: '500' }, { slug: 'a-new-address' }), compat, '2026-11-27');
  assert.ok(!free.checks.some(check => check.code === 'address-of-imported-tour'));
});
