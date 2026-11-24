import { useEffect, useState } from "react";
import type { TransferRoute } from "../lib/zaui/zaui";
import { localizedLocation } from "../lib/transfer-locations";
import type { DirectionalTransferCovers } from "../lib/transfer-covers";

interface Props {
  route: TransferRoute;
  lang: "en" | "zh";
  hrefs: Record<string, string>;
  cover?: DirectionalTransferCovers;
  source?: "home";
}

function directionFromUrl(routeId: string): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const card = new URLSearchParams(window.location.search).get("card");
  if (card === `${routeId}-forward`) return false;
  if (card === `${routeId}-reverse`) return true;
  return undefined;
}

function directionFromHistory(routeId: string): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  const direction = window.history.state?.qualitourTransferCardDirections?.[routeId];
  if (direction === "forward") return false;
  if (direction === "reverse") return true;
  return undefined;
}

function saveDirection(routeId: string, reversed: boolean) {
  const currentState = window.history.state;
  const state = currentState && typeof currentState === "object" ? currentState : {};
  const currentDirections = state.qualitourTransferCardDirections;
  const directions = currentDirections && typeof currentDirections === "object"
    ? currentDirections
    : {};

  window.history.replaceState(
    {
      ...state,
      qualitourTransferCardDirections: {
        ...directions,
        [routeId]: reversed ? "reverse" : "forward",
      },
    },
    "",
    window.location.href,
  );
}

function createBookingHref(
  href: string | undefined,
  routeId: string,
  reversed: boolean,
  source?: "home",
) {
  if (!href) return undefined;
  const url = new URL(href, "https://qualitour.local");
  url.searchParams.set("card", `${routeId}-${reversed ? "reverse" : "forward"}`);
  if (source) url.searchParams.set("source", source);
  else url.searchParams.delete("source");
  return `${url.pathname}${url.search}${url.hash}`;
}

