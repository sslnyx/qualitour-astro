import assert from 'node:assert/strict';
import test from 'node:test';
import { refPattern } from './lib/image-ref-pattern.mjs';
import { findBrokenIslandProps } from './lib/island-props.mjs';

const island = props => `<astro-island uid="x" component-url="/_astro/TourDetail.js" props="${props}" ssr></astro-island>`;
const escaped = value => JSON.stringify(value).replaceAll('"', '&quot;').replaceAll('&', '&amp;').replaceAll('&amp;quot;', '&quot;');

test('an /_image URL inside island props keeps its closing &quot;', () => {
  const html = '{&quot;full&quot;:[0,&quot;/_image?href=https%3A%2F%2Fqualitour.ca%2Fa.jpg&amp;w=1600&amp;f=webp&amp;q=80&quot;],&quot;width&quot;:[0,1250]}';
  const out = html.replace(refPattern, '/img/s-abc-1600.webp');
  assert.equal(out, '{&quot;full&quot;:[0,&quot;/img/s-abc-1600.webp&quot;],&quot;width&quot;:[0,1250]}');
});

test('plain attribute and CSS contexts still match', () => {
  assert.deepEqual('<img src="/_image?href=a&amp;w=600&amp;f=webp&amp;q=80" srcset="/img/12-600.webp 600w">'.match(refPattern), ['/_image?href=a&amp;w=600&amp;f=webp&amp;q=80', '/img/12-600.webp']);
});

test('the island gate flags invalid props and passes valid ones', () => {
  assert.deepEqual(findBrokenIslandProps('/ok', island('{&quot;a&quot;:[0,&quot;x&quot;]}')), []);
  const bad = findBrokenIslandProps('/bad', island('{&quot;a&quot;:[0,&quot;x],&quot;b&quot;:[0,1]}'));
  assert.equal(bad.length, 1);
  assert.match(bad[0], /^\/bad: /);
});
