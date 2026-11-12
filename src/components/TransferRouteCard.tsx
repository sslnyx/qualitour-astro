import { useRef, useState } from "react";
import type { TransferRoute } from "../lib/zaui/zaui";
import NativeBookingDialog from "./booking/NativeBookingDialog";

interface Props {
  route: TransferRoute;
  lang: "en" | "zh";
  localePrefix: string;
  onDetailsClick?: (activityId: string) => void;
}

export default function TransferRouteCard({
  route,
  lang,
  onDetailsClick,
}: Props) {
  const [isReversed, setIsReversed] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<{
    activityId: string;
    seater: string;
  }>();
  const trigger = useRef<HTMLButtonElement>(null);
  const vehicles = isReversed ? route.reverseActivityIds : route.vehicles;
  const fromLocation = isReversed ? route.toLocation : route.fromLocation;
  const toLocation = isReversed ? route.fromLocation : route.toLocation;
  const lowestPrice =
    vehicles?.reduce((minimum, vehicle) => {
      const price = Number(vehicle.price.replace(/[^0-9.]/g, ""));
      return Number.isFinite(price) && price > 0 && price < minimum
        ? price
        : minimum;
    }, Infinity) ?? Infinity;
  const formatPrice = (price: number) =>
    new Intl.NumberFormat(lang === "zh" ? "zh-Hant" : "en-CA", {
      style: "currency",
      currency: route.currency,
      currencyDisplay: "code",
    }).format(price);
  const hasMultipleVehicles = Boolean(vehicles && vehicles.length > 1);
  const hasReverseDirection = Boolean(route.reverseActivityIds?.length);
  const t = {
    from: lang === "zh" ? "從" : "From",
    perVehicle: lang === "zh" ? "每車" : "per vehicle",
    details: lang === "zh" ? "詳情" : "Details",
    seater: lang === "zh" ? "座" : "-seater",
    swapDirection: lang === "zh" ? "切換方向" : "Swap direction",
  };

  return (
    <>
      <article className="group relative bg-white rounded-2xl border border-gray-200 p-6 hover:border-[#f7941e]/50 hover:shadow-xl transition-all duration-300 overflow-hidden">
        <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-[#f7941e]/10 to-transparent rounded-bl-full" />
        {hasReverseDirection && (
          <button
            type="button"
            onClick={() => setIsReversed((value) => !value)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-[#f7941e] hover:text-white rounded-full transition-all duration-300 z-10"
            title={t.swapDirection}
          >
            <span className="material-icons text-lg">swap_vert</span>
          </button>
        )}
        <div className="w-14 h-14 bg-gradient-to-br from-[#f7941e]/10 to-orange-50 rounded-xl flex items-center justify-center mb-4">
          <span className="material-icons text-[#f7941e] text-2xl">
            airport_shuttle
          </span>
        </div>
        <div className="mb-4">
          <div className="font-bold text-gray-900 text-lg leading-relaxed">
            {fromLocation}
          </div>
          <div className="text-[#f7941e] font-bold my-1">
            <span className="material-icons text-sm">arrow_downward</span>
          </div>
          <div className="font-bold text-gray-900 text-lg">{toLocation}</div>
        </div>
        <div className="mb-4">
          {Number.isFinite(lowestPrice) ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-gray-500">{t.from}</span>
                <span className="text-3xl font-bold text-gray-900">
                  {formatPrice(lowestPrice)}
                </span>
                <span className="text-gray-500 text-sm">{t.perVehicle}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {lang === "zh"
                  ? `參考起價（${route.priceDate}）；Sandbox 會重新核對測試價格及車位。`
                  : `Reference starting price (${route.priceDate}); Sandbox rechecks test price and vehicle availability.`}
              </p>
            </>
          ) : (
            <div className="text-gray-500">
              {lang === "zh" ? "請聯絡查價" : "Contact for price"}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDetailsClick?.(vehicles?.[0]?.activityId || "")}
          className="w-full mb-4 px-4 py-2 text-[#f7941e] border border-[#f7941e] rounded-lg hover:bg-[#f7941e] hover:text-white transition-all duration-300 flex items-center justify-center gap-2"
        >
          <span className="material-icons text-lg">info</span>
          {t.details}
        </button>
        <div className="flex flex-wrap gap-2">
          {vehicles?.map((vehicle) => (
            <button
              type="button"
              key={vehicle.activityId}
              onClick={(event) => {
                trigger.current = event.currentTarget;
                setSelectedVehicle(vehicle);
              }}
              className="flex-1 min-w-[100px] px-4 py-2 bg-gradient-to-r from-[#f7941e] to-[#ff6b35] text-white font-semibold rounded-lg hover:shadow-lg transition-all duration-300"
            >
              {vehicle.seater}
              {t.seater}
              {hasMultipleVehicles && (
                <span className="block text-xs opacity-80">
                  {vehicle.price === "Contact for price"
                    ? lang === "zh"
                      ? "查詢價格"
                      : "Check price"
                    : formatPrice(Number(vehicle.price))}
                </span>
              )}
            </button>
          ))}
        </div>
      </article>
      <NativeBookingDialog
        open={Boolean(selectedVehicle)}
        onClose={() => {
          setSelectedVehicle(undefined);
          requestAnimationFrame(() => trigger.current?.focus());
        }}
        lang={lang}
        productId={
          selectedVehicle
            ? `transfer-product-${selectedVehicle.activityId}`
            : undefined
        }
        title={
          selectedVehicle
            ? `${fromLocation} → ${toLocation} · ${selectedVehicle.seater}${t.seater}`
            : undefined
        }
      />
    </>
  );
}
