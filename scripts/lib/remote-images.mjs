// Images the old WordPress site and a few partners host, as they appear in tour content. The site build replaces each
// one with a copy in the CMS media library (src/data/remote-image-map.json) so nothing depends on those hosts.
export const REMOTE_HOSTS = ['qualitour.ca', 'wetu.com', 'img.youtube.com', 'i.ytimg.com', 'vikingcruisescanada.com', 'vikingrivercruisescanada.com', 'demo.goodlayers.com'];
const hostPattern = REMOTE_HOSTS.map(host => host.replaceAll('.', '\\.')).join('|');
// An address ends at its image extension; the lookahead keeps `.jpg.webp` or `.jpgx` from ending early, and a
// following `&quot;` (HTML-escaped island props) is not part of the address.
export const remoteImagePattern = new RegExp(`https?:\\/\\/(?:www\\.)?(?:${hostPattern})\\/[^\\s"'<>\\\\)]+?\\.(?:jpe?g|png|gif|webp|avif|bmp)(?![A-Za-z0-9._%~\\/-])`, 'gi');

/** Paths to try in the local WordPress backup, most exact first: the file itself, then the original WordPress resized it from. */
export function backupCandidates(url) {
  let path;
  try { path = decodeURIComponent(new URL(url).pathname); } catch { return []; }
  const out = [path];
  const originalName = value => value.replace(/-scaled(?=\.[A-Za-z0-9]+$)/, '').replace(/-\d+x\d+(?=\.[A-Za-z0-9]+$)/, '');
  const stripped = originalName(path);
  if (stripped !== path) out.push(stripped);
  const withoutScaled = path.replace(/-scaled(?=\.[A-Za-z0-9]+$)/, '');
  if (withoutScaled !== path && !out.includes(withoutScaled)) out.push(withoutScaled);
  return out;
}

/** A readable, ASCII-only media filename that stays unique per address. */
export function mirrorFilename(url, sha1Hex) {
  const host = (new URL(url).hostname.replace(/^www\./, '').split('.')[0] || 'img').replace(/[^a-z0-9]/gi, '');
  const base = decodeURIComponent(new URL(url).pathname.split('/').pop() || '').replace(/\.[A-Za-z0-9]+$/, '')
    .normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  return `${host}-${base ? base + '-' : ''}${sha1Hex.slice(0, 8)}.webp`;
}
