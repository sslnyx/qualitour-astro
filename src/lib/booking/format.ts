const ZH_TIME_ZONE = "（溫哥華時間）";
const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const clock = (hour: number, minute: number, lang: "en" | "zh") =>
  lang === "zh"
    ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
    : `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
/** "2026-11-20" -> "2026年11月20日" / "Nov 20, 2026". Returns the input when it is not an ISO date. */
export function formatServiceDate(value: string, lang: "en" | "zh") {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return lang === "zh"
    ? `${year}年${month}月${day}日`
    : `${EN_MONTHS[month - 1]} ${day}, ${year}`;
}
/** Turns the server label "2026/11/20 10:00 [GMT-7]" into a readable Vancouver-time label. */
export function formatDepartureLabel(label: string, lang: "en" | "zh") {
  const m = /^(\d{4})[/-](\d{2})[/-](\d{2})[ T](\d{2}):(\d{2})/.exec(label);
  if (!m) return label;
  const date = formatServiceDate(`${m[1]}-${m[2]}-${m[3]}`, lang),
    time = clock(Number(m[4]), Number(m[5]), lang);
  return lang === "zh"
    ? `${date} ${time}${ZH_TIME_ZONE}`
    : `${date}, ${time} (Vancouver time)`;
}
