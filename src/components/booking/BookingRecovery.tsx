import PriceLines from "./PriceLines";
import type { GuestBooking, BookingReceipt } from "../../lib/booking/contracts";
import { formatDepartureLabel } from "../../lib/booking/format";
export function BookingRecovery(p: {
  bookings: GuestBooking[];
  lang: "zh" | "en";
  loading: boolean;
  error: string;
  onRefresh: () => void;
}) {
  const t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  return (
    <section className="qt-card qb-recovery" aria-labelledby="recovery-heading">
      <h2 id="recovery-heading">{t("找回你的預訂", "Your recent bookings")}</h2>
      <p className="qb-note">
        {t(
          "同一瀏覽器可找回最近 20 筆預訂。身分保留 7 天；清除 Cookie 或換裝置後無法在此找回。",
          "This browser can recover your 20 most recent bookings. Browser identity lasts 7 days; clearing cookies or switching devices removes access.",
        )}
      </p>
      {p.error && <p role="alert">{p.error}</p>}
      {!p.bookings.length && (
        <p>
          {p.loading
            ? t("正在找回預訂…", "Finding bookings…")
            : t(
                "這個瀏覽器目前沒有預訂。",
                "No bookings found in this browser.",
              )}
        </p>
      )}
      <ul className="qb-recent-list">
        {p.bookings.map((b) => {
          const state = b.paymentNotification
            ? "paid"
            : b.paymentState === "review"
              ? "review"
              : b.status === "cancelled"
                ? "cancelled"
                : "pending";
          const label = {
            paid: t("付款已確認", "Payment confirmed"),
            review: t("付款需要核對", "Payment needs review"),
            cancelled: t("已取消", "Cancelled"),
            pending: t("待付款／核對", "Awaiting payment / verification"),
          }[state];
          const manage =
            "/book/manage/" + encodeURIComponent(b.id) + "?lang=" + p.lang;
          return (
            <li key={b.id} className="qb-recent-item">
              <div className="qb-recent-head">
                <strong>{b.reference}</strong>
                <span className={"qb-status qb-status--" + state}>{label}</span>
              </div>
              <span className="qb-recent-route">
                {p.lang === "zh" ? b.routeNameZh : b.routeNameEn}
              </span>
              <span className="qb-note">
                {formatDepartureLabel(b.departureLabel, p.lang)}
              </span>
              <div className="qb-recent-actions">
                <a className="qb-recent-open" href={manage}>
                  {t("查看預訂", "View booking")}{" "}
                  <span aria-hidden="true">→</span>
                </a>
                {b.paymentNotification ? (
                  <a
                    className="qb-recent-receipt"
                    href={
                      "/book/receipt/" +
                      encodeURIComponent(b.id) +
                      "?lang=" +
                      p.lang
                    }
                  >
                    {t("查看收據", "View receipt")}
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="qt-btn"
        disabled={p.loading}
        onClick={p.onRefresh}
      >
        {t("重新找回預訂", "Refresh bookings")}
      </button>
    </section>
  );
}
export function ReceiptView(p: {
  receipt: BookingReceipt;
  lang: "zh" | "en";
  onBack: () => void;
  onPrint: () => void;
}) {
  const r = p.receipt,
    t = (zh: string, en: string) => (p.lang === "zh" ? zh : en);
  return (
    <section className="qt-card qb-receipt" aria-labelledby="receipt-heading">
      <p className="qb-status confirmed">
        {t("付款已確認", "Payment confirmed")}
      </p>
      <h1 id="receipt-heading">
        {t("Sandbox 付款收據", "Sandbox payment receipt")}
      </h1>
      <p className="qb-note">
        {t(
          "此為測試收據，沒有真實扣款，不是稅務發票，也不代表已安排真實接送。",
          "This is a test receipt, with no real charge or travel service. It is not a tax invoice.",
        )}
      </p>
      <dl>
        <div>
          <dt>{t("收據編號", "Receipt reference")}</dt>
          <dd>{r.reference}</dd>
        </div>
        <div>
          <dt>{t("預訂編號", "Booking reference")}</dt>
          <dd>{r.bookingReference}</dd>
        </div>
        <div>
          <dt>{t("路線", "Route")}</dt>
          <dd>{p.lang === "zh" ? r.routeNameZh : r.routeNameEn}</dd>
        </div>
        {r.pickupLocation ? (
          <div>
            <dt>{t("上車航廈／地點", "Pickup terminal / location")}</dt>
            <dd>
              {p.lang === "zh"
                ? r.pickupLocation.nameZh
                : r.pickupLocation.nameEn}
            </dd>
          </div>
        ) : null}
        {r.dropoffLocation ? (
          <div>
            <dt>{t("下車地點", "Drop-off location")}</dt>
            <dd>
              {p.lang === "zh"
                ? r.dropoffLocation.nameZh
                : r.dropoffLocation.nameEn}
            </dd>
          </div>
        ) : null}
        <div>
          <dt>{t("出發時間（溫哥華）", "Departure (Vancouver)")}</dt>
          <dd>{formatDepartureLabel(r.departureLabel, p.lang)}</dd>
        </div>
        <div>
          <dt>{t("乘客", "Passengers")}</dt>
          <dd>{r.passengers}</dd>
        </div>
        <div>
          <dt>{t("已核實收款", "Verified amount paid")}</dt>
          <dd>
            {new Intl.NumberFormat(p.lang === "zh" ? "zh-CA" : "en-CA", {
              style: "currency",
              currency: r.currency,
              currencyDisplay: "code",
            }).format(r.amountMinor / 100)}
          </dd>
        </div>
        <div>
          <dt>{t("收費明細", "Charge breakdown")}</dt>
          <dd>
            <PriceLines lang={p.lang} price={r} currency={r.currency} />
          </dd>
        </div>
        <div>
          <dt>{t("收據建立時間", "Receipt created at")}</dt>
          <dd>
            {new Date(r.confirmedAt * 1000)
              .toISOString()
              .replace("T", " ")
              .replace(".000Z", " UTC")}
          </dd>
        </div>
      </dl>
      <div className="qb-public-actions qb-no-print">
        <button className="qt-btn qt-btn--primary" onClick={p.onPrint}>
          {t("列印收據", "Print receipt")}
        </button>
        <button className="qt-btn" onClick={p.onBack}>
          {t("返回預訂", "Back to booking")}
        </button>
      </div>
    </section>
  );
}
