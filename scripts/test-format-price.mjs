import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPrice } from '../src/lib/utils.ts';

test('adds thousands separators to bare numbers', () => {
  assert.equal(formatPrice('122999'), '122,999');
  assert.equal(formatPrice(115499), '115,499');
  assert.equal(formatPrice('3899'), '3,899');
  assert.equal(formatPrice('1234567.50'), '1,234,567.50');
});

test('leaves short, formatted and non-numeric values alone', () => {
  assert.equal(formatPrice('145'), '145');
  assert.equal(formatPrice('1,299'), '1,299');
  assert.equal(formatPrice('1200-1500'), '1200-1500');
  assert.equal(formatPrice('歡迎查詢'), '歡迎查詢');
  assert.equal(formatPrice(undefined), '');
  assert.equal(formatPrice(null), '');
});
