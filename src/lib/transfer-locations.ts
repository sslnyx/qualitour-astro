/** Display names for the Zaui route snapshot's English-only locations on the Chinese pages. */
const ZH: Record<string, string> = {
  "Abbotsford (YXX) Airport": "阿伯茨福德機場（YXX）",
  "Canada Place Cruise Terminal": "加拿大廣場郵輪碼頭",
  "Greater Vancouver": "大溫哥華地區",
  "Greater Vancouver (Zone 1)": "大溫哥華（1 區）",
  "Greater Vancouver (Zone 2)": "大溫哥華（2 區）",
  "Greater Vancouver (Zone 3)": "大溫哥華（3 區）",
  Seattle: "西雅圖",
  "Sun Peaks": "Sun Peaks（太陽峰）",
  Vancouver: "溫哥華",
  "Vancouver / YVR": "溫哥華／YVR 機場",
  "Vancouver Airport (YVR)": "溫哥華機場（YVR）",
  Whistler: "Whistler",
};
export const localizedLocation = (name: string, lang: "en" | "zh") =>
  lang === "zh" ? (ZH[name] ?? name) : name;
