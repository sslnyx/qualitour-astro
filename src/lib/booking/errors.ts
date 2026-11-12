import { ApiError } from "./api";
const messages: Record<string, [string, string]> = {
  RECEIPT_NOT_READY: [
    "付款尚未核實，暫時無法提供收據。請返回預訂重新核對。",
    "Payment is not verified yet. Please return to your booking and refresh its status.",
  ],
  INVALID_INPUT: [
    "請檢查輸入資料後重試。",
    "Please check your entries and try again.",
  ],
  INVALID_LOCAL_TIME: [
    "請輸入有效的溫哥華當地時間。",
    "Please enter a valid Vancouver local date and time.",
  ],
  DEPARTURE_OUT_OF_RANGE: [
    "目前測試接受提前1小時至366天的預訂。",
    "Test bookings must be 1 hour to 366 days ahead.",
  ],
  RATE_UNAVAILABLE: [
    "這個日期、人數或方案目前無法預訂，請重新選擇。",
    "This date, passenger count or option is unavailable. Please choose again.",
  ],
  NO_AVAILABILITY: [
    "這個時段沒有可用車輛，請選擇其他時間。",
    "No vehicle is available for this time. Please choose another time.",
  ],
  BOOKING_UNAVAILABLE: [
    "價格、報價或車位已更新，請重新取得報價。",
    "The quote, price or availability has changed. Please request a new quote.",
  ],
  QUOTE_ALREADY_USED: [
    "這份報價已建立預訂，請查看原本的預訂。",
    "This quote has already been booked. Please view the original booking.",
  ],
  IDEMPOTENCY_CONFLICT: [
    "已提交的資料與這次不同，請查看原本的預訂。",
    "These details differ from your previous submission. Please check the original booking.",
  ],
  BOOKING_STATE_CHANGED: [
    "預訂或付款狀態已更新，請重新核對。",
    "The booking or payment status has changed. Please refresh.",
  ],
  HOLD_EXPIRED: [
    "原本的車位暫留已到期，請重新預訂。",
    "The initial vehicle hold has expired. Please start a new booking.",
  ],
  PAYMENT_REVIEW: [
    "付款需要人工檢查，目前不會釋放車位。",
    "This payment needs review. The vehicle will remain held.",
  ],
  PAYMENT_PENDING: [
    "付款狀態尚待確認。請重新核對，不要另建重複訂單。",
    "Payment is awaiting verification. Please refresh; do not create a duplicate booking.",
  ],
  PAYMENTS_UNAVAILABLE: [
    "測試付款暫時無法連線，請稍後再試。",
    "Test payments are temporarily unavailable. Please try again shortly.",
  ],
  PAYMENTS_NOT_CONFIGURED: [
    "這個預覽目前尚未連接測試付款。",
    "Test payments are not connected in this preview.",
  ],
  NOT_FOUND: [
    "這個連結目前無法在此瀏覽器開啟，請使用原本預訂的瀏覽器。",
    "This link cannot be opened in this browser. Please use the browser where you made the booking.",
  ],
  FORBIDDEN_ORIGIN: [
    "請從原本的預訂入口重新開啟。",
    "Please reopen the original booking page.",
  ],
};
export function bookingMessage(error: unknown, lang: "en" | "zh") {
  if (error instanceof ApiError) {
    if (error.status === 429)
      return lang === "zh"
        ? "請求較頻繁，請稍後再試。"
        : "Too many requests. Please try again shortly.";
    const m = messages[error.code];
    if (m) return m[lang === "zh" ? 0 : 1];
  }
  return lang === "zh"
    ? "暫時無法完成，請重新核對或稍後重試。"
    : "We could not complete this request. Please refresh or try again shortly.";
}
