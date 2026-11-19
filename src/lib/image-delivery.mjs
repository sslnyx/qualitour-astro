/** Retry transient source metadata reads without ever serving an unoptimized fallback. */
export async function inferImageDimensions(infer, { wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await infer(); }
    catch (error) { if (attempt === 2) throw error; await wait(200 * (attempt + 1)); }
  }
}

export async function mapWithConcurrency(input, work, concurrency = 4) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('Invalid image concurrency');
  const result = new Array(input.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, input.length) }, async () => {
    while (next < input.length) {
      const index = next++;
      result[index] = await work(input[index]);
    }
  }));
  return result;
}

export function applyImageFallback(image, source) {
  if (image.dataset.imageFallback === 'true') return;
  image.dataset.imageFallback = 'true';
  image.removeAttribute('srcset');
  image.removeAttribute('sizes');
  image.src = source;
}

/**
 * Public gallery source extraction, shared by build-time derivatives and the client.
 * `tour.photoSources` is the already de-duplicated list the server prepared (see dedupePhotoSources); when present it
 * is the gallery, so the client never shows a photo the server dropped.
 * @param {any} tour
 * @returns {string[]}
 */
export function collectTourPhotoSources(tour) {
  if (Array.isArray(tour?.photoSources)) return tour.photoSources;
  const result = [];
  const add = value => {
    const url = typeof value === 'string' ? value : value?.url || value?.thumbnail;
    if (typeof url === 'string' && /^(https?:\/\/|\/(?!\/))/.test(url)) result.push(url);
  };
  const featured = tour.featured_image_url;
  add(typeof featured === 'string' ? featured : featured?.full || featured?.large || featured?.medium);
  const data = tour.goodlayers_data;
  for (const section of data?.sections || []) {
    for (const item of section.items || []) {
      if (item.type === 'gallery') for (const photo of item.value?.gallery || []) add(photo);
      if (item.type === 'image') add(item.value?.url);
    }
  }
  for (const key of ['tourmaster-tour-gallery', 'tour_gallery']) {
    if (Array.isArray(data?.[key])) for (const photo of data[key]) add(photo);
  }
  return [...new Set(result)];
}

/** Build-time image delivery policy. Unchanged source URLs are never evidence of resizing. */
export function createImageDelivery({ optimize, transform, infer }) {
  const images = new Map();
  const dimensions = new Map();
  const responsiveImages = new Map();
  function cached(map, key, work) {
    if (!map.has(key)) {
      const pending = Promise.resolve().then(work).catch(error => { map.delete(key); throw error; });
      map.set(key, pending);
    }
    return map.get(key);
  }
  const size = src => cached(dimensions, src, async () => {
    const value = await infer(src);
    if (!(value.width > 0 && value.height > 0)) throw new Error('Invalid source image dimensions');
    return value;
  });
  function image(input) {
    return cached(images, JSON.stringify(input), async () => {
      const options = { ...input, ...(input.widths ? { widths: [...input.widths] } : {}) };
      const source = typeof options.src === 'string' ? options.src : options.src.src;
      if (/^\/(?:[^/?#]+\/)*_astro\//.test(source) || source.startsWith('/_image?')) {
        return { src: source, attributes: { width: options.width, height: options.height }, srcSet: { attribute: '' } };
      }
      const transformed = transform(source, options);
      if (transformed !== source) {
        const values = (options.widths || []).map(width => ({
          url: transform(source, { ...options, width,
            height: options.height && options.width ? Math.round(width * options.height / options.width) : undefined }),
          descriptor: `${width}w`,
        }));
        return { src: transformed, attributes: { width: options.width, height: options.height },
          srcSet: { values, attribute: values.map(value => `${value.url} ${value.descriptor}`).join(', ') } };
      }
      if (options.inferSize && (!options.width || !options.height)) {
        const actual = await size(source);
        if (options.width) options.height = Math.round(options.width * actual.height / actual.width);
        else if (options.height) options.width = Math.round(options.height * actual.width / actual.height);
        else Object.assign(options, { width: actual.width, height: actual.height });
        delete options.inferSize;
      }
      return optimize(options);
    });
  }
  function responsive(source, { widths = [480, 960, 1280, 1920], width = 1280,
    sizes = '100vw', quality = 80 } = {}) {
    return cached(responsiveImages, JSON.stringify([source, widths, width, sizes, quality]), async () => {
      const actual = await size(source);
      const requested = [...new Set(widths.map(value => Math.min(value, actual.width)))].sort((a,b) => a-b);
      const targetWidth = Math.min(width, actual.width);
      const targetHeight = Math.round(targetWidth * actual.height / actual.width);
      const result = await image({ src: source, width: targetWidth, height: targetHeight,
        widths: requested, format: 'webp', quality });
      return { src: result.src, srcSet: result.srcSet?.attribute || '', sizes,
        width: targetWidth, height: targetHeight };
    });
  }
  return { image, responsive };
}

/** Number of differing bits between two 64-bit hashes given as 16-digit hex strings. */
export function hashDistance(a, b) {
  let x = BigInt('0x' + a) ^ BigInt('0x' + b), bits = 0;
  while (x) { bits += Number(x & 1n); x >>= 1n; }
  return bits;
}

/** A hash is only trusted for matching when the picture has enough structure; flat images all hash alike. */
const informative = hash => { const bits = hashDistance(hash, '0000000000000000'); return bits >= 8 && bits <= 56; };

/**
 * The same picture is often stored in the media library several times (cover, inline figure, gallery), so the URLs
 * differ although the photo is identical. `fingerprints` maps a photo URL to { hash, width, height } (an image
 * difference hash made at release time, scripts/fingerprint-photos.mjs). A photo whose fingerprint matches an earlier
 * one (nearly equal hash and the same proportions) is dropped; the first occurrence, in gallery order, stays.
 * Photos without a fingerprint, or with a flat, uninformative one, are always kept.
 */
export function dedupePhotoSources(sources, fingerprints = {}, { maxDistance = 5, key = value => value } = {}) {
  const kept = [];
  const keptPrints = [];
  for (const source of sources) {
    const print = fingerprints[key(source)];
    if (print && informative(print.hash)) {
      const ratio = print.width / print.height;
      const duplicate = keptPrints.some(other => hashDistance(other.hash, print.hash) <= maxDistance
        && Math.abs(other.width / other.height - ratio) / ratio < 0.03);
      if (duplicate) continue;
      keptPrints.push(print);
    }
    kept.push(source);
  }
  return kept;
}
