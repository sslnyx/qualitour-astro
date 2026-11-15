import assert from 'node:assert/strict';
import test from 'node:test';
import { backupCandidates, mirrorFilename, remoteImagePattern } from './lib/remote-images.mjs';

const find = text => [...text.matchAll(remoteImagePattern)].map(match => match[0]);

test('finds old-site and partner images in attributes, JSON and HTML-escaped props', () => {
  const html = '<img src="https://qualitour.ca/wp-content/uploads/2021/02/Whitehorse-3.jpg" alt="">' +
    '{&quot;url&quot;:[0,&quot;https://wetu.com/ImageHandler/c380x246/1/a_b.JPG&quot;],&quot;n&quot;:[0,1]}' +
    '<source srcset="https://www.vikingcruisescanada.com/images/x_tcm43-1.jpg 1x">';
  assert.deepEqual(find(html), [
    'https://qualitour.ca/wp-content/uploads/2021/02/Whitehorse-3.jpg',
    'https://wetu.com/ImageHandler/c380x246/1/a_b.JPG',
    'https://www.vikingcruisescanada.com/images/x_tcm43-1.jpg',
  ]);
});

test('does not swallow neighbouring text or match other hosts and non-images', () => {
  assert.deepEqual(find('https://example.com/a.jpg https://qualitour.ca/tours/x https://qualitour.ca/wp-content/uploads/a.pdf'), []);
  assert.deepEqual(find('"https://qualitour.ca/zh/wp-content/uploads/2022/04/a%20b.jpg","next.png"'), ['https://qualitour.ca/zh/wp-content/uploads/2022/04/a%20b.jpg']);
  assert.deepEqual(find('https://qualitour.ca/wp-content/uploads/a.jpg.webp'), ['https://qualitour.ca/wp-content/uploads/a.jpg.webp']);
});

test('backup lookup tries the file, then the original WordPress resized it from', () => {
  assert.deepEqual(backupCandidates('https://qualitour.ca/wp-content/uploads/2025/04/CSB-Cover-1-150x150.jpg'),
    ['/wp-content/uploads/2025/04/CSB-Cover-1-150x150.jpg', '/wp-content/uploads/2025/04/CSB-Cover-1.jpg']);
  assert.deepEqual(backupCandidates('https://qualitour.ca/wp-content/uploads/a-scaled.jpg'), ['/wp-content/uploads/a-scaled.jpg', '/wp-content/uploads/a.jpg']);
  assert.deepEqual(backupCandidates('https://qualitour.ca/zh/wp-content/uploads/2026/10/Poster-%E5%A4%8F-723x1024.avif'),
    ['/zh/wp-content/uploads/2026/10/Poster-夏-723x1024.avif', '/zh/wp-content/uploads/2026/10/Poster-夏.avif']);
});

test('mirror filenames are ASCII and unique per address', () => {
  const name = mirrorFilename('https://qualitour.ca/zh/wp-content/uploads/2026/10/Poster-%E5%A4%8F.avif', 'abcdef0123456789');
  assert.match(name, /^qualitour-[A-Za-z0-9-]*abcdef01\.webp$/);
  assert.equal(mirrorFilename('https://wetu.com/ImageHandler/c1/9/x y.jpg', 'ffffffffffff').startsWith('wetu-x-y-'), true);
});
