import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Compatibility changes for the isolated Free build only. Never modify the
// installed dependency: an upstream change requires explicit review here.
const vendorRoot = resolve(dirname(createRequire(import.meta.url).resolve('emdash')), '..');
const inputs = new Map([
  ['enrich-DFlfnd3u.mjs', '5fd93d64ff52e315171f2f0cf2b082a6cdbc8146894cd1aa8797a21656b5b2d6'],
  ['zod-generator--nlM0930.mjs', 'a1876933b52af8545a3ab61a6095469b02e21a9033abab294774ec533026e365'],
].map(([name, fingerprint]) => [resolve(vendorRoot, 'dist', name), fingerprint]));

function replaceOnce(code, before, after) {
  assert.equal(code.split(before).length, 2, 'EmDash vendor compatibility seam changed');
  return code.replace(before, () => after);
}

export function transformFreeCpuModule(code, id) {
  const fingerprint = inputs.get(id.split('?')[0]);
  if (!fingerprint) return null;
  assert.equal(createHash('sha256').update(code).digest('hex'), fingerprint,
    'EmDash vendor fingerprint changed; review Free CPU compatibility changes');
  if (id.includes('/enrich-')) {
    // LQIP is optional. Keep original bytes, header dimensions, known EXIF
    // dimensions, content hashes and upload validation in their existing paths.
    return replaceOnce(code,
      'const placeholder = await generatePlaceholder(override ? override.bytes : bytes, override ? normalizeMime(override.contentType) : normalizedContentType, override ? void 0 : headerDims);',
      'const placeholder = null;');
  }
  let output = replaceOnce(code, 'function generateZodSchema(collection) {', `
const qualitourValidatorCache = new Map();
function qualitourHasMutableDefault(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([name, child]) =>
    (name === 'defaultValue' && child !== null && typeof child === 'object') ||
    qualitourHasMutableDefault(child));
}
function generateZodSchema(collection) {
  // Field definitions are still loaded freshly by the caller. The complete
  // definition is the key, so added fields, nested rules, types and defaults
  // take effect immediately, across isolates as well as within one isolate.
  const key = JSON.stringify([collection.slug, collection.fields]);
  const cacheable = !qualitourHasMutableDefault(collection.fields);
  const cached = cacheable ? qualitourValidatorCache.get(key) : undefined;
  if (cached) return cached;
  collection = { ...collection, fields: JSON.parse(key)[1] };`);
  return replaceOnce(output, 'return z.object(shape);', `
  const schema = z.object(shape);
  if (cacheable) {
    if (qualitourValidatorCache.size >= 32) {
      qualitourValidatorCache.delete(qualitourValidatorCache.keys().next().value);
    }
    qualitourValidatorCache.set(key, schema);
  }
  return schema;`);
}

export function emdashFreeCpuPlugin() {
  const seen = new Set();
  return {
    name: 'qualitour-emdash-free-cpu',
    enforce: 'pre',
    buildStart() {
      const pkg = JSON.parse(readFileSync(resolve(vendorRoot, 'package.json'), 'utf8'));
      assert.equal(pkg.version, '1.4.0', 'Review Free CPU compatibility before upgrading EmDash');
      for (const id of inputs.keys()) transformFreeCpuModule(readFileSync(id, 'utf8'), id);
    },
    transform(code, id) {
      const output = transformFreeCpuModule(code, id);
      if (output !== null) seen.add(id.split('?')[0]);
      return output === null ? null : { code: output, map: null };
    },
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        for (const id of Object.keys(chunk.modules)) {
          if (/\/emdash\/dist\/(?:enrich-|zod-generator-)/.test(id)) {
            assert.ok(seen.has(id.split('?')[0]), 'Untransformed EmDash CPU module reached the bundle');
          }
        }
      }
    },
  };
}
