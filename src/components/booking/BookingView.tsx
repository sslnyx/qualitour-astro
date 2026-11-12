import { useEffect, useState } from "react";
import type { BookingViewProps } from "../../lib/booking/types";
import type {
  CustomerInput,
  RouteServiceRules,
} from "../../lib/booking/contracts";
import { BookingRecovery } from "./BookingRecovery";

const VANCOUVER_TIME_ZONE = "America/Vancouver";
const VANCOUVER_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: VANCOUVER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export const MIN_BOOKING_LEAD_MINUTES = 60;
export const MAX_BOOKING_HORIZON_DAYS = 366;

export type ServiceLocalNow = {
  date: string;
  time: string;
  epochMs: number;
};
export type ServiceDateWindow = { validFrom: string; validTo: string };

function timeMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes < 1440 ? minutes : null;
}

function vancouverParts(epochMs: number) {
  const parts = VANCOUVER_FORMATTER.formatToParts(epochMs);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  };
}

function vancouverLocalEpoch(date: string, time: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date),
    timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch || timeMinutes(time) === null) return null;
  const year = Number(dateMatch[1]),
    month = Number(dateMatch[2]),
    day = Number(dateMatch[3]),
    hour = Number(timeMatch[1]),
    minute = Number(timeMatch[2]),
    calendar = new Date(Date.UTC(year, month - 1, day));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day
  )
    return null;

  const target = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = vancouverParts(candidate),
      observed = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
      ),
      adjustment = target - observed;
    candidate += adjustment;
    if (!adjustment) break;
  }
  const resolved = vancouverParts(candidate);
  return resolved.year === dateMatch[1] &&
    resolved.month === dateMatch[2] &&
    resolved.day === dateMatch[3] &&
    resolved.hour === timeMatch[1] &&
    resolved.minute === timeMatch[2]
    ? candidate
    : null;
}

export function serviceDateBounds(
  rules: RouteServiceRules,
  today: string,
  rateWindow?: ServiceDateWindow,
  nowEpochMs?: number,
) {
  const horizonDate = Number.isFinite(nowEpochMs)
    ? (() => {
        const parts = vancouverParts(
          nowEpochMs! + MAX_BOOKING_HORIZON_DAYS * 86_400_000,
        );
        return `${parts.year}-${parts.month}-${parts.day}`;
      })()
    : rules.validTo;
  return {
    min: [today, rules.validFrom, rateWindow?.validFrom ?? ""].sort().at(-1)!,
    max: [
      rules.validTo,
      rateWindow?.validTo ?? rules.validTo,
      horizonDate,
    ].sort()[0],
  };
}

export function serviceDateAllowed(
  rules: RouteServiceRules,
  date: string,
  today: string,
  rateWindow?: ServiceDateWindow,
  nowEpochMs?: number,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const bounds = serviceDateBounds(rules, today, rateWindow, nowEpochMs);
  if (date < bounds.min || date > bounds.max) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    rules.daysOfWeek.includes(parsed.getUTCDay())
  );
}

export function serviceTimeOptions(
  rules: RouteServiceRules,
  date: string,
  localNow: ServiceLocalNow,
  rateWindow?: ServiceDateWindow,
) {
  if (
    !serviceDateAllowed(
      rules,
      date,
      localNow.date,
      rateWindow,
      localNow.epochMs,
    )
  )
    return [];
  const start = timeMinutes(rules.startTime),
    end = timeMinutes(rules.endTime),
    cutoff = localNow.epochMs + MIN_BOOKING_LEAD_MINUTES * 60_000,
    horizon = localNow.epochMs + MAX_BOOKING_HORIZON_DAYS * 86_400_000;
  if (
    start === null ||
    end === null ||
    end < start ||
    !Number.isFinite(localNow.epochMs) ||
    !Number.isInteger(rules.intervalMinutes) ||
    rules.intervalMinutes <= 0
  )
    return [];
  const values: string[] = [];
  for (let minutes = start; minutes <= end; minutes += rules.intervalMinutes) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
      departureEpoch = vancouverLocalEpoch(date, value);
    if (
      departureEpoch === null ||
      departureEpoch < cutoff ||
      departureEpoch > horizon
    )
      continue;
    values.push(value);
  }
  return values;
}