export default function TransferRouteCard({
  route,
  lang,
  hrefs,
  cover,
  source,
}: Props) {
  // Render forward during SSR, then synchronize only this card after hydrate.
  const [isReversed, setIsReversed] = useState(false);
  const photo = isReversed ? cover?.reverse : cover?.forward;
  const from = localizedLocation(route.fromLocation, lang);
  const to = localizedLocation(route.toLocation, lang);
  const formatPrice = (price: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-Hant" : "en-CA", {
      style: "currency",
      currency: route.currency,
      currencyDisplay: "code",
    }).format(price);
  const hasReverseDirection = Boolean(route.reverseActivityIds?.length);
  const t = {
    from: lang === "zh" ? "從" : "From",
    perVehicle: lang === "zh" ? "每車" : "per vehicle",
    book: lang === "zh" ? "預訂" : "Book",
    checkPrice: lang === "zh" ? "查詢價格" : "Check price",
    seater: lang === "zh" ? "座" : "-seater",
    swapDirection: lang === "zh" ? "換方向" : "Switch direction",
  };
  const formatVehiclePrice = (price: string) => {
    const amount = Number(price);
    return Number.isFinite(amount) && amount > 0 ? formatPrice(amount) : t.checkPrice;
  };

  useEffect(() => {
    const syncDirection = () => {
      // A stored browser-history direction beats a stale explicit-link query.
      const direction = directionFromHistory(route.id) ?? directionFromUrl(route.id) ?? false;
      setIsReversed(hasReverseDirection && direction);
    };

    syncDirection();
    window.addEventListener("popstate", syncDirection);
    return () => window.removeEventListener("popstate", syncDirection);
  }, [hasReverseDirection, route.id]);

  const toggleDirection = () => {
    const nextDirection = !isReversed;
    setIsReversed(nextDirection);
    saveDirection(route.id, nextDirection);
  };

  return (
    <article
      id={`transfer-${route.id}`}
      data-transfer-route={route.id}
      className="group relative scroll-mt-32 rounded-2xl border border-gray-200 bg-white p-6 transition-all duration-300 hover:border-[#f7941e]/50 hover:shadow-xl"
    >
      <div className="absolute top-0 right-0 h-20 w-20 rounded-tr-2xl rounded-bl-full bg-gradient-to-bl from-[#f7941e]/10 to-transparent" />
      {photo ? (
        <figure key={photo.src} className="relative -mx-6 -mt-6 mb-5 overflow-hidden rounded-t-[inherit] bg-gray-100">
          <img data-transfer-card-cover src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} loading={isReversed ? "eager" : "lazy"} decoding="async" className="block aspect-video w-full object-cover" />
          {photo.credit && (
            <figcaption className="absolute bottom-0 right-0 max-w-full bg-black/75 px-2 py-1 text-right text-[10px] text-white">
              <a href={photo.credit.href} className="underline underline-offset-2">{photo.credit.name}</a>
              {photo.credit.licenseHref && (
                <>{" · "}<a href={photo.credit.licenseHref} className="underline underline-offset-2">{photo.credit.license}</a>{" · "}{lang === "zh" ? "已裁切" : "cropped"}</>
              )}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#f7941e]/10 to-orange-50">
          <span className="material-icons text-2xl text-[#f7941e]" aria-hidden="true">airport_shuttle</span>
        </div>
      )}

      {hasReverseDirection && (
        <button type="button" onClick={toggleDirection} className="transfer-secondary-action absolute -top-px right-4 z-10 inline-flex min-h-14 -translate-y-1/2 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 px-4 text-lg font-bold leading-tight shadow-md ring-2 ring-white transition-colors sm:right-6 sm:px-5">
          <span className="material-icons text-xl" aria-hidden="true">swap_vert</span>
          <span>{t.swapDirection}</span>
        </button>
      )}

      <div className="mb-4" aria-live="polite">
        <div className="text-lg font-bold leading-relaxed text-gray-900">
          <span className="sr-only">{lang === "zh" ? "上車 " : "Pickup "}</span>{isReversed ? to : from}
        </div>
        <div className="my-1 font-bold text-[#f7941e]" aria-hidden="true"><span className="material-icons text-sm">arrow_downward</span></div>
        <div className="text-lg font-bold text-gray-900">
          <span className="sr-only">{lang === "zh" ? "下車 " : "Drop-off "}</span>{isReversed ? from : to}
        </div>
      </div>

      {[false, true].map(reversed => {
        const vehicles = reversed ? route.reverseActivityIds : route.vehicles;
        if (!vehicles.length) return null;
        const fromLocation = reversed ? to : from;
        const toLocation = reversed ? from : to;
        const prices = vehicles.map(vehicle => Number(vehicle.price)).filter(price => Number.isFinite(price) && price > 0);
        const lowestPrice = Math.min(...prices);
        const firstActivityId = vehicles[0]?.activityId;
        const href = createBookingHref(hrefs[firstActivityId ?? ""], route.id, reversed, source);

        return (
          <div key={String(reversed)} hidden={isReversed !== reversed}>
            <div className="mb-4">
              {Number.isFinite(lowestPrice) ? (
                <>
                  <div className="flex flex-wrap items-baseline gap-1">
                    <span className="text-sm text-gray-500">{t.from}</span>
                    <span data-transfer-reference-price className="text-3xl font-bold text-gray-900">{formatPrice(lowestPrice)}</span>
                    <span className="text-sm text-gray-500">{t.perVehicle}</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    {lang === "zh" ? `參考起價（${route.priceDate}）；Sandbox 會重新核對測試價格及車位。` : `Reference starting price (${route.priceDate}); Sandbox rechecks test price and vehicle availability.`}
                  </p>
                </>
              ) : (
                <div className="text-gray-500">{lang === "zh" ? "請聯絡查價" : "Contact for price"}</div>
              )}
            </div>

            <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-600">
              {vehicles.map(vehicle => (
                <li key={vehicle.activityId} className="flex items-center gap-1.5">
                  <span className="font-semibold text-gray-800">{vehicle.seater}{t.seater}</span>
                  <span>{formatVehiclePrice(vehicle.price)}</span>
                </li>
              ))}
            </ul>

            {href ? (
              <a
                data-transfer-products={vehicles.map(vehicle => `transfer-product-${vehicle.activityId}`).join(" ")}
                data-transfer-product={firstActivityId ? `transfer-product-${firstActivityId}` : undefined}
                href={href}
                aria-label={`${t.book} · ${fromLocation} → ${toLocation}`}
                className="transfer-primary-action inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-bold"
              >
                <span className="material-icons text-lg" aria-hidden="true">airport_shuttle</span>
                {t.book}
              </a>
            ) : (
              <span className="inline-flex min-h-14 w-full items-center justify-center rounded-lg bg-gray-200 px-4 py-3 text-base font-bold text-gray-600" aria-disabled="true">{t.book}</span>
            )}
          </div>
        );
      })}
    </article>
  );
}
