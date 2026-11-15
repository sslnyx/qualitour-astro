// Every Astro island hydrates from a JSON `props` attribute; invalid JSON means the component never starts (tabs,
// galleries and forms silently stop working), so a page with such an island must never be released.
const decode = value => value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

/** Returns one message per island whose props are not valid JSON. */
export function findBrokenIslandProps(path, html) {
  const problems = [];
  for (const match of html.matchAll(/<astro-island\b[^>]*?\sprops="([^"]*)"/g)) {
    try { JSON.parse(decode(match[1])); }
    catch (error) { problems.push(`${path}: ${String(error.message).slice(0, 90)}`); }
  }
  return problems;
}