export function vancouverLocalNow(now: Date): ServiceLocalNow {
  const parts = vancouverParts(now.getTime());
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    epochMs: now.getTime(),
  };
}

export function BookingView(p: BookingViewProps) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en),
    [routeId, setRouteId] = useState(""),
    [rateId, setRateId] = useState(""),
    [departure, setDeparture] = useState(""),
    [serviceDate, setServiceDate] = useState(""),
    [serviceTime, setServiceTime] = useState(""),
    [passengers, setPassengers] = useState(1),
    [ack, setAck] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [customer, setCustomer] = useState<CustomerInput>({
      name: "",
      email: "",
      phone: "",
      pickupAddress: "",
      dropoffAddress: "",
      flightNumber: "",
      notes: "",
    });
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (p.initialRouteId) {
      setRouteId(p.initialRouteId);
      setRateId(p.initialRateId ?? "");
    }
  }, [p.initialRouteId, p.initialRateId]);
  useEffect(() => {
    setCustomer((current) => ({
      ...current,
      pickupLocationId: undefined,
      dropoffLocationId: undefined,
    }));
    setAck(false);
  }, [p.quote?.id]);
  const route = p.catalog?.routes.find((r) => r.id === routeId),
    rate = p.catalog?.rates.find(
      (r) => r.id === rateId && r.routeId === routeId,
    ),
    quote = p.quote,
    localNow = vancouverLocalNow(new Date(tick)),
    serviceBounds = route?.serviceRules
      ? serviceDateBounds(
          route.serviceRules,
          localNow.date,
          rate,
          localNow.epochMs,
        )
      : null,
    serviceDateIsAllowed = route?.serviceRules
      ? serviceDateAllowed(
          route.serviceRules,
          serviceDate,
          localNow.date,
          rate,
          localNow.epochMs,
        )
      : false,
    times = route?.serviceRules
      ? serviceTimeOptions(route.serviceRules, serviceDate, localNow, rate)
      : [],
    selectedPickup = quote?.pickupOptions?.find(
      (option) => option.id === customer.pickupLocationId,
    ),
    selectedDropoff = quote?.dropoffOptions?.find(
      (option) => option.id === customer.dropoffLocationId,
    );
  const matches = Boolean(
      quote &&
      quote.routeId === routeId &&
      quote.rateId === rateId &&
      quote.departureLocal === departure &&
      quote.passengers === passengers,
    ),
    quoteValid = matches && quote!.expiresAt > tick / 1000;
  const money = (minor: number) =>
    new Intl.NumberFormat(p.lang === "zh" ? "zh-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "code",
    }).format(minor / 100);
  const name = (r: { nameZh: string; nameEn: string }) =>
    p.lang === "zh" ? r.nameZh : r.nameEn;
  const timeLabel = (value: string) => {
    if (p.lang === "zh") return value;
    const minutes = timeMinutes(value);
    if (minutes === null) return value;
    const hour = Math.floor(minutes / 60),
      minute = String(minutes % 60).padStart(2, "0");
    return `${hour % 12 || 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
  };
  const patch = (key: keyof CustomerInput, value: string) =>
    setCustomer((c) => ({ ...c, [key]: value }));
  const field = (
    key: keyof CustomerInput,
    label: string,
    type = "text",
    required = true,
    maxLength = 300,
  ) => (
    <label className="qt-field" key={key}>
      <span>{label}</span>
      <input
        name={key}
        type={type}
        required={required}
        maxLength={maxLength}
        value={customer[key]}
        onChange={(e) => patch(key, e.target.value)}
        autoComplete={
          key === "name"
            ? "name"
            : key === "email"
              ? "email"
              : key === "phone"
                ? "tel"
                : "off"
        }
      />
    </label>
  );
  const b = p.booking;
  return (
    <div className="qb-customer">
      <header className="qb-public-head">
        <a className="qb-brand" href={p.websiteUrl}>
          QUALITOUR<small>PRIVATE TRANSFER</small>
        </a>
        <nav className="qb-languages" aria-label="Language">
          <button
            type="button"
            aria-pressed={p.lang === "en"}
            onClick={() => p.onLanguage("en")}
          >
            EN
          </button>
          <button
            type="button"
            aria-pressed={p.lang === "zh"}
            onClick={() => p.onLanguage("zh")}
          >
            中文
          </button>
        </nav>
      </header>
      <div className="qb-sandbox" role="note">
        {t(
          "Sandbox 測試環境：不會扣取真實款項，也不會提供真實接送服務。",
          "Sandbox test environment: no real charge and no travel service will be provided.",
        )}
      </div>
      <main className="qb-public-main">
        <div className="qb-hero">
          <h1>
            {p.showBooking
              ? t("你的測試預訂", "Your test booking")
              : t("安排你的私人接送", "Plan your private transfer")}
          </h1>
          <p>
            {t(
              "選擇路線與時間，核對整車報價，再填寫接送資料。",
              "Choose a route and time, review your whole-vehicle quote, then add your transfer details.",
            )}
          </p>
          <div
            className="qb-progress"
            aria-label={t("預訂步驟", "Booking progress")}
          >
            <span className={!p.showBooking ? "is-current" : ""}>
              1 · {t("行程與報價", "Trip & quote")}
            </span>
            <span className={quoteValid && !p.showBooking ? "is-current" : ""}>
              2 · {t("接送資料", "Transfer details")}
            </span>
            <span className={p.showBooking ? "is-current" : ""}>
              3 · {t("測試付款與確認", "Test payment & confirmation")}
            </span>
          </div>
        </div>
        {p.error && (
          <div className="qt-alert" role="alert">
            {p.error}
          </div>
        )}
        {!p.showBooking && (
          <BookingRecovery
            bookings={p.recent ?? []}
            lang={p.lang}
            loading={p.recoveryLoading ?? false}
            error={p.recoveryError ?? ""}
            onRefresh={p.onRecover}
          />
        )}
        {p.showBooking ? (
          <section className="qt-card qb-summary">
            {!b ? (
              <>
                <p role="status">
                  {p.loading
                    ? t("正在核對預訂狀態…", "Checking your booking…")
                    : t(
                        "目前無法顯示這筆預訂。",
                        "This booking cannot be displayed right now.",
                      )}
                </p>
                <div className="qb-public-actions">
                  <button
                    className="qt-btn"
                    onClick={p.onRefresh}
                    disabled={p.busy || p.loading}
                  >
                    {t("重新核對", "Check again")}
                  </button>
                  <button className="qt-btn" onClick={p.onNew}>
                    {t("返回預訂頁", "Back to booking")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className={"qb-status " + b.status}>
                    {b.status === "confirmed"
                      ? t("測試預訂已確認", "Test booking confirmed")
                      : b.status === "cancelled"
                        ? t("測試預訂已取消", "Test booking cancelled")
                        : t("等待測試付款", "Awaiting test payment")}
                  </span>
                  <h2>{b.reference}</h2>
                </div>
                <dl>
                  <div>
                    <dt>{t("路線", "Route")}</dt>
                    <dd>{p.lang === "zh" ? b.routeNameZh : b.routeNameEn}</dd>
                  </div>
                  {b.pickupLocation ? (
                    <div>
                      <dt>
                        {t("上車航廈／地點", "Pickup terminal / location")}
                      </dt>
                      <dd>{name(b.pickupLocation)}</dd>
                    </div>
                  ) : null}
                  {b.dropoffLocation ? (
                    <div>
                      <dt>{t("下車地點", "Drop-off location")}</dt>
                      <dd>{name(b.dropoffLocation)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t("溫哥華出發時間", "Departure in Vancouver")}</dt>
                    <dd>{b.departureLabel}</dd>
                  </div>
                  <div>
                    <dt>{t("乘客", "Passengers")}</dt>
                    <dd>{b.passengers}</dd>
                  </div>
                  <div>
                    <dt>{t("整車總額", "Whole-vehicle total")}</dt>
                    <dd>{money(b.amountMinor)}</dd>
                  </div>
                  <div>
                    <dt>{t("付款狀態", "Payment status")}</dt>
                    <dd>
                      {b.paymentState === "paid"
                        ? t("已核實測試收款", "Test payment verified")
                        : b.paymentState === "review"
                          ? t("需要人工檢查", "Needs review")
                          : b.paymentState === "pending"
                            ? t("正在核實", "Checking payment")
                            : t("未付款", "Unpaid")}
                    </dd>
                  </div>
                </dl>
                {b.status === "pending" && (
                  <p className="qb-note">
                    {b.holdUntil > tick / 1000
                      ? t(
                          `車位仍暫留約 ${Math.max(1, Math.ceil((b.holdUntil - tick / 1000) / 60))} 分鐘；付款狀態以伺服器核對為準。`,
                          `Your vehicle is held for about ${Math.max(1, Math.ceil((b.holdUntil - tick / 1000) / 60))} more minutes. Payment must be verified by the server.`,
                        )
                      : t(
                          "正在核實付款與車位狀態，請重新核對。",
                          "The payment and vehicle hold need verification. Please check again.",
                        )}
                  </p>
                )}
                {b.paymentNotification && (
                  <p role="status" className="qb-note">
                    {t(
                      "付款已確認。收據已保存，可隨時在此瀏覽器重看。",
                      "Payment confirmed. Your receipt is saved and can be reopened in this browser.",
                    )}
                  </p>
                )}
                <div className="qb-public-actions">
                  {b.paymentNotification && (
                    <button
                      className="qt-btn qt-btn--primary"
                      onClick={p.onReceipt}
                    >
                      {t("查看付款收據", "View payment receipt")}
                    </button>
                  )}
                  {b.canPay && (
                    <button
                      className="qt-btn qt-btn--primary"
                      disabled={p.busy || !p.catalog?.paymentEnabled}
                      onClick={p.onCheckout}
                    >
                      {p.busy
                        ? t("處理中…", "Working…")
                        : t(
                            "前往 Stripe 測試付款",
                            "Continue to Stripe test payment",
                          )}
                    </button>
                  )}
                  {b.canCancel && (
                    <button
                      className="qt-btn"
                      disabled={p.busy}
                      onClick={p.onCancel}
                    >
                      {t("取消本次測試預訂", "Cancel test reservation")}
                    </button>
                  )}
                  <button
                    className="qt-btn"
                    disabled={p.busy || p.loading}
                    onClick={p.onRefresh}
                  >
                    {t("重新核對狀態", "Refresh status")}
                  </button>
                </div>
                {b.canPay && !p.catalog?.paymentEnabled && (
                  <p className="qb-note">
                    {t(
                      "此預覽目前尚未連接測試付款。",
                      "Test payments are not connected in this preview.",
                    )}
                  </p>
                )}
                <p className="qb-note">
                  {t(
                    "請保留預訂編號，並使用原本的瀏覽器查看。這是測試預訂，不會寄出真正的接送通知。",
                    "Keep your booking reference and use this browser to view it. This is a test booking; no actual transfer notification will be sent.",
                  )}
                </p>
                <button className="qt-btn qt-btn--ghost" onClick={p.onNew}>
                  {t("建立另一筆測試預訂", "Start another test booking")}
                </button>
                {b.status === "pending" && (
                  <small className="qb-note">
                    {t(
                      "建立新預訂不會自動取消這一筆。",
                      "Starting again will not automatically cancel this booking.",
                    )}
                  </small>
                )}
              </>
            )}
          </section>
        ) : !p.catalog && p.loading ? (
          <p role="status">{t("載入路線…", "Loading routes…")}</p>
        ) : !p.catalog?.routes.length ? (
          <section className="qt-card">
            <h2>{t("目前沒有可預訂路線", "No routes are available yet")}</h2>
            <p className="qb-note">
              {t(
                "請先在營運後台設定並啟用測試路線、價格與車輛。",
                "Test routes, rates and vehicles must be configured before bookings can be made.",
              )}
            </p>
            <button className="qt-btn" onClick={p.onRefresh}>
              {t("重新載入", "Reload")}
            </button>
          </section>
        ) : (
          <div className="qb-public-grid">
            <div>
              <form
                className="qt-card"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!p.busy && route && rate)
                    p.onQuote({
                      routeId,
                      rateId,
                      departureLocal: departure,
                      passengers,
                    });
                }}
              >
                <h2>{t("選擇行程", "Choose your trip")}</h2>
                <fieldset className="qb-fields" disabled={p.busy}>
                  <label className="qt-field qb-full">
                    <span>{t("路線", "Route")}</span>
                    <select
                      required
                      value={routeId}
                      onChange={(e) => {
                        setRouteId(e.target.value);
                        setRateId("");
                        setDeparture("");
                        setServiceDate("");
                        setServiceTime("");
                        setCustomer((current) => ({
                          ...current,
                          pickupLocationId: undefined,
                          dropoffLocationId: undefined,
                        }));
                        setAck(false);
                      }}
                    >
                      <option value="">
                        {t("請選擇路線", "Choose a route")}
                      </option>
                      {p.catalog.routes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {name(r)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="qt-field qb-full">
                    <span>{t("車型方案", "Vehicle option")}</span>
                    <select
                      required
                      value={rateId}
                      onChange={(e) => {
                        const nextRate = p.catalog?.rates.find(
                            (candidate) => candidate.id === e.target.value,
                          ),
                          nextDateAllowed = Boolean(
                            route?.serviceRules &&
                            serviceDateAllowed(
                              route.serviceRules,
                              serviceDate,
                              localNow.date,
                              nextRate,
                              localNow.epochMs,
                            ),
                          ),
                          nextTimes =
                            route?.serviceRules && nextDateAllowed
                              ? serviceTimeOptions(
                                  route.serviceRules,
                                  serviceDate,
                                  localNow,
                                  nextRate,
                                )
                              : [];
                        setRateId(e.target.value);
                        if (!nextDateAllowed) {
                          setServiceDate("");
                          setServiceTime("");
                          setDeparture("");
                        } else if (!nextTimes.includes(serviceTime)) {
                          setServiceTime("");
                          setDeparture("");
                        }
                        setCustomer((current) => ({
                          ...current,
                          pickupLocationId: undefined,
                          dropoffLocationId: undefined,
                        }));
                        setAck(false);
                      }}
                    >
                      <option value="">
                        {t("請選擇方案", "Choose an option")}
                      </option>
                      {p.catalog.rates
                        .filter((r) => r.routeId === routeId)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {name(r)} ·{" "}
                            {t(
                              `最多${r.maxPassengers}人`,
                              `Up to ${r.maxPassengers} passengers`,
                            )}
                          </option>
                        ))}
                    </select>
                  </label>
                  {route?.serviceRules ? (
                    <>
                      <label className="qt-field">
                        <span>
                          {t("服務日期（溫哥華）", "Service date (Vancouver)")}
                        </span>
                        <input
                          type="date"
                          required
                          min={serviceBounds?.min}
                          max={serviceBounds?.max}
                          value={serviceDate}
                          onInput={(e) => {
                            setServiceDate(e.currentTarget.value);
                            setServiceTime("");
                            setDeparture("");
                            setAck(false);
                          }}
                        />
                      </label>
                      <label className="qt-field">
                        <span>
                          {t(
                            "出發時間（溫哥華太平洋時間）",
                            "Start time (Vancouver Pacific Time)",
                          )}
                        </span>
                        <select
                          required
                          disabled={!serviceDateIsAllowed || !times.length}
                          value={serviceTime}
                          onChange={(e) => {
                            const next = e.target.value;
                            setServiceTime(next);
                            setDeparture(next ? `${serviceDate}T${next}` : "");
                            setAck(false);
                          }}
                        >
                          <option value="">
                            {t("請選擇出發時間", "Choose a start time")}
                          </option>
                          {times.map((time) => (
                            <option key={time} value={time}>
                              {timeLabel(time)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {serviceDate && !serviceDateIsAllowed ? (
                        <p className="qb-note qb-full" role="alert">
                          {t(
                            "這個日期不在此路線的服務日期或星期內，請另選日期。",
                            "This route does not operate on that date. Choose another date.",
                          )}
                        </p>
                      ) : serviceDateIsAllowed && !times.length ? (
                        <p className="qb-note qb-full" role="alert">
                          {t(
                            "今天已沒有可選的服務時間，請另選日期。",
                            "No service times remain today. Choose another date.",
                          )}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <label className="qt-field">
                      <span>
                        {t(
                          "溫哥華當地日期與時間",
                          "Vancouver local date & time",
                        )}
                      </span>
                      <input
                        type="datetime-local"
                        required
                        value={departure}
                        onChange={(e) => {
                          setDeparture(e.target.value);
                          setAck(false);
                        }}
                      />
                    </label>
                  )}
                  <label className="qt-field">
                    <span>{t("乘客人數", "Passengers")}</span>
                    <input
                      type="number"
                      required
                      min={1}
                      max={rate?.maxPassengers ?? 60}
                      step={1}
                      value={passengers}
                      onChange={(e) => {
                        setPassengers(Number(e.target.value));
                        setAck(false);
                      }}
                    />
                  </label>
                </fieldset>
                <p className="qb-note">
                  {route?.serviceRules
                    ? t(
                        "日期與時間只依此路線的服務規則顯示，不代表車輛仍有空位；取得伺服器報價時才會核對。時區：America/Vancouver。",
                        "Dates and times follow this route's service rules, but do not promise vehicle availability; the server checks when quoting. Time zone: America/Vancouver.",
                      )
                    : t(
                        "目前測試設定：提前至少1小時、最多366天。取得報價時不會保留車位。",
                        "Test settings: book 1 hour to 366 days ahead. A quote does not hold a vehicle.",
                      )}
                </p>
                <button
                  className="qt-btn qt-btn--primary"
                  disabled={p.busy || !route || !rate}
                >
                  {p.busy
                    ? t("核對中…", "Checking…")
                    : t("取得整車報價", "Get a whole-vehicle quote")}
                </button>
              </form>
              {quote && quoteValid && (
                <form
                  className="qt-card"
                  style={{ marginTop: 22 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!p.busy && ack) p.onReserve(customer);
                  }}
                >
                  <h2>{t("接送與聯絡資料", "Transfer & contact details")}</h2>
                  <fieldset className="qb-fields" disabled={p.busy}>
                    {quote.pickupOptions?.length ? (
                      <label className="qt-field qb-full">
                        <span>
                          {t(
                            "上車航廈／地點（必選）",
                            "Pickup terminal / location (required)",
                          )}
                        </span>
                        <select
                          required
                          value={customer.pickupLocationId ?? ""}
                          onChange={(e) =>
                            patch("pickupLocationId", e.target.value)
                          }
                        >
                          <option value="">
                            {t("請選擇上車地點", "Choose a pickup location")}
                          </option>
                          {quote.pickupOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {name(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {quote.dropoffOptions?.length ? (
                      <label className="qt-field qb-full">
                        <span>
                          {t(
                            "下車地點（必選）",
                            "Drop-off location (required)",
                          )}
                        </span>
                        <select
                          required
                          value={customer.dropoffLocationId ?? ""}
                          onChange={(e) =>
                            patch("dropoffLocationId", e.target.value)
                          }
                        >
                          <option value="">
                            {t("請選擇下車地點", "Choose a drop-off location")}
                          </option>
                          {quote.dropoffOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {name(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    {field("name", t("姓名", "Full name"), "text", true, 100)}
                    {field("email", t("電郵", "Email"), "email", true, 254)}
                    {field("phone", t("電話", "Phone"), "tel", true, 40)}
                    {field(
                      "flightNumber",
                      t("航班（選填）", "Flight number (optional)"),
                      "text",
                      false,
                      40,
                    )}
                    {field(
                      "pickupAddress",
                      t(
                        "詳細上車地址／航廈說明",
                        "Detailed pickup address / terminal notes",
                      ),
                    )}
                    {field(
                      "dropoffAddress",
                      t("詳細下車地址", "Detailed drop-off address"),
                    )}
                    <label className="qt-field qb-full">
                      <span>{t("備註（選填）", "Notes (optional)")}</span>
                      <textarea
                        maxLength={1000}
                        rows={3}
                        value={customer.notes}
                        onChange={(e) => patch("notes", e.target.value)}
                      />
                    </label>
                  </fieldset>
                  <label className="qb-check qb-ack">
                    <input
                      type="checkbox"
                      required
                      checked={ack}
                      disabled={p.busy}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    {t(
                      "我知道這是 Sandbox 測試預訂，不會提供真實接送服務。",
                      "I understand this is a Sandbox test booking and no actual transfer service will be provided.",
                    )}
                  </label>
                  <button
                    className="qt-btn qt-btn--primary"
                    disabled={p.busy || !ack}
                  >
                    {p.busy
                      ? t("建立中…", "Creating…")
                      : t(
                          "建立測試預訂並暫留車位",
                          "Create test booking & hold vehicle",
                        )}
                  </button>
                  <p className="qb-note">
                    {t(
                      "建立後先暫留10分鐘，進入 Stripe 後依付款頁時限核對。",
                      "The initial hold lasts 10 minutes. Once Checkout starts, its payment deadline applies.",
                    )}
                  </p>
                </form>
              )}
            </div>
            <aside className="qt-card qb-summary">
              <h2>{t("行程摘要", "Trip summary")}</h2>
              {route && (
                <p>
                  {p.lang === "zh" ? route.pickupZh : route.pickupEn} →{" "}
                  {p.lang === "zh" ? route.dropoffZh : route.dropoffEn}
                </p>
              )}
              {matches && quote ? (
                <>
                  <p className="qb-quote-amount">{money(quote.amountMinor)}</p>
                  <p className="qb-note">
                    {t("每輛整車測試總額", "Test total for one whole vehicle")}
                  </p>
                  <dl>
                    {selectedPickup ? (
                      <div>
                        <dt>
                          {t("上車航廈／地點", "Pickup terminal / location")}
                        </dt>
                        <dd>{name(selectedPickup)}</dd>
                      </div>
                    ) : null}
                    {selectedDropoff ? (
                      <div>
                        <dt>{t("下車地點", "Drop-off location")}</dt>
                        <dd>{name(selectedDropoff)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>{t("出發", "Departure")}</dt>
                      <dd>{quote.departureLabel}</dd>
                    </div>
                    <div>
                      <dt>{t("乘客", "Passengers")}</dt>
                      <dd>{quote.passengers}</dd>
                    </div>
                  </dl>
                  <p className="qb-note">
                    {quoteValid
                      ? t(
                          `報價約${Math.max(1, Math.ceil((quote.expiresAt - tick / 1000) / 60))}分鐘內有效；建立訂單時會再核對車位與價格。`,
                          `Quote valid for about ${Math.max(1, Math.ceil((quote.expiresAt - tick / 1000) / 60))} minutes. Price and vehicle availability are checked again when booking.`,
                        )
                      : t(
                          "報價已到期，請重新取得報價。",
                          "This quote has expired. Please request a new quote.",
                        )}
                  </p>
                </>
              ) : (
                <p className="qb-note">
                  {quote
                    ? t(
                        "行程已更改，請重新取得報價。",
                        "Your trip has changed. Please request a new quote.",
                      )
                    : t(
                        "選擇行程後取得伺服器核對的報價。",
                        "Choose a trip to receive a server-verified quote.",
                      )}
                </p>
              )}
            </aside>
          </div>
        )}
        <footer className="qb-public-footer">
          <a href={p.websiteUrl}>
            {t("返回 Qualitour 官網", "Back to Qualitour")}
          </a>
          <p>
            {t(
              "這是獨立預訂測試頁。真實路線與售價、通知及正式上線仍待核定。",
              "This is a standalone booking preview. Actual services, pricing, notifications and launch are still pending approval.",
            )}
          </p>
        </footer>
      </main>
    </div>
  );
}
