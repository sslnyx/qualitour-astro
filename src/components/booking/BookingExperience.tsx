import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { bookingApi, ApiError } from "../../lib/booking/api";
import { bookingMessage } from "../../lib/booking/errors";
import { reconcileBookingCustomer } from "../../lib/booking/customer-draft";
import { settleAbortable } from "../../lib/booking/request";
import { pollPendingPayment } from "../../lib/booking/payment-status-poll";
import { quoteInputForProductEntry } from "../../lib/booking/contracts";
import type {
  AvailabilityResult,
  BookingQuote,
  BookingReceipt,
  CustomerInput,
  GuestBooking,
  PublicCatalog,
  QuoteInput,
} from "../../lib/booking/contracts";
import { BookingView } from "./BookingView";
import type { BookingJourney, BookingTripDraft } from "../../lib/booking/types";
import { BookingRecovery, ReceiptView } from "./BookingRecovery";
import "./booking.css";

type Props = {
  lang: "en" | "zh";
  productId?: string;
  variants?: {
    productId: string;
    seater: "11" | "14";
    referencePrice?: string;
    details?: { name: string; description: string; imageSrc?: string };
  }[];
  journey?: BookingJourney & {
    entries: Record<string, Pick<BookingJourney, "title" | "pickup" | "intendedDropoff" | "productEntry">>;
  };
};

function entryJourney(
  journey: Props["journey"],
): BookingJourney | undefined {
  if (!journey) return undefined;
  const { entries, ...context } = journey;
  if (typeof window === "undefined") return context;
  const card = new URLSearchParams(window.location.search).get("card");
  return card && Object.hasOwn(entries, card) ? { ...context, ...entries[card] } : context;
}

function bookingPath(lang: "en" | "zh", suffix: string) {
  return `/book${suffix}?lang=${lang}`;
}

function currentBookingRoute() {
  if (typeof window === "undefined") return {};
  const match = window.location.pathname.match(
    /^\/(?:zh\/)?book\/(manage|return|receipt|claim)\/([a-zA-Z0-9-]{1,128})$/,
  );
  return match ? { view: match[1], id: match[2] } : {};
}

