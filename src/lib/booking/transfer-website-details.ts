import type { TransferVehicle } from '../zaui/transfer-snapshot';

const defaultIncludes = {
  zh: ['專業司機', '門到門服務', '航班追蹤', '行李空間', '含稅費'],
  en: ['Professional driver', 'Door-to-door service', 'Flight tracking', 'Luggage space', 'All taxes included'],
};

function httpsImage(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? value : '';
  } catch {
    return '';
  }
}

export function resolveTransferWebsiteDetails(
  snapshot: TransferVehicle['details'],
  override: unknown,
  lang: 'en' | 'zh',
) {
  const fields = override && typeof override === 'object' ? override as Record<string, unknown> : {};
  const text = (key: string) => typeof fields[key] === 'string' ? fields[key] : '';
  const localized = (key: 'title' | 'description') => (lang === 'zh' && text(`${key}Zh`)) || text(`${key}En`);
  const includes = fields[lang === 'zh' ? 'includesZh' : 'includesEn'];
  return {
    activityName: localized('title') || snapshot.activityName,
    description: localized('description') || snapshot.description.replace(/&#39;/g, "'"),
    imageUrl: httpsImage(fields.imageUrl) || snapshot.imageUrl,
    includes: Array.isArray(includes) && includes.every((item): item is string => typeof item === 'string')
      ? includes
      : defaultIncludes[lang],
  };
}
