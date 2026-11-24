import PriceLines from "./PriceLines";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { BookingTripDraft, BookingViewProps } from "../../lib/booking/types";
import type {
  CustomerInput,
  RouteServiceRules,
} from "../../lib/booking/contracts";
import { BookingLocationSelect } from "./BookingLocationSelect";
import { ServiceCalendar } from "./ServiceCalendar";
import {
  formatDepartureLabel,
  formatServiceDate,
} from "../../lib/booking/format";

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
const AVAILABILITY_FRESH_MS = 30_000;

export function leadLabel(minutes: number, lang: "zh" | "en") {
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return lang === "zh"
      ? `${days * 24} 小時（${days} 天）`
      : `${days * 24} hours`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return lang === "zh"
      ? `${hours} 小時`
      : `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return lang === "zh" ? `${minutes} 分鐘` : `${minutes} minutes`;
}

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

function nextServiceDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
    cutoff =
      localNow.epochMs +
      (rules.minLeadMinutes ?? MIN_BOOKING_LEAD_MINUTES) * 60_000,
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

/**
 * Qualitour's cancellation and refund policy. The same wording is used in the confirmation email and the staff refund
 * panel (qualitour-ops `src/booking/policy.ts`); change them together.
 */
const POLICY_NOTICE_HOURS = 72;
const POLICY_FEE_PERCENT = 5;
export function CancellationPolicy({ lang }: { lang: "zh" | "en" }) {
  return (
    <section className="qb-policy" aria-labelledby="qb-policy-title">
      <h3 id="qb-policy-title">
        {lang === "zh" ? "取消與退款政策" : "Cancellation and refund policy"}
      </h3>
      <p>
        {lang === "zh"
          ? `出發前 ${POLICY_NOTICE_HOURS} 小時（含）之前可隨時取消，退款會扣除總額 ${POLICY_FEE_PERCENT}% 的行政費。超過這個時間，一律不予退款。未到（no-show）不退款。如需更改或取消預訂，請聯絡 info@qualitour.ca。`
          : `Cancellations can be made anytime until ${POLICY_NOTICE_HOURS} hours before the service, but refunds are subject to an administration fee of ${POLICY_FEE_PERCENT}% of the total amount. After that time, all bookings are non-refundable. No-shows will not be refunded. To change or cancel a booking, contact info@qualitour.ca.`}
      </p>
    </section>
  );
}

export function BookingView(p: BookingViewProps) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en),
    [rateId, setRateId] = useState(""),
    [departure, setDeparture] = useState(""),
    [localTripDraft, setLocalTripDraft] = useState<BookingTripDraft>({ serviceDate: "", passengers: 0, coupon: "" }),
    [serviceTime, setServiceTime] = useState(""),
    [ack, setAck] = useState(false),
    [editingTrip, setEditingTrip] = useState(true),
    [timePeriod, setTimePeriod] = useState("morning"),
    [tick, setTick] = useState(Date.now()),
    [availability, setAvailability] = useState<{
      key: string;
      status: "loading" | "ready" | "error";
      slots: Record<string, boolean>;
      receivedAt?: number;
    }>({ key: "", status: "loading", slots: {} }),
    [timeCheck, setTimeCheck] = useState<"idle" | "checking" | "taken">("idle");
  const { customer, setCustomer } = p;
  const { serviceDate, passengers, coupon } = p.tripDraft ?? localTripDraft;
  const routeId = p.initialRouteId ?? "";
  const passengerId = useId();
  const dateGuidanceId = useId();
  const holdLabelId = useId();
  const checkSeq = useRef(0);
  const restoredDate = useRef(p.tripDraft?.serviceDate);
  const tripReviewHeading = useRef<HTMLHeadingElement>(null);
  const bookingErrorNotice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (p.initialRateId) setRateId(p.initialRateId);
  }, [p.initialRateId]);
  useEffect(() => {
    setAck(false);
    if (p.quote) {
      setEditingTrip(false);
    }
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
  const askPickupAddress = selectedPickup
    ? selectedPickup.requiresAddress !== false
    : !quote?.pickupOptions?.length;
  const askDropoffAddress = selectedDropoff
    ? selectedDropoff.requiresAddress !== false
    : !quote?.dropoffOptions?.length;
  const matches = Boolean(
      quote &&
      quote.routeId === routeId &&
      quote.rateId === rateId &&
      quote.departureLocal === departure &&
      quote.passengers === passengers &&
      (quote.couponCode ?? "") === coupon.trim().toUpperCase(),
    ),
    quoteValid = matches && quote!.expiresAt > tick / 1000;
  const calendarDateEnabled = useMemo(() => {
    const enabledDates = new Map<string, boolean>();
    return (date: string) => {
      if (!route?.serviceRules) return false;
      if (!enabledDates.has(date))
        enabledDates.set(
          date,
          serviceTimeOptions(route.serviceRules, date, localNow, rate).length >
            0,
        );
      return enabledDates.get(date)!;
    };
  }, [route?.serviceRules, rate, localNow.date, Math.floor(tick / 60_000)]);
  const earliestSelectableDate = useMemo(() => {
    if (!serviceBounds) return undefined;
    for (let date = serviceBounds.min; date <= serviceBounds.max; date = nextServiceDate(date)) {
      if (calendarDateEnabled(date)) return date;
    }
    return undefined;
  }, [calendarDateEnabled, serviceBounds?.min, serviceBounds?.max]);

  function updateTripDraft(patch: Partial<BookingTripDraft>) {
    if (p.onTripDraftChange) p.onTripDraftChange(patch);
    else setLocalTripDraft((current) => ({ ...current, ...patch }));
  }

  useEffect(() => {
    if (!restoredDate.current || !route || !rate) return;
    const date = restoredDate.current;
    restoredDate.current = undefined;
    if (!calendarDateEnabled(date)) updateTripDraft({ serviceDate: "" });
  }, [route, rate, calendarDateEnabled]);

  const showTrip = editingTrip || !quoteValid;
  const maxPassengers = rate?.maxPassengers ?? 60;
  const missingPassengers = passengers === 0;
  const invalidPassengers = !Number.isInteger(passengers) || passengers < 1 || passengers > maxPassengers;
  const passengerHint = missingPassengers
    ? t("請至少選擇 1 位乘客。", "Choose at least 1 passenger.")
    : invalidPassengers
      ? t(
          `請選擇 1 至 ${maxPassengers} 位乘客，或更換車型。`,
          `Choose 1 to ${maxPassengers} passengers or switch vehicles.`,
        )
      : "";
  const passengerDescription = [
    rate && `${passengerId}-limit`,
    passengerHint && `${passengerId}-hint`,
  ].filter(Boolean).join(" ");
  const quoteDisabled =
    p.busy ||
    !route ||
    !rate ||
    invalidPassengers ||
    timeCheck === "checking" ||
    (Boolean(route?.serviceRules) &&
      (!serviceDateIsAllowed || !times.includes(serviceTime) || !departure));
  let quoteDisabledReason = "";
  if (quoteDisabled) {
    if (p.busy || timeCheck === "checking") {
      quoteDisabledReason = t("正在核對可用車位，請稍候。", "Checking vehicle availability. Please wait.");
    } else if (!route) {
      quoteDisabledReason = t("正在載入可預訂路線。", "Loading the bookable route.");
    } else if (!rate) {
      quoteDisabledReason = t("請先選擇車型。", "Choose a vehicle first.");
    } else if (route.serviceRules) {
      if (!serviceDate || !serviceDateIsAllowed) {
        quoteDisabledReason = t("請選擇可服務的日期。", "Choose an available service date.");
      } else if (!times.includes(serviceTime) || !departure) {
        quoteDisabledReason = t("請選擇可用的出發時間。", "Choose an available departure time.");
      }
    }
  }
  useEffect(() => {
    if (!showTrip) {
      // Start the new step at the quoted trip, before asking for contact details.
      tripReviewHeading.current?.scrollIntoView({ block: "start" });
      tripReviewHeading.current?.focus({ preventScroll: true });
    }
  }, [showTrip, p.quote?.id]);
  useEffect(() => {
    if (p.error && p.focusError) {
      bookingErrorNotice.current?.scrollIntoView({ block: "center" });
      bookingErrorNotice.current?.focus({ preventScroll: true });
    }
  }, [p.error, p.focusError]);
  const timeGroups = [
    {
      id: "morning",
      label: t("上午", "Morning"),
      values: times.filter((time) => time < "12:00"),
    },
    {
      id: "afternoon",
      label: t("下午", "Afternoon"),
      values: times.filter((time) => time >= "12:00" && time < "18:00"),
    },
    {
      id: "evening",
      label: t("晚上", "Evening"),
      values: times.filter((time) => time >= "18:00"),
    },
  ].filter((group) => group.values.length);
  const activeTimeGroup =
    timeGroups.find((group) => group.id === timePeriod) ?? timeGroups[0];
  const availabilityKey =
    p.onAvailability && route && rate && serviceDate && times.length
      ? `${routeId}|${rateId}|${serviceDate}`
      : "";
  const availabilityCurrent = availability.key === availabilityKey;
  const availabilityReady =
    availabilityCurrent && availability.status === "ready";
  const availabilityLoading =
    Boolean(availabilityKey) &&
    (!availabilityCurrent || availability.status === "loading");
  const availabilityFailed =
    Boolean(availabilityKey) &&
    availabilityCurrent &&
    availability.status === "error";
  // Passengers never change which vehicle is free (the rate fixes the vehicle class), so the check uses one passenger.
  const loadAvailability = async (signal?: AbortSignal) => {
    const result = await p.onAvailability!(
      { routeId, rateId, date: serviceDate, passengers: 1 },
      signal,
    );
    return Object.fromEntries(
      result.slots.map((slot) => [slot.time, slot.available]),
    ) as Record<string, boolean>;
  };
  useEffect(() => {
    checkSeq.current += 1;
    setTimeCheck("idle");
    if (!availabilityKey) return;
    const controller = new AbortController(),
      key = availabilityKey;
    setAvailability({ key, status: "loading", slots: {} });
    loadAvailability(controller.signal)
      .then((slots) => {
        if (!controller.signal.aborted)
          setAvailability({
            key,
            status: "ready",
            slots,
            receivedAt: Date.now(),
          });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAvailability({ key, status: "error", slots: {} });
      });
    return () => controller.abort();
  }, [availabilityKey]);
  const slotFull = (time: string) =>
    availabilityReady && availability.slots[time] !== true;
  const anySlotOpen =
    !availabilityReady || times.some((time) => !slotFull(time));
  useEffect(() => {
    if (!availabilityReady) return;
    const open = timeGroups.find((group) =>
      group.values.some((time) => availability.slots[time] === true),
    );
    if (
      open &&
      !activeTimeGroup?.values.some((time) => availability.slots[time] === true)
    )
      setTimePeriod(open.id);
  }, [availabilityReady, availabilityKey]);
  async function chooseTime(time: string) {
    const seq = ++checkSeq.current;
    setServiceTime(time);
    setDeparture("");
    setAck(false);
    if (!p.onAvailability) {
      setDeparture(`${serviceDate}T${time}`);
      return;
    }
    setTimeCheck("checking");
    try {
      const age = Date.now() - (availability.receivedAt ?? 0);
      const fresh = availabilityReady && age >= 0 && age < AVAILABILITY_FRESH_MS;
      const slots = fresh ? availability.slots : await loadAvailability();
      if (seq !== checkSeq.current) return;
      if (!fresh)
        setAvailability({
          key: availabilityKey,
          status: "ready",
          slots,
          receivedAt: Date.now(),
        });
      if (slots[time] !== true) {
        setServiceTime("");
        setTimeCheck("taken");
        return;
      }
    } catch {
      // Fail soft: the quote step performs the authoritative vehicle check.
      if (seq !== checkSeq.current) return;
    }
    setDeparture(`${serviceDate}T${time}`);
    setTimeCheck("idle");
  }
  const money = (minor: number) =>
    new Intl.NumberFormat(p.lang === "zh" ? "zh-CA" : "en-CA", {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "code",
    }).format(minor / 100);
  const name = (r: { nameZh: string; nameEn: string }) =>
    p.lang === "zh" ? r.nameZh : r.nameEn;
  const waitingForLocation = t("待選擇", "Choose a location");
  const quotedPickup = selectedPickup
    ? name(selectedPickup)
    : quote?.pickupOptions?.length
      ? waitingForLocation
      : p.journey?.pickup;
  const quotedDropoff = selectedDropoff
    ? name(selectedDropoff)
    : p.journey?.intendedDropoff ?? (quote?.dropoffOptions?.length ? waitingForLocation : undefined);
  const quotedLocationRows = (
    <>
      {quotedPickup && (
        <div>
          <dt>{t("上車地點", "Pickup location")}</dt>
          <dd>{quotedPickup}</dd>
        </div>
      )}
      {quotedDropoff && (
        <div>
          <dt>{!selectedDropoff && p.journey?.intendedDropoff
            ? t("預選下車地", "Intended drop-off")
            : t("下車地點", "Drop-off location")}</dt>
          <dd>{quotedDropoff}</dd>
        </div>
      )}
    </>
  );
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
  const holdDeadline = b?.status === "pending" && Number.isFinite(b.holdUntil)
    ? b.holdUntil
    : 0;
  const holdSeconds = Math.max(0, Math.ceil(holdDeadline - tick / 1000));
  const holdMinutes = Math.floor(holdSeconds / 60);
  const secondsWithinMinute = holdSeconds % 60;
  return (
    <div className="qb-customer">
      <p className="qb-sandbox" role="note">
        <span className="material-icons" aria-hidden="true">info_outline</span>
        <span>
          {t(
            "測試環境 · 不會扣款，也不會安排接送",
            "Test mode · No charge or transfer service",
          )}
        </span>
      </p>
      <div className="qb-public-main">
        {p.showBooking ? (
          <h1 className="qb-status-title qb-detail-title">
            {p.showReceipt ? t("付款收據", "Payment receipt") : t("預訂詳情", "Booking details")}
          </h1>
        ) : (
          <div className="qb-hero">
            {!p.fixedProduct && <h1>{t("你的測試預訂", "Your test booking")}</h1>}
            <div
              className="qb-progress"
              aria-label={t("預訂步驟", "Booking progress")}
            >
              <span
                className={showTrip ? "is-current" : ""}
                aria-current={showTrip ? "step" : undefined}
              >
                1 · {t("行程與報價", "Trip & quote")}
              </span>
              <span
                className={!showTrip ? "is-current" : ""}
                aria-current={!showTrip ? "step" : undefined}
              >
                2 · {t("接送資料", "Transfer details")}
              </span>
              <span>
                3 · {t("測試付款與確認", "Test payment & confirmation")}
              </span>
            </div>
          </div>
        )}
        {p.error && (
          <div className="qt-alert" role="alert" ref={bookingErrorNotice} tabIndex={-1}>
            {p.error}
          </div>
        )}
        {p.showBooking ? (
          <section className="qt-card qb-summary">
            {!b ? (
              <>
                <p role="status">
                  {p.showReceipt
                    ? p.loading
                      ? t("正在載入收據…", "Loading your receipt…")
                      : t("暫時無法顯示收據。", "Your receipt is temporarily unavailable.")
                    : p.loading
                      ? t("正在核對預訂狀態…", "Checking your booking…")
                      : t("目前無法顯示這筆預訂。", "This booking cannot be displayed right now.")}
                </p>
                <div className="qb-public-actions">
                  <button
                    className="qt-btn"
                    onClick={p.onRefresh}
                    disabled={p.busy || p.loading}
                  >
                    {p.showReceipt ? t("重試載入收據", "Retry loading receipt") : t("重新核對", "Check again")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="qb-booking-reference">
                  <span className={"qb-status " + b.status}>
                    {b.status === "confirmed"
                      ? t("測試預訂已確認", "Test booking confirmed")
                      : b.status === "cancelled"
                        ? t("測試預訂已取消", "Test booking cancelled")
                        : t("等待測試付款", "Awaiting test payment")}
                  </span>
                  <h2>{b.reference}</h2>
                </div>
                {b.status === "pending" && (
                  <div className={holdSeconds ? "qb-hold" : "qb-hold qb-hold--ended"}>
                    <p className="qb-hold__label" id={holdLabelId}>
                      {holdSeconds
                        ? t("車位保留倒數", "Vehicle hold countdown")
                        : t("車位保留狀態", "Vehicle hold status")}
                    </p>
                    {holdSeconds > 0 && (
                      <p className="qb-hold__time" role="timer" aria-labelledby={holdLabelId}>
                        <span aria-hidden="true">
                          {String(holdMinutes).padStart(2, "0")}:{String(secondsWithinMinute).padStart(2, "0")}
                        </span>
                        <span className="sr-only">
                          {t(
                            `剩餘 ${holdMinutes} 分 ${secondsWithinMinute} 秒`,
                            `${holdMinutes} minutes and ${secondsWithinMinute} seconds remaining`,
                          )}
                        </span>
                      </p>
                    )}
                    <p className="qb-hold__guidance" role="status">
                      {holdSeconds
                        ? b.canPay && b.paymentState === "unpaid"
                          ? t("請在倒數結束前完成付款。", "Complete payment before the countdown ends.")
                          : t("付款狀態以系統核對結果為準。", "Payment status updates after verification.")
                        : holdDeadline > 0
                          ? t(
                              "車位保留時間已到，請重新核對預訂及付款狀態。",
                              "The hold timer has ended. Refresh to check your booking and payment status.",
                            )
                          : t(
                              "請重新核對付款與車位保留狀態。",
                              "Refresh to check your payment and vehicle hold status.",
                            )}
                    </p>
                  </div>
                )}
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
                    <dd>{formatDepartureLabel(b.departureLabel, p.lang)}</dd>
                  </div>
                  <div>
                    <dt>{t("乘客", "Passengers")}</dt>
                    <dd>{b.passengers}</dd>
                  </div>
                  <div>
                    <dt>{t("整車總額", "Whole-vehicle total")}</dt>
                    <dd>{money(b.amountMinor)}</dd>
                  </div>
                  <PriceLines lang={p.lang} price={b} inline />
                  <div>
                    <dt>{t("付款狀態", "Payment status")}</dt>
                    <dd>
                      {b.paymentState === "refunded"
                        ? t("已退款", "Refunded")
                        : b.paymentState === "paid" && b.amountMinor === 0
                          ? t("無需付款", "No payment required")
                          : b.paymentState === "paid"
                            ? t("已核實測試收款", "Test payment verified")
                            : b.paymentState === "review"
                              ? t("需要人工檢查", "Needs review")
                              : b.paymentState === "pending"
                                ? t("正在核實", "Checking payment")
                                : t("未付款", "Unpaid")}
                    </dd>
                  </div>
                </dl>
                {b.status === "cancelled" && b.paymentNotification && (
                  <p role="status" className="qb-note">
                    {b.paymentState === "refunded"
                      ? t(
                          "這筆預訂已取消，款項已全額退回。退款到帳時間依發卡銀行而定。",
                          "This booking was cancelled and fully refunded. Your bank decides when the refund shows on your statement.",
                        )
                      : t(
                          "這筆預訂已取消。如有退款事宜，我們會另行與你聯絡。",
                          "This booking was cancelled. If a refund applies, we will contact you.",
                        )}
                  </p>
                )}
                {b.status !== "cancelled" && b.paymentNotification && (
                  <p role="status" className="qb-note">
                    {t(
                      "付款已確認。收據已保存，可隨時在此瀏覽器重看。",
                      "Payment confirmed. Your receipt is saved and can be reopened in this browser.",
                    )}
                  </p>
                )}
                {b.status !== "cancelled" && (
                  <CancellationPolicy lang={p.lang} />
                )}
                {b.status === "pending" && p.checkoutError && (
                  <div className="qt-alert" role="alert">
                    <strong>{t("無法開啟測試付款。", "Could not open test payment.")}</strong>{" "}
                    {p.checkoutError}
                  </div>
                )}
                <div className="qb-public-actions">
                  {b.paymentNotification && b.status !== "cancelled" && (
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
                  <p className={p.paymentSetupFailed ? "qt-alert" : "qb-note"} role={p.paymentSetupFailed ? "alert" : "status"}>
                    {p.paymentSetupFailed
                      ? t("暫時無法核對付款設定，請重新核對狀態。", "Payment settings could not be checked. Refresh the booking status to try again.")
                      : p.catalog
                        ? t("此預覽目前尚未連接測試付款。", "Test payments are not connected in this preview.")
                        : t("正在核對測試付款設定…", "Checking test payment settings…")}
                  </p>
                )}
                <p className="qb-note">
                  {t(
                    "請保留預訂編號，並使用原本的瀏覽器查看。這是測試預訂，不會寄出真正的接送通知。",
                    "Keep your booking reference and use this browser to view it. This is a test booking; no actual transfer notification will be sent.",
                  )}
                </p>
                <a className="qt-btn qt-btn--ghost" href={p.transfersPath}>
                  {t("建立另一筆測試預訂", "Start another test booking")}
                </a>
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
              {!showTrip && (
                <div className="qt-card qb-trip-review">
                  <div>
                    <span className="qb-eyebrow">
                      {t("行程已選好", "Your trip is ready")}
                    </span>
                    <h2 ref={tripReviewHeading} tabIndex={-1}>
                      {p.journey?.title ?? (route ? name(route) : "")}
                    </h2>
                    <p>
                      {quote
                        ? formatDepartureLabel(quote.departureLabel, p.lang)
                        : ""}{" "}
                      · {passengers} {t("位乘客", "passengers")}
                      {p.journey && (
                        <>{" "}<span className="whitespace-nowrap">· {t(`${p.journey.seater} 座車型`, `${p.journey.seater}-seat vehicle`)}</span></>
                      )}
                    </p>
                    {(quotedPickup || quotedDropoff) && (
                      <dl className="qb-trip-review__locations">{quotedLocationRows}</dl>
                    )}
                    {quote && (
                      <p className="qb-trip-review__total">
                        <span>
                          {t(
                            "整車總額（含燃油附加費與 GST）",
                            "Vehicle total (includes fuel surcharge and GST)",
                          )}
                        </span>
                        <strong>{money(quote.amountMinor)}</strong>
                      </p>
                    )}
                  </div>
                  <button
                    className="qt-btn"
                    type="button"
                    disabled={p.busy}
                    onClick={() => setEditingTrip(true)}
                  >
                    {t("修改行程", "Edit trip")}
                  </button>
                </div>
              )}
              {showTrip && (
                <form
                  className="qt-card qb-trip-form"
                  data-fixed-route={p.fixedProduct}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (
                      !quoteDisabled &&
                      route &&
                      rate &&
                      (!route.serviceRules ||
                        (serviceDateIsAllowed && times.includes(serviceTime)))
                    )
                      p.onQuote({
                        routeId,
                        rateId,
                        departureLocal: departure,
                        passengers,
                        ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
                      });
                  }}
                >
                  <h2>{t("選擇出發日期與時間", "Choose a date and time")}</h2>
                  {p.journey && (
                    <div className="qb-entry-journey">
                      <p>
                        <span>{t("本次接送", "This transfer")}</span>
                        <strong>{p.journey.title}</strong>
                      </p>
                      {p.journey.referencePrice && (
                        <p>
                          <span>{t("每車參考價", "Reference price per vehicle")}</span>
                          <strong>{p.journey.referencePrice}</strong>
                        </p>
                      )}
                    </div>
                  )}
                  <fieldset className="qb-fields" disabled={p.busy}>
                    {!p.initialRateId && <label className="qt-field qb-full qb-vehicle-choice">
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
                            updateTripDraft({ serviceDate: "" });
                            setServiceTime("");
                            setDeparture("");
                          } else if (!nextTimes.includes(serviceTime)) {
                            setServiceTime("");
                            setDeparture("");
                          }
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
                    </label>}
                    {route?.serviceRules ? (
                      <>
                        <div className="qb-full qb-date-time">
                          <div className="qb-date-panel">
                            <h3>{t("選擇日期", "Choose a date")}</h3>
                            <p id={dateGuidanceId} className="qb-date-guidance">
                              <strong>
                                {earliestSelectableDate ? (
                                  <>
                                    {t("最早可選", "Earliest available")}{" "}
                                    <time dateTime={earliestSelectableDate}>
                                      {formatServiceDate(earliestSelectableDate, p.lang)}
                                    </time>
                                  </>
                                ) : t("目前暫無可選日期", "No dates currently available")}
                              </strong>
                              <span>
                                {t(
                                  `需提前 ${leadLabel(route.serviceRules.minLeadMinutes ?? MIN_BOOKING_LEAD_MINUTES, "zh")} 預訂 · 溫哥華當地時間`,
                                  `Book at least ${leadLabel(route.serviceRules.minLeadMinutes ?? MIN_BOOKING_LEAD_MINUTES, "en")} ahead · Vancouver local time`,
                                )}
                              </span>
                            </p>
                            <ServiceCalendar
                              lang={p.lang}
                              value={serviceDate}
                              min={serviceBounds!.min}
                              max={serviceBounds!.max}
                              describedBy={dateGuidanceId}
                              renderMonthPicker={(picker) => (
                                <BookingLocationSelect {...picker} placeholder={picker.label} hideLabel />
                              )}
                              isDateEnabled={calendarDateEnabled}
                              onChange={(date) => {
                                updateTripDraft({ serviceDate: date });
                                setServiceTime("");
                                setDeparture("");
                                setAck(false);
                              }}
                            />
                          </div>
                          <div className="qb-time-panel">
                            <h3>{t("選擇出發時間", "Choose a time")}</h3>
                            <p className="qb-note">
                              {t(
                                "溫哥華當地時間 · 24 小時制",
                                "Vancouver local time · 24-hour clock",
                              )}
                            </p>
                            {!serviceDate ? (
                              <div className="qb-time-empty">
                                {t(
                                  "先選日期，再選出發時間",
                                  "Choose a date to see service times",
                                )}
                              </div>
                            ) : (
                              <>
                                <div
                                  className="qb-time-periods"
                                  aria-label={t("時段", "Time of day")}
                                >
                                  {timeGroups.map((group) => (
                                    <button
                                      type="button"
                                      key={group.id}
                                      aria-pressed={
                                        activeTimeGroup?.id === group.id
                                      }
                                      onClick={() => setTimePeriod(group.id)}
                                    >
                                      {group.label}
                                    </button>
                                  ))}
                                </div>
                                <div
                                  className="qb-time-slots"
                                  role="group"
                                  aria-label={t("出發時間", "Departure time")}
                                >
                                  {activeTimeGroup?.values.map((time) => {
                                    const full = slotFull(time);
                                    return (
                                      <button
                                        type="button"
                                        key={time}
                                        className={
                                          full ? "qb-slot-full" : undefined
                                        }
                                        aria-pressed={serviceTime === time}
                                        disabled={
                                          full ||
                                          availabilityLoading ||
                                          timeCheck === "checking"
                                        }
                                        aria-label={
                                          full
                                            ? `${time} ${t("已滿", "unavailable")}`
                                            : undefined
                                        }
                                        onClick={() => void chooseTime(time)}
                                      >
                                        {time}
                                        {full && (
                                          <small>{t("已滿", "Full")}</small>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                                {availabilityLoading ? (
                                  <p className="qb-note" role="status">
                                    {t(
                                      "正在核對車位…",
                                      "Checking vehicle availability…",
                                    )}
                                  </p>
                                ) : availabilityFailed ? (
                                  <p className="qb-note" role="status">
                                    {t(
                                      "暫時無法核對車位；下一步仍會再確認。",
                                      "We could not check availability right now; the next step still verifies it.",
                                    )}
                                  </p>
                                ) : availabilityReady && !anySlotOpen ? (
                                  <p className="qb-note" role="alert">
                                    {t(
                                      "這一天已沒有可用時段，請另選日期。",
                                      "No vehicle is free on this date. Choose another date.",
                                    )}
                                  </p>
                                ) : null}
                                {timeCheck === "checking" && (
                                  <p className="qb-note" role="status">
                                    {t(
                                      "正在確認這個時段…",
                                      "Confirming this time…",
                                    )}
                                  </p>
                                )}
                                {timeCheck === "taken" && (
                                  <p
                                    className="qb-note qb-time-taken"
                                    role="alert"
                                  >
                                    {t(
                                      "這個時段剛剛已被預訂，請選擇其他時間。",
                                      "That time was just taken. Please choose another time.",
                                    )}
                                  </p>
                                )}
                                {serviceTime && timeCheck !== "taken" && (
                                  <p className="qb-time-selected" role="status">
                                    {t("已選", "Selected")}:{" "}
                                    {timeLabel(serviceTime)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
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
                    {p.vehicleSelector}
                    <div className="qt-field qb-full qb-passenger-field">
                      <div className="qb-passenger-label">
                        <label id={`${passengerId}-label`} htmlFor={passengerId}>
                          {t("乘客人數", "Passengers")}
                        </label>
                        {rate && (
                          <p id={`${passengerId}-limit`} className="qb-note">
                            {t(
                              `一輛車，最多 ${maxPassengers} 位乘客`,
                              `One vehicle, up to ${maxPassengers} passengers`,
                            )}
                          </p>
                        )}
                      </div>
                      <div
                        className="qb-passenger-control"
                        role="group"
                        aria-labelledby={`${passengerId}-label`}
                      >
                        <button
                          type="button"
                          aria-label={t("減少乘客", "Remove a passenger")}
                          disabled={passengers <= 0}
                          onClick={() => {
                            updateTripDraft({ passengers: Math.max(0, Math.ceil(passengers) - 1) });
                            setAck(false);
                          }}
                        >
                          −
                        </button>
                        <input
                          id={passengerId}
                          type="number"
                          inputMode="numeric"
                          required
                          min={0}
                          max={maxPassengers}
                          step={1}
                          value={passengers}
                          aria-invalid={invalidPassengers && !missingPassengers ? true : undefined}
                          aria-describedby={passengerDescription || undefined}
                          onChange={(e) => {
                            updateTripDraft({ passengers: Number(e.target.value) });
                            setAck(false);
                          }}
                        />
                        <button
                          type="button"
                          aria-label={t("增加乘客", "Add a passenger")}
                          disabled={passengers >= maxPassengers}
                          onClick={() => {
                            updateTripDraft({ passengers: Math.min(maxPassengers, Math.max(1, Math.floor(passengers) + 1)) });
                            setAck(false);
                          }}
                        >
                          +
                        </button>
                      </div>
                      <output className="sr-only" htmlFor={passengerId}>
                        {t(`${passengers} 位乘客`, `${passengers} passengers`)}
                      </output>
                      {passengerHint && (
                        <p
                          id={`${passengerId}-hint`}
                          className={missingPassengers ? "qb-note qb-passenger-hint" : "qb-quote-readiness qb-passenger-hint"}
                          role="status"
                        >
                          {passengerHint}
                        </p>
                      )}
                    </div>
                    <label className="qt-field qb-full qb-coupon">
                      <span>
                        {t("優惠碼（選填）", "Promo code (optional)")}
                      </span>
                      <input
                        value={coupon}
                        maxLength={32}
                        autoComplete="off"
                        autoCapitalize="characters"
                        spellCheck={false}
                        onChange={(e) => {
                          updateTripDraft({ coupon: e.target.value });
                          setAck(false);
                        }}
                      />
                    </label>
                  </fieldset>
                  <p className="qb-note">
                    {route?.serviceRules
                      ? t(
                          "下一步會核對價格與車位；取得報價不會保留車位。",
                          "The next step verifies price and vehicle availability; a quote does not hold a vehicle.",
                        )
                      : t(
                          "目前測試設定：提前至少1小時、最多366天。取得報價時不會保留車位。",
                          "Test settings: book 1 hour to 366 days ahead. A quote does not hold a vehicle.",
                        )}
                  </p>
                  <button
                    className="qt-btn qt-btn--primary"
                    disabled={quoteDisabled}
                  >
                    {p.busy
                      ? t("核對中…", "Checking…")
                      : t("查看報價及繼續 →", "Review quote & continue →")}
                  </button>
                  {quoteDisabledReason && (
                    <p className="qb-quote-readiness" role="status">
                      {quoteDisabledReason}
                    </p>
                  )}
                </form>
              )}
              {quote && quoteValid && !showTrip && (
                <form
                  className="qt-card"
                  style={{ marginTop: 22 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!p.busy && ack)
                      p.onReserve({
                        ...customer,
                        flightNumber: "",
                        pickupAddress: askPickupAddress
                          ? customer.pickupAddress
                          : "",
                        dropoffAddress: askDropoffAddress
                          ? customer.dropoffAddress
                          : "",
                      });
                  }}
                >
                  <h2>{t("接送與聯絡資料", "Transfer & contact details")}</h2>
                  <p className="qb-note qb-form-intro">
                    {t(
                      "填寫接送地點及聯絡方式，方便安排你的行程。",
                      "Add your pickup, destination and contact details.",
                    )}
                  </p>
                  <fieldset className="qb-fields" disabled={p.busy}>
                    {quote.pickupOptions && quote.pickupOptions.length > 1 ? (
                      <BookingLocationSelect
                        label={t(
                          "上車航廈／地點",
                          "Pickup terminal / location",
                        )}
                        placeholder={t(
                          "請選擇上車地點",
                          "Choose a pickup location",
                        )}
                        value={customer.pickupLocationId ?? ""}
                        options={quote.pickupOptions.map((option) => ({
                          id: option.id,
                          label: name(option),
                        }))}
                        onChange={(id) =>
                          setCustomer((current) => ({
                            ...current,
                            pickupLocationId: id,
                            pickupAddress: "",
                          }))
                        }
                        required
                      />
                    ) : null}
                    {quote.dropoffOptions && quote.dropoffOptions.length > 1 ? (
                      <BookingLocationSelect
                        label={t("下車地點", "Drop-off location")}
                        placeholder={t(
                          "請選擇下車地點",
                          "Choose a drop-off location",
                        )}
                        value={customer.dropoffLocationId ?? ""}
                        options={quote.dropoffOptions.map((option) => ({
                          id: option.id,
                          label: name(option),
                        }))}
                        onChange={(id) =>
                          setCustomer((current) => ({
                            ...current,
                            dropoffLocationId: id,
                            dropoffAddress: "",
                          }))
                        }
                        required
                      />
                    ) : null}
                    {field("name", t("姓名", "Full name"), "text", true, 100)}
                    {field("email", t("電郵", "Email"), "email", true, 254)}
                    {field("phone", t("電話", "Phone"), "tel", true, 40)}
                    {askPickupAddress
                      ? field(
                          "pickupAddress",
                          t("詳細上車地址", "Detailed pickup address"),
                        )
                      : null}
                    {askDropoffAddress
                      ? field(
                          "dropoffAddress",
                          t("詳細下車地址", "Detailed drop-off address"),
                        )
                      : null}
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
                  <CancellationPolicy lang={p.lang} />
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
                          "確認資料，建立測試預訂 →",
                          "Confirm details & create test booking →",
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
              {p.journey ? (
                <p className="qb-summary__journey">{p.journey.title}</p>
              ) : route && (
                <p>
                  {p.lang === "zh" ? route.pickupZh : route.pickupEn} →{" "}
                  {p.lang === "zh" ? route.dropoffZh : route.dropoffEn}
                </p>
              )}
              {matches && quote ? (
                <>
                  <div className="qb-summary__total" data-confirmed={!showTrip}>
                    <p className="qb-quote-amount">
                      {money(quote.amountMinor)}
                    </p>
                    <p className="qb-note">
                      {t(
                        "每輛整車測試總額（含燃油附加費與 GST）",
                        "Test total for one whole vehicle (includes fuel surcharge and GST)",
                      )}
                    </p>
                  </div>
                  <PriceLines lang={p.lang} price={quote} />
                  <dl>
                    {quotedLocationRows}
                    <div>
                      <dt>{t("車型", "Vehicle")}</dt>
                      <dd>{p.journey
                        ? t(`${p.journey.seater} 座`, `${p.journey.seater} seats`)
                        : t(quote.rateNameZh, quote.rateNameEn)}</dd>
                    </div>
                    {p.journey?.serviceArea && (
                      <div>
                        <dt>{t("服務範圍", "Service area")}</dt>
                        <dd>{p.journey.serviceArea}</dd>
                      </div>
                    )}
                    <div>
                      <dt>{t("出發", "Departure")}</dt>
                      <dd>
                        {formatDepartureLabel(quote.departureLabel, p.lang)}
                      </dd>
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
                <>
                  <dl>
                    <div>
                      <dt>{t("車型", "Vehicle")}</dt>
                      <dd>
                        {rate ? name(rate) : t("尚未選擇", "Not selected")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("日期", "Date")}</dt>
                      <dd>
                        {serviceDate
                          ? formatServiceDate(serviceDate, p.lang)
                          : t("尚未選擇", "Not selected")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("時間", "Time")}</dt>
                      <dd>
                        {serviceTime
                          ? timeLabel(serviceTime)
                          : t("尚未選擇", "Not selected")}
                      </dd>
                    </div>
                    <div>
                      <dt>{t("乘客", "Passengers")}</dt>
                      <dd>{missingPassengers ? t("尚未選擇", "Not selected") : passengers}</dd>
                    </div>
                  </dl>
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
                </>
              )}
              <div className="qb-summary-help">
                {t("需要協助安排？", "Need a hand planning?")}{" "}
                <a href={p.lang === "zh" ? "/zh/contact" : "/contact"}>
                  {t("聯絡我們", "Contact us")} →
                </a>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
