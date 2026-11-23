import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bookingApi, ApiError } from "../../lib/booking/api";
import { bookingMessage } from "../../lib/booking/errors";
import { settleAbortable } from "../../lib/booking/request";
import { pollPendingPayment } from "../../lib/booking/payment-status-poll";
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
import { ReceiptView } from "./BookingRecovery";
import "./booking.css";

type Props = {
  lang: "en" | "zh";
  productId?: string;
  compact?: boolean;
};

function bookingPath(lang: "en" | "zh", suffix = "") {
  if (suffix) return `/book${suffix}?lang=${lang}`;
  return lang === "zh" ? "/zh/book" : "/book";
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
  productId,
  compact = false,
}: Props) {
  const [lang, setLang] = useState<"en" | "zh">(pageLang);
  const [catalog, setCatalog] = useState<PublicCatalog>();
  const [quote, setQuote] = useState<BookingQuote>();
  const [booking, setBooking] = useState<GuestBooking>();
  const [receipt, setReceipt] = useState<BookingReceipt>();
  const [recent, setRecent] = useState<GuestBooking[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [recoveryError, setRecoveryError] = useState<unknown>();
  const [queryProductId, setQueryProductId] = useState<string>();
  const [locationReady, setLocationReady] = useState(false);
  const [routeState, setRouteState] = useState<{
    view?: string;
    id?: string;
  }>({});
  const reservationKey = useRef(crypto.randomUUID());
  const bookingRequest = useRef<{
    id: string;
    controller: AbortController;
    result: Promise<boolean>;
  }>(undefined);
  const requestedProductId = productId ?? queryProductId;
  const selectedProductId =
    requestedProductId &&
    /^transfer-product-[a-zA-Z0-9-]{1,96}$/.test(requestedProductId)
      ? requestedProductId
      : undefined;

  const requestedRoute = useMemo(
    () =>
      selectedProductId
        ? catalog?.routes.find(
            (route) => route.directoryProductId === selectedProductId,
          )
        : undefined,
    [catalog, selectedProductId],
  );
  const requestedRate = useMemo(
    () =>
      requestedRoute
        ? catalog?.rates.find((rate) => rate.routeId === requestedRoute.id)
        : undefined,
    [catalog, requestedRoute],
  );
  const unavailable = Boolean(requestedProductId && catalog && !requestedRoute);

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.search);
    const selected = parameters.get("lang");
    const nextLang = selected === "zh" ? "zh" : pageLang;
    setLang(nextLang);
    setQueryProductId(parameters.get("product") ?? undefined);
    setRouteState(currentBookingRoute());
    setLocationReady(true);
    document.documentElement.lang = nextLang === "zh" ? "zh-Hant" : "en";
  }, [pageLang]);

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

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setCatalogLoading(true);
    settleAbortable(
      bookingApi<PublicCatalog>("catalog", undefined, controller.signal),
      controller.signal,
    )
      .then((nextCatalog) => {
        if (active && nextCatalog) setCatalog(nextCatalog);
      })
      .catch((nextError) => {
        if (active) setError(nextError);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (locationReady && !routeState.id) void recover();
  }, [locationReady, recover, routeState.id]);

  useEffect(() => {
    if (!routeState.id || routeState.view === "claim") return;
    if (routeState.view === "receipt") {
      setBookingLoading(true);
      setError(undefined);
      bookingApi<BookingReceipt>(
        `bookings/${encodeURIComponent(routeState.id)}/receipt`,
      )
        .then(setReceipt)
        .catch(setError)
        .finally(() => setBookingLoading(false));
      return;
    }
    void loadBooking();
    return () => {
      const current = bookingRequest.current;
      if (current && current.id === routeState.id) {
        current.controller.abort();
        bookingRequest.current = undefined;
      }
    };
  }, [loadBooking, routeState.id, routeState.view]);

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

  const languageDestination = (nextLang: "en" | "zh") => {
    if (routeState.id && routeState.view)
      return bookingPath(
        nextLang,
        `/${routeState.view}/${encodeURIComponent(routeState.id)}`,
      );
    const base = bookingPath(nextLang);
    return selectedProductId
      ? `${base}?product=${encodeURIComponent(selectedProductId)}`
      : base;
  };

  async function requestQuote(input: QuoteInput) {
    setBusy(true);
    setError(undefined);
    setQuote(undefined);
    try {
      const next = await bookingApi<BookingQuote>("quotes", {
        ...input,
        returnTo: "transfers",
      });
      reservationKey.current = crypto.randomUUID();
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
      void recover();
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    if (!routeState.id || busy) return;
    setBusy(true);
    setError(undefined);
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
      setError(nextError);
      setBusy(false);
      void loadBooking();
    }
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
      void recover();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  if (routeState.view === "claim")
    return (
      <section className="qb-customer qt-card" role="status">
        <h2>
          {claimFailed
            ? lang === "zh"
              ? "這個連結已失效"
              : "This link is no longer valid"
            : lang === "zh"
              ? "正在開啟您的預訂…"
              : "Opening your booking…"}
        </h2>
        {claimFailed ? (
          <p>
            {lang === "zh"
              ? "請聯絡 Qualitour，我們會為您重新發送專屬連結。"
              : "Please contact Qualitour and we will send you a new link."}
          </p>
        ) : null}
      </section>
    );

  if (unavailable)
    return (
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
        <a className="qt-btn" href={bookingPath(lang)}>
          {lang === "zh" ? "查看可測試路線" : "View test routes"}
        </a>
      </section>
    );

  if (routeState.view === "receipt" && receipt)
    return (
      <div className={`qb-customer${compact ? " qb-compact" : ""}`}>
        <ReceiptView
          receipt={receipt}
          lang={lang}
          onPrint={() => window.print()}
          onBack={() =>
            navigate(
              bookingPath(
                lang,
                `/manage/${encodeURIComponent(routeState.id!)}`,
              ),
            )
          }
        />
      </div>
    );

  return (
    <div className={`qb-customer${compact ? " qb-compact" : ""}`}>
      <BookingView
        showBooking={Boolean(routeState.id)}
        websiteUrl={
          lang === "zh" ? "/zh/private-transfers" : "/private-transfers"
        }
        lang={lang}
        onLanguage={(nextLang) => navigate(languageDestination(nextLang))}
        catalog={catalog}
        quote={quote}
        booking={booking}
        loading={catalogLoading || (Boolean(routeState.id) && bookingLoading)}
        busy={busy}
        error={error ? bookingMessage(error, lang) : ""}
        initialRouteId={requestedRoute?.id}
        initialRateId={requestedRate?.id}
        onAvailability={(input, signal) =>
          bookingApi<AvailabilityResult>("availability", input, signal)
        }
        onQuote={requestQuote}
        onReserve={reserve}
        onCheckout={checkout}
        onCancel={cancel}
        onRefresh={routeState.id ? loadBooking : () => window.location.reload()}
        onNew={() => navigate(bookingPath(lang))}
        onReceipt={() =>
          navigate(
            bookingPath(lang, `/receipt/${encodeURIComponent(routeState.id!)}`),
          )
        }
        recent={recent}
        recoveryLoading={recoveryLoading}
        recoveryError={recoveryError ? bookingMessage(recoveryError, lang) : ""}
        onRecover={recover}
      />
    </div>
  );
}