export default function BookingExperience({
  lang: pageLang,
  productId: defaultProductId,
  variants,
  journey,
}: Props) {
  const [selectedProductId, setSelectedProductId] = useState(defaultProductId);
  const [tripDraft, setTripDraft] = useState<BookingTripDraft>({ serviceDate: "", passengers: 0, coupon: "" });
  const [customer, setCustomer] = useState<CustomerInput>({
    name: "",
    email: "",
    phone: "",
    pickupAddress: "",
    dropoffAddress: "",
    flightNumber: "",
    notes: "",
  });
  const productId = selectedProductId ?? defaultProductId;
  const [lang, setLang] = useState<"en" | "zh">(pageLang);
  const [catalog, setCatalog] = useState<PublicCatalog>();
  const [quote, setQuote] = useState<BookingQuote>();
  const [booking, setBooking] = useState<GuestBooking>();
  const [receipt, setReceipt] = useState<BookingReceipt>();
  const [recent, setRecent] = useState<GuestBooking[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(Boolean(productId));
  const [bookingLoading, setBookingLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [checkoutError, setCheckoutError] = useState<unknown>();
  const [catalogError, setCatalogError] = useState<unknown>();
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [recoveryError, setRecoveryError] = useState<unknown>();
  const [locationReady, setLocationReady] = useState(false);
  const [routeState, setRouteState] = useState<{
    view?: string;
    id?: string;
  }>({});
  const reservationKey = useRef(crypto.randomUUID());
  const vehicleSelectorRef = useRef<HTMLFieldSetElement>(null);
  const restoreVehicleFocus = useRef(false);
  const bookingRequest = useRef<{
    id: string;
    controller: AbortController;
    result: Promise<boolean>;
  }>(undefined);
  const receiptRequest = useRef<AbortController>(undefined);
  const needsCatalogue = Boolean(productId || routeState.view === "manage" || routeState.view === "return");
  const productCatalog = useMemo(() => {
    if (!catalog || !productId) return undefined;
    const routes = catalog.routes.filter(route => route.directoryProductId === productId);
    const routeIds = new Set(routes.map(route => route.id));
    return { ...catalog, routes, rates: catalog.rates.filter(rate => routeIds.has(rate.routeId)) };
  }, [catalog, productId]);
  const requestedRoute = productCatalog?.routes[0];
  const rates = productCatalog?.rates.filter(rate => rate.routeId === requestedRoute?.id);
  const singleRate = rates?.length === 1 ? rates[0] : undefined;
  const unavailable = Boolean(productId && productCatalog && !rates?.length);
  const selectedVariant = variants?.find((variant) => variant.productId === productId);
  const vehicleDetails = selectedVariant?.details;
  const journeyContext = useMemo(() => {
    const context = entryJourney(journey);
    return context
      ? {
          ...context,
          seater: selectedVariant?.seater ?? context.seater,
          referencePrice: selectedVariant ? selectedVariant.referencePrice : context.referencePrice,
        }
      : undefined;
  }, [journey, selectedVariant]);

  useEffect(() => {
    if (!variants?.length) return;
    const seats = new URLSearchParams(window.location.search).get("vehicle");
    const requested = variants.find(variant => variant.seater === seats);
    setSelectedProductId(requested?.productId ?? defaultProductId);
  }, [defaultProductId, variants]);

  function selectVehicle(variant: NonNullable<Props["variants"]>[number]) {
    if (busy || variant.productId === productId) return;
    restoreVehicleFocus.current = true;
    setQuote(undefined);
    setError(undefined);
    setSelectedProductId(variant.productId);
    const url = new URL(window.location.href);
    url.searchParams.set("vehicle", variant.seater);
    window.history.replaceState(window.history.state, "", url);
    window.dispatchEvent(new Event("qualitour:transfer-vehicle-change"));
  }

  useEffect(() => {
    if (!restoreVehicleFocus.current) return;
    restoreVehicleFocus.current = false;
    vehicleSelectorRef.current
      ?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [productId]);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const selected = parameters.get("lang");
    const nextLang = !productId && selected === "zh" ? "zh" : pageLang;
    setLang(nextLang);
    if (!productId) setRouteState(currentBookingRoute());
    setLocationReady(true);
    document.documentElement.lang = nextLang === "zh" ? "zh-Hant" : "en";
  }, [pageLang, productId]);

  // A booking a staff member made for the customer opens from a private link, /book/claim/<id>#t=<secret>. The
  // secret is in the fragment so it never reaches a server log; it is sent once to set the booking cookie, then the
  // address is replaced by the ordinary booking page and the secret leaves the browser history.
  const [claimFailed, setClaimFailed] = useState(false);
  useEffect(() => {
    if (routeState.view !== "claim" || !routeState.id) return;
    const token = /^#t=([a-f0-9]{64})$/.exec(window.location.hash)?.[1];
    if (!token) {
      setClaimFailed(true);
      return;
    }
    let active = true;
    bookingApi<{ id: string }>("claim", { orderId: routeState.id, token })
      .then((result) => {
        if (!active) return;
        window.history.replaceState(
          null,
          "",
          bookingPath(lang, `/manage/${encodeURIComponent(result.id)}`),
        );
        setRouteState({ view: "manage", id: result.id });
      })
      .catch(() => {
        if (active) setClaimFailed(true);
      });
    return () => {
      active = false;
    };
  }, [routeState.view, routeState.id, lang]);

  const recover = useCallback(async () => {
    setRecoveryLoading(true);
    setRecoveryError(undefined);
    try {
      const data = await bookingApi<{ bookings: GuestBooking[] }>("bookings");
      setRecent(data.bookings);
    } catch (nextError) {
      setRecoveryError(nextError);
    } finally {
      setRecoveryLoading(false);
    }
  }, []);

  const loadBooking = useCallback(() => {
    const id = routeState.id;
    if (!id) return Promise.resolve(false);
    if (bookingRequest.current?.id === id) return bookingRequest.current.result;
    bookingRequest.current?.controller.abort();
    const controller = new AbortController();
    setBookingLoading(true);
    setError(undefined);
    const result = bookingApi<GuestBooking>(
      `bookings/${encodeURIComponent(id)}`,
      undefined,
      controller.signal,
    ).then((next) => {
      if (controller.signal.aborted) return false;
      setBooking(next);
      return next.status === "pending";
    }).catch((nextError) => {
      if (!controller.signal.aborted) setError(nextError);
      return false;
    }).finally(() => {
      if (bookingRequest.current?.controller === controller) {
        bookingRequest.current = undefined;
        setBookingLoading(false);
      }
    });
    bookingRequest.current = { id, controller, result };
    return result;
  }, [routeState.id]);

  const loadReceipt = useCallback(async () => {
    if (!routeState.id) return;
    receiptRequest.current?.abort();
    const controller = new AbortController();
    receiptRequest.current = controller;
    setBookingLoading(true);
    setError(undefined);
    try {
      const next = await bookingApi<BookingReceipt>(
        `bookings/${encodeURIComponent(routeState.id)}/receipt`,
        undefined,
        controller.signal,
      );
      if (!controller.signal.aborted) setReceipt(next);
    } catch (nextError) {
      if (!controller.signal.aborted) setError(nextError);
    } finally {
      if (receiptRequest.current === controller) {
        receiptRequest.current = undefined;
        setBookingLoading(false);
      }
    }
  }, [routeState.id]);

  useEffect(() => {
    if (!needsCatalogue) return;
    let active = true;
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(undefined);
    settleAbortable(
      bookingApi<PublicCatalog>("catalog", undefined, controller.signal),
      controller.signal,
    )
      .then((nextCatalog) => {
        if (active && nextCatalog) setCatalog(nextCatalog);
      })
      .catch((nextError) => {
        if (active) setCatalogError(nextError);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [needsCatalogue, catalogAttempt]);

  useEffect(() => {
    if (!productId && locationReady && !routeState.id) void recover();
  }, [locationReady, productId, recover, routeState.id]);

  useEffect(() => {
    if (!routeState.id || routeState.view === "claim") return;
    if (routeState.view === "receipt") {
      void loadReceipt();
      return () => {
        receiptRequest.current?.abort();
        receiptRequest.current = undefined;
      };
    }
    void loadBooking();
    return () => {
      const current = bookingRequest.current;
      if (current && current.id === routeState.id) {
        current.controller.abort();
        bookingRequest.current = undefined;
      }
    };
  }, [loadBooking, loadReceipt, routeState.id, routeState.view]);

  const pendingPayment =
    booking?.id === routeState.id &&
    booking?.status === "pending" &&
    routeState.view !== "receipt" &&
    routeState.view !== "claim";
  useEffect(() => {
    if (pendingPayment) return pollPendingPayment(loadBooking);
  }, [pendingPayment, loadBooking]);

  const navigate = (url: string) => {
    window.location.assign(url);
  };

  const localePrefix = lang === "zh" ? "/zh" : "";
  const transfersPath = `${localePrefix}/private-transfers`;

  async function requestQuote(input: QuoteInput) {
    setBusy(true);
    setError(undefined);
    setQuote(undefined);
    try {
      const next = await bookingApi<BookingQuote>("quotes", quoteInputForProductEntry({
        ...input,
        returnTo: "transfers",
      }, journeyContext?.productEntry));
      reservationKey.current = crypto.randomUUID();
      setCustomer((current) => reconcileBookingCustomer(current, next));
      setQuote(next);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function reserve(customer: CustomerInput) {
    if (!quote || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const next = await bookingApi<GuestBooking>("bookings", {
        quoteId: quote.id,
        idempotencyKey: reservationKey.current,
        sandboxAcknowledged: true,
        customer,
      });
      setQuote(undefined);
      navigate(bookingPath(lang, `/manage/${encodeURIComponent(next.id)}`));
    } catch (nextError) {
      setError(nextError);
      if (nextError instanceof ApiError && nextError.status === 409)
        setQuote(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!routeState.id || busy) return;
    setBusy(true);
    setError(undefined);
    setCheckoutError(undefined);
    try {
      const result = await bookingApi<{ url: string }>(
        `bookings/${encodeURIComponent(routeState.id)}/checkout`,
        { lang },
      );
      const destination = new URL(result.url);
      if (
        destination.protocol !== "https:" ||
        destination.hostname !== "checkout.stripe.com"
      )
        throw new Error("Invalid payment destination");
      window.location.assign(destination.href);
    } catch (nextError) {
      setCheckoutError(nextError);
      setBusy(false);
      void loadBooking();
    }
  }

  function refresh() {
    if (!routeState.id) {
      window.location.reload();
      return;
    }
    if (routeState.view === "receipt") {
      void loadReceipt();
      return;
    }
    if (catalogError && !catalogLoading) setCatalogAttempt((attempt) => attempt + 1);
    void loadBooking();
  }

  async function cancel() {
    if (!routeState.id || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const cancelled = await bookingApi<GuestBooking>(
        `bookings/${encodeURIComponent(routeState.id)}/cancel`,
        {},
      );
      bookingRequest.current?.controller.abort();
      setBooking(cancelled);
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  const showReceipt = routeState.view === "receipt";
  const lookupPath = `${localePrefix}/booking-status`;
  const back = showReceipt && routeState.id
    ? {
        href: bookingPath(lang, `/manage/${encodeURIComponent(routeState.id)}`),
        label: lang === "zh" ? "返回本次預訂" : "Back to this booking",
      }
    : routeState.id
      ? { href: lookupPath, label: lang === "zh" ? "返回查找預訂" : "Back to booking lookup" }
      : { href: transfersPath, label: lang === "zh" ? "所有接送線路" : "All transfer routes" };

  const renderStatus = (content: ReactNode) => (
    <div className="qb-customer qb-status-content">
      <a className="qb-status-back qb-no-print" href={back.href}>
        <span aria-hidden="true">←</span>
        {back.label}
      </a>
      {content}
    </div>
  );

  if (routeState.view === "claim")
    return renderStatus(
      <section className="qt-card" role="status">
        <h1 className="qb-status-title">
          {claimFailed
            ? lang === "zh"
              ? "這個連結已失效"
              : "This link is no longer valid"
            : lang === "zh"
              ? "正在開啟您的預訂…"
              : "Opening your booking…"}
        </h1>
        {claimFailed ? (
          <p>
            {lang === "zh"
              ? "請聯絡 Qualitour，我們會為您重新發送專屬連結。"
              : "Please contact Qualitour and we will send you a new link."}
          </p>
        ) : null}
      </section>,
    );

  const vehicleSelector = variants?.length ? (
    <fieldset ref={vehicleSelectorRef} className="qb-full min-w-0" disabled={busy}>
      <legend className="mb-2 text-sm font-semibold text-gray-700">
        {lang === "zh" ? "選擇車型" : "Choose your vehicle"}
      </legend>
      <div className="flex flex-wrap gap-2">
        {variants.map(variant => (
          <button
            key={variant.productId}
            type="button"
            aria-pressed={variant.productId === productId}
            onClick={() => selectVehicle(variant)}
            className="qb-vehicle-option inline-flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-left text-sm font-semibold text-gray-800 hover:border-orange-500 disabled:opacity-60 sm:flex-none sm:px-4"
          >
            <span className="hidden sm:inline-flex" aria-hidden="true">
              <span className="material-icons text-lg">airport_shuttle</span>
            </span>
            <span>
              <span className="block">
                {lang === "zh" ? `最多 ${variant.seater} 位乘客` : `Up to ${variant.seater} passengers`}
              </span>
              {variant.referencePrice && (
                <span className="qb-vehicle-option__price block text-xs font-medium text-gray-500">
                  {lang === "zh"
                    ? `參考價 ${variant.referencePrice}`
                    : `Reference ${variant.referencePrice}`}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>
      {vehicleDetails && (
        <div className="qb-vehicle-details mt-3 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:gap-4">
          {vehicleDetails.imageSrc && (
            <figure className="m-0 w-20 shrink-0 text-center sm:w-28">
              <img
                src={vehicleDetails.imageSrc}
                alt=""
                className="aspect-[3/2] w-full object-contain"
                decoding="async"
              />
              <figcaption className="mt-1 text-xs text-gray-600">
                {lang === "zh" ? "車型示意" : "Sample vehicle"}
              </figcaption>
            </figure>
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-gray-900">{vehicleDetails.name}</div>
            {vehicleDetails.description && (
              <p className="mt-1 text-sm text-gray-600">{vehicleDetails.description}</p>
            )}
          </div>
        </div>
      )}
    </fieldset>
  ) : null;

  if (unavailable)
    return (
      <>
        {vehicleSelector && <div className="mb-4">{vehicleSelector}</div>}
        <section className="qb-customer qt-card qb-unavailable" role="status">
          <h2>
            {lang === "zh"
              ? "此接送暫未開放測試預訂"
              : "This transfer is not open for test booking yet"}
          </h2>
          <p>
            {lang === "zh"
              ? "完整資料已可瀏覽；Sandbox 目前只開放已核對的測試路線。"
              : "Full route details remain available; Sandbox booking is limited to approved test routes."}
          </p>
          <a className="qt-btn" href={transfersPath}>
            {lang === "zh" ? "瀏覽接送線路" : "Browse transfer routes"}
          </a>
        </section>
      </>
    );

  if (routeState.view === "receipt" && receipt)
    return renderStatus(
      <ReceiptView receipt={receipt} lang={lang} onPrint={() => window.print()} />,
    );

  if (!productId && !routeState.id)
    return renderStatus(
      <BookingRecovery
        bookings={recent}
        lang={lang}
        loading={recoveryLoading}
        error={recoveryError ? bookingMessage(recoveryError, lang) : ""}
        onRefresh={recover}
      />,
    );

  const pageError = error ?? (booking ? undefined : catalogError);
  const bookingView = (
    <BookingView
      key={productId}
      showBooking={Boolean(routeState.id)}
      showReceipt={showReceipt}
      lang={lang}
      fixedProduct={Boolean(productId)}
      journey={journeyContext}
      vehicleSelector={vehicleSelector}
      catalog={productId ? productCatalog : catalog}
      quote={quote}
      booking={booking}
      customer={customer}
      setCustomer={setCustomer}
      loading={catalogLoading || (Boolean(routeState.id) && bookingLoading)}
      busy={busy}
      error={pageError ? bookingMessage(pageError, lang) : ""}
      focusError={Boolean(error && !routeState.id)}
      checkoutError={checkoutError ? bookingMessage(checkoutError, lang) : ""}
      paymentSetupFailed={Boolean(catalogError)}
      initialRouteId={requestedRoute?.id}
      initialRateId={singleRate?.id}
      tripDraft={variants?.length ? tripDraft : undefined}
      onTripDraftChange={variants?.length
        ? (patch) => setTripDraft((current) => ({ ...current, ...patch }))
        : undefined}
      onAvailability={(input, signal) =>
        bookingApi<AvailabilityResult>("availability", input, signal)
      }
      onQuote={requestQuote}
      onReserve={reserve}
      onCheckout={checkout}
      onCancel={cancel}
      onRefresh={refresh}
      transfersPath={transfersPath}
      onReceipt={() =>
        navigate(
          bookingPath(lang, `/receipt/${encodeURIComponent(routeState.id!)}`),
        )
      }
    />
  );

  return productId
    ? <div className="qb-customer qb-compact">{bookingView}</div>
    : renderStatus(bookingView);
}
