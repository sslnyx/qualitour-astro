import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTransferWebsiteDetails } from '../src/lib/booking/transfer-website-details.ts';

const snapshot = {
  activityName: 'Whistler to Vancouver Airport',
  description: 'Book securely. What&#39;s included',
  imageUrl: 'https://example.com/legacy.png',
};
const edited = {
  titleEn: 'Private ride to YVR', titleZh: '前往溫哥華機場',
  descriptionEn: 'Meet at the lobby.', descriptionZh: '請在大堂集合。',
  imageUrl: 'https://example.com/van.webp',
  includesEn: ['One suitcase'], includesZh: [],
};

test('uses the saved localized details and allows an explicitly empty list', () => {
  assert.deepEqual(resolveTransferWebsiteDetails(snapshot, edited, 'zh'), {
    activityName: '前往溫哥華機場', description: '請在大堂集合。',
    imageUrl: 'https://example.com/van.webp', includes: [],
  });
  assert.deepEqual(resolveTransferWebsiteDetails(snapshot, edited, 'en'), {
    activityName: 'Private ride to YVR', description: 'Meet at the lobby.',
    imageUrl: 'https://example.com/van.webp', includes: ['One suitcase'],
  });
});

test('preserves the original details for unedited variants and ignores an unsafe image URL', () => {
  const defaults = resolveTransferWebsiteDetails(snapshot, null, 'zh');
  assert.equal(defaults.activityName, snapshot.activityName);
  assert.equal(defaults.description, "Book securely. What's included");
  assert.equal(defaults.imageUrl, snapshot.imageUrl);
  assert.deepEqual(defaults.includes, ['專業司機', '門到門服務', '航班追蹤', '行李空間', '含稅費']);
  const fallback = resolveTransferWebsiteDetails(snapshot, { ...edited, titleZh: '', includesZh: null, imageUrl: 'javascript:alert(1)' }, 'zh');
  assert.equal(fallback.activityName, edited.titleEn);
  assert.equal(fallback.imageUrl, defaults.imageUrl);
  assert.deepEqual(fallback.includes, defaults.includes);
});
