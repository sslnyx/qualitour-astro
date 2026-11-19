import assert from 'node:assert/strict';
import test from 'node:test';
import { LEGACY_PAGE_REDIRECTS, LEGACY_ZH_PAGE_REDIRECTS, legacyRedirectRules } from './lib/legacy-redirects.mjs';
import { nativeSiteRoute } from '../cms/src/lib/cms/native-site-policy.mjs';

test('every legacy target is a page route the site publishes, and no source already is one', () => {
  for (const [from, to] of [...LEGACY_PAGE_REDIRECTS, ...LEGACY_ZH_PAGE_REDIRECTS]) {
    assert.ok(nativeSiteRoute(to), `${from} -> ${to} must be a published route`);
    assert.equal(nativeSiteRoute(from), null, `${from} is already a live page`);
  }
});

test('rules are permanent, specific pages come before the generic rules, and counts stay inside the platform limits', () => {
  const lines = legacyRedirectRules().trim().split('\n');
  assert.ok(lines.every(line => /^\/\S* \/\S* 301$/.test(line)), 'one source, one target, 301');
  assert.ok(lines.indexOf('/tour/:slug /tours/:slug 301') < lines.indexOf('/*/ /:splat 301'));
  assert.ok(lines.indexOf('/zh/tour/:slug /zh/tours/:slug 301') < lines.indexOf('/*/ /:splat 301'));
  assert.ok(lines.indexOf('/yellowknife/ /tours/destination/geo-yellowknife 301') < lines.indexOf('/tour/:slug/ /tours/:slug 301'));
  assert.ok(lines.filter(line => /[:*]/.test(line.split(' ')[0])).length <= 100, 'at most 100 dynamic rules');
  assert.ok(lines.length <= 2000);
});
