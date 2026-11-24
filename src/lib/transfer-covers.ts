import photos from "../data/transfer-covers.json" with { type: "json" };
import type { Locale } from "../i18n/config";
import type { TransferRoute } from "./zaui/transfer-snapshot";

interface TransferPhotoCredit {
  name: string;
  href: string;
  license?: string;
  licenseHref?: string;
}

export interface TransferCover {
  src: string;
  width: number;
  height: number;
  alt: string;
  credit?: TransferPhotoCredit;
}

export interface DirectionalTransferCovers {
  forward?: TransferCover;
  reverse?: TransferCover;
}

const directionKey = (from: string, to: string) => `${from}\n${to}`;
const byDirection = new Map(photos.directions.map(photo => [directionKey(photo.from, photo.to), photo]));
const byDestination = new Map(photos.destinations.map(photo => [photo.to, photo]));

export function transferRouteCover(from: string, to: string, lang: Locale): TransferCover | undefined {
  const photo = byDirection.get(directionKey(from, to)) ?? byDestination.get(to);
  if (!photo) return undefined;
  const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  return {
    src: `${base}/transfer-covers/${photo.file}`,
    width: 1080,
    height: 608,
    alt: photo.alt[lang],
    credit: photo.credit,
  };
}

export function transferListingCovers(routes: TransferRoute[], lang: Locale): Record<string, DirectionalTransferCovers> {
  return Object.fromEntries(routes.flatMap(route => {
    const forward = transferRouteCover(route.fromLocation, route.toLocation, lang);
    const reverse = transferRouteCover(route.toLocation, route.fromLocation, lang);
    return forward || reverse ? [[route.id, { forward, reverse }]] : [];
  }));
}
