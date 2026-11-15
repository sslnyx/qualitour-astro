import sharp from 'sharp';

/** Download one Google image, store it as webp (max 1600 px wide) in the CMS media library, return its public path. */
export async function mirrorToMedia(cms, url, filename, { maxWidth = 1600 } = {}) {
  const response = await fetch(url, { headers: { 'user-agent': 'qualitour-reviews-sync/1.0' } });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  return uploadImageBytes(cms, Buffer.from(await response.arrayBuffer()), filename, { maxWidth });
}

/** Re-encode image bytes as webp (max width, EXIF-rotated) and store them in the CMS media library; returns the media path. */
export async function uploadImageBytes(cms, bytes, filename, { maxWidth = 1600 } = {}) {
  const image = sharp(bytes).rotate();
  const { data, info } = await image.resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer({ resolveWithObject: true });
  const form = new FormData();
  form.append('file', new File([data], filename, { type: 'image/webp' }));
  form.append('alt', ''); form.append('width', String(info.width)); form.append('height', String(info.height)); form.append('deduplicate', 'true');
  const created = await cms.request('POST', '/_emdash/api/media', form);
  const key = created?.item?.storageKey;
  if (!key) throw new Error('upload answered without a storage key');
  return `/_emdash/api/media/file/${key}`;
}
