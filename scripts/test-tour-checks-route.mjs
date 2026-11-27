import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDraft } from '../cms/src/plugins/tour-editor/checks-route.mjs';

const compat = { locales: { zh: { tours: {}, terms: {} }, en: { tours: {}, terms: {} } } };
const draft = (data, extra = {}) => ({ id: 'entry-1', locale: 'zh', slug: 'demo', publishedAt: null, data: { title: '示範團', ...data }, ...extra });

test('an unsaved, never published draft can be checked', () => {
  const result = checkDraft(draft({ price: '500' }, { slug: null }), compat, '2026-11-26');
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks.map(check => check.code), ['no-departures', 'no-cancel']);
});

test('wrong or unreadable input is answered, not thrown', () => {
  for (const input of [undefined, {}, draft({}, { locale: 'fr' }), draft({}, { data: [] }), draft({ title: '' }), draft({ source_key: 'wp-zh-999999' })]) {
    assert.deepEqual(checkDraft(input, compat, '2026-11-26'), { ok: false, checks: [] }, JSON.stringify(input));
  }
});

test('the draft passed in is not changed', () => {
  const input = draft({ price: '500', gallery: [] });
  const copy = structuredClone(input);
  checkDraft(input, compat, '2026-11-26');
  assert.deepEqual(input, copy);
});
