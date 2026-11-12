const obj=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
export function resolveAsset(value: unknown, fetched: unknown, origin: string) {
  const cached=obj(value),asset={...cached,...obj(fetched)};
  const key=asset.storageKey??obj(asset.meta).storageKey??obj(cached.meta).storageKey;
  const derived=typeof key==='string'&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)&&!key.split('/').includes('..')?`/_emdash/api/media/file/${key}`:'';
  const candidate=typeof asset.url==='string'&&asset.url?asset.url:derived;
  let url='';
  try{if(candidate&&!/[\u0000-\u0020\\]/.test(candidate)){const parsed=new URL(candidate,origin);if(['http:','https:'].includes(parsed.protocol))url=parsed.href;}}catch{/* Keep unavailable assets as empty references. */}
  return {url,filename:typeof asset.filename==='string'?asset.filename:'已選擇檔案'};
}
