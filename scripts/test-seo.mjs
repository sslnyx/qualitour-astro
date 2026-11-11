import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  absolutePublicUrl,
  normalizePublicPath,
  plainText,
  serializeJsonLd,
  tourMetadata,
} from '../src/lib/seo.ts';

describe('normalizePublicPath', () => {
  test('root, .html, query and hash', () => {
    assert.equal(normalizePublicPath('/'), '/');
    assert.equal(normalizePublicPath('/index.html'), '/');
    assert.equal(normalizePublicPath('/tours/alps.html?utm=1#top'), '/tours/alps');
    assert.equal(normalizePublicPath('tours/alps/?a=1'), '/tours/alps');
  });

  test('preserves staging base and zh prefix', () => {
    assert.equal(normalizePublicPath('/staging/index.html'), '/staging');
    assert.equal(normalizePublicPath('/staging/zh/tours/x.html'), '/staging/zh/tours/x');
    assert.equal(normalizePublicPath('https://example.com/zh/tours/'), '/zh/tours');
  });

  test('Chinese segments encode consistently and idempotently', () => {
    const encoded = '/zh/%E5%8C%97%E4%BA%AC%E4%B9%8B%E6%97%85';
    assert.equal(normalizePublicPath('/zh/北京之旅'), encoded);
    assert.equal(normalizePublicPath(encoded), encoded);
    assert.equal(normalizePublicPath(normalizePublicPath('/zh/北京之旅')), encoded);
    assert.equal(normalizePublicPath('/tour/100%zz'), '/tour/100%25zz');
  });
});

describe('absolutePublicUrl', () => {
  test('hostile host in path never overrides canonical origin', () => {
    assert.equal(
      absolutePublicUrl('https://www.qualitour.com', 'https://evil.example/zh/x?y=1'),
      'https://www.qualitour.com/zh/x',
    );
    assert.equal(
      absolutePublicUrl('https://www.qualitour.com', '//evil.example/staging/zh/x'),
      'https://www.qualitour.com/staging/zh/x',
    );
    assert.equal(absolutePublicUrl('https://www.qualitour.com/', '/index.html'), 'https://www.qualitour.com/');
  });
});

describe('plainText', () => {
  test('strips scripts/styles/tags and decodes entities', () => {
    assert.equal(
      plainText('<style>.a{}</style><p>Tom &amp; Jerry&nbsp;&#8212; &#x4E2D;&#25991;</p><script>alert("<b>")</script>'),
      'Tom & Jerry — 中文',
    );
    assert.equal(plainText('&lt;tag&gt; &quot;q&quot; &apos;a&apos;'), '<tag> "q" \'a\'');
    assert.equal(plainText('<p>A</p>\n<p>  B\t C </p>'), 'A B C');
    assert.equal(plainText('bad &#xD800; &#99999999;'), 'bad \uFFFD \uFFFD');
  });
});

describe('tourMetadata', () => {
  test('title, excerpt preference, and image object url', () => {
    const meta = tourMetadata({
      title: { rendered: 'Alps &amp; Lakes' },
      excerpt: { rendered: '<p>Short <b>trip</b></p>' },
      content: { rendered: '<p>Long</p>' },
      featured_image_url: { full: { url: 'https://img/full.jpg' }, large: 'https://img/large.jpg' },
    });
    assert.deepEqual(meta, {
      title: 'Alps & Lakes | Qualitour',
      description: 'Alps & Lakes. Short trip',
      image: 'https://img/full.jpg',
    });
  });

  test('falls back to content then title, and image size order', () => {
    const meta = tourMetadata({
      title: { rendered: 'Fallback Tour' },
      excerpt: { rendered: '<script>x()</script>' },
      content: { rendered: '<p>Content text</p>' },
      featured_image_url: { medium_large: 'https://img/ml.jpg', large: 'https://img/l.jpg' },
    });
    assert.equal(meta.description, 'Fallback Tour. Content text');
    assert.equal(meta.image, 'https://img/l.jpg');
    assert.equal(
      tourMetadata({ title: { rendered: 'Only Title' }, excerpt: { rendered: '' } }).description,
      'Only Title',
    );
    assert.equal(
      tourMetadata({ title: { rendered: 'T' }, excerpt: { rendered: 'E' }, featured_image_url: 'https://img/s.jpg' }).image,
      'https://img/s.jpg',
    );
  });

  test('description limited to 160 code points without splitting surrogate pairs', () => {
    const excerpt = `${'a'.repeat(156)}😀extra`;
    const meta = tourMetadata({ title: { rendered: 'T' }, excerpt: { rendered: excerpt } });
    assert.equal([...meta.description].length, 160);
    assert.ok(meta.description.endsWith('😀'));
  });
});

describe('serializeJsonLd', () => {
  test('escapes script-closing markup and line separators, keeps quotes as JSON', () => {
    const out = serializeJsonLd({ name: 'a"b', html: '</script><script>alert(1)</script>', sep: '\u2028\u2029' });
    assert.ok(!out.includes('</script'));
    assert.ok(!out.includes('<'));
    assert.ok(out.includes('\\u003c/script>'));
    assert.ok(out.includes('\\"'));
    assert.ok(!out.includes('&quot;'));
    assert.ok(out.includes('\\u2028\\u2029'));
    assert.deepEqual(JSON.parse(out), { name: 'a"b', html: '</script><script>alert(1)</script>', sep: '\u2028\u2029' });
  });
});

test('metadata can use actual builder overview when the normal WP body is empty', () => {
  const tour = { title: { rendered: 'Tour' }, excerpt: { rendered: '' }, content: { rendered: '' }, goodlayers_data: { sections: [{ items: [{ value: { content: '<p>Real itinerary introduction.</p>' } }] }] } };
  assert.equal(tourMetadata(tour).description, 'Tour. Real itinerary introduction.');
});

test('repeated CMS excerpts remain distinct for different tours and sailing endpoints', () => {
  const a = tourMetadata({ title: { rendered: 'Vancouver City Tour' }, excerpt: { rendered: 'Vancouver / Vancouver' } });
  const b = tourMetadata({ title: { rendered: 'Vancouver Food Tour' }, excerpt: { rendered: 'Vancouver / Vancouver' } });
  assert.notEqual(a.description, b.description);
  const prefix = 'Viking Oceans Cruises - ' + 'Long country list, '.repeat(16);
  const c = tourMetadata({ title: { rendered: prefix + 'From Amsterdam to New York' }, excerpt: { rendered: 'Shared itinerary' } });
  const d = tourMetadata({ title: { rendered: prefix + 'From New York to Amsterdam' }, excerpt: { rendered: 'Shared itinerary' } });
  assert.notEqual(c.description, d.description);
  assert.ok([...c.description].length <= 160);
});
