import snapshot from "../data/zaui-transfer-routes.json" with { type: "json" };
import { validateTransferSnapshot, type TransferRoute } from "./zaui/transfer-snapshot.ts";

const locations = {
  "Vancouver Airport (YVR)": "yvr",
  "Greater Vancouver": "greater-vancouver",
  "Greater Vancouver (Zone 1)": "greater-vancouver-zone-1",
  "Greater Vancouver (Zone 2)": "greater-vancouver-zone-2",
  "Greater Vancouver (Zone 3)": "greater-vancouver-zone-3",
  "Canada Place Cruise Terminal": "canada-place",
  "Abbotsford (YXX) Airport": "abbotsford-airport",
  "Vancouver Airport (YVR) / Greater Vancouver": "vancouver-yvr",
  Vancouver: "vancouver",
  Whistler: "whistler",
  "Sun Peaks": "sun-peaks",
  Seattle: "seattle",
} as const;

function locationSlug(name: string) {
  return locations[name as keyof typeof locations] ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const routes = validateTransferSnapshot(snapshot).routes;
const combinedVancouver = "Vancouver Airport (YVR) / Greater Vancouver";
const endpoint = (name: string) => name === "Vancouver / YVR" ? combinedVancouver : name;

function buildProducts() {
  const byActivity = new Map<string, TransferProduct>();
  for (const route of routes) {
    for (const reverse of [false, true]) {
      const from = endpoint(reverse ? route.toLocation : route.fromLocation);
      const to = endpoint(reverse ? route.fromLocation : route.toLocation);
      for (const vehicle of reverse ? route.reverseActivityIds : route.vehicles) {
        if (byActivity.has(vehicle.activityId)) continue;
        // The same Whistler return product serves both YVR and Greater Vancouver.
        const destination = ["20", "55"].includes(vehicle.activityId) ? combinedVancouver : to;
        byActivity.set(vehicle.activityId, {
          ...vehicle, from, to: destination,
          slug: `${locationSlug(from)}-to-${locationSlug(destination)}-${vehicle.seater}-seater`,
          productId: `transfer-product-${vehicle.activityId}`,
        });
      }
    }
  }
  return [...byActivity.values()];
}

export type TransferProduct = (typeof routes)[number]["vehicles"][number] & {
  from: string;
  to: string;
  slug: string;
  productId: string;
};

type TransferCardEntry = {
  key: string;
  routeId: string;
  from: string;
  to: string;
};

export type TransferProductPage = TransferProduct & {
  variants: TransferProduct[];
  cardEntries: TransferCardEntry[];
};

export const transferProducts = buildProducts();

const groupedProducts = new Map<string, TransferProduct[]>();
const retiredProductSlugs = new Map<string, TransferProduct>();
for (const product of transferProducts) {
  const slug = product.slug.replace(/-\d+-seater$/, "");
  const variants = groupedProducts.get(slug) ?? [];
  if (variants.some(variant => variant.seater === product.seater)) {
    throw new Error(`Duplicate transfer vehicle for ${slug}: ${product.seater}`);
  }
  variants.push(product);
  groupedProducts.set(slug, variants);
  retiredProductSlugs.set(product.slug, product);
}

const byActivityId = new Map<string, { product: TransferProduct; page: TransferProductPage }>();
export const transferProductPages = [...groupedProducts].map(([slug, variants]) => {
  variants.sort((a, b) => Number(a.seater) - Number(b.seater));
  const page: TransferProductPage = { ...variants[0], slug, variants, cardEntries: [] };
  for (const product of variants) byActivityId.set(product.activityId, { product, page });
  return page;
});
const bySlug = new Map(transferProductPages.map(page => [page.slug, page]));

for (const route of routes) {
  for (const direction of ["forward", "reverse"] as const) {
    const reversed = direction === "reverse";
    const vehicles = reversed ? route.reverseActivityIds : route.vehicles;
    const first = vehicles[0];
    if (!first) continue;
    const entry = byActivityId.get(first.activityId);
    if (!entry || vehicles.some(vehicle => byActivityId.get(vehicle.activityId)?.page !== entry.page)) {
      throw new Error(`Transfer vehicles for ${route.id} ${direction} need one common detail page`);
    }
    entry.page.cardEntries.push({
      key: `${route.id}-${direction}`,
      routeId: route.id,
      from: reversed ? route.toLocation : route.fromLocation,
      to: reversed ? route.fromLocation : route.toLocation,
    });
  }
}

export const transferProductBySlug = (slug: string) => bySlug.get(slug);

export function transferProductHref(prefix: string, activityId: string, includeVehicle = true) {
  const entry = byActivityId.get(activityId);
  const catalogue = `${prefix}/private-transfers`;
  if (!entry) return catalogue;
  const variant = includeVehicle && entry.page.variants.length > 1 ? `?vehicle=${entry.product.seater}` : "";
  return `${catalogue}/${entry.page.slug}${variant}`;
}

export function legacyTransferProductRedirect(request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const path = new URL(request.url).pathname;
  const match = /^\/(zh\/)?private-transfers\/([a-z0-9-]+?)(?:\/|\.html)?$/.exec(path);
  const product = match && retiredProductSlugs.get(match[2]);
  if (!product) return null;
  const location = transferProductHref(match[1] ? "/zh" : "", product.activityId);
  return new Response(null, { status: 301, headers: { Location: location } });
}

export function transferRouteCardLinks(routes: TransferRoute[], prefix: string) {
  return Object.fromEntries(routes.flatMap(route =>
    [...route.vehicles, ...route.reverseActivityIds].map(vehicle => [vehicle.activityId, transferProductHref(prefix, vehicle.activityId, false)]),
  ));
}

export function legacyBookingRedirect(request: Request) {
  const url = new URL(request.url);
  if (!/^\/(?:zh\/)?book(?:\/|\.html)?$/.test(url.pathname)) return null;
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const prefix = url.pathname.startsWith("/zh/") || url.searchParams.get("lang") === "zh" ? "/zh" : "";
  const activityId = /^transfer-product-(\d+)$/.exec(url.searchParams.get("product") ?? "")?.[1] ?? "";
  return new Response(null, { status: 301, headers: { Location: transferProductHref(prefix, activityId) } });
}
