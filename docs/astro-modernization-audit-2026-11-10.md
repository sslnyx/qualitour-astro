# Qualitour Astro 更新與 SEO 優化檢查

日期：2026-11-10（Vancouver）。檢查版本：GitHub main `714b1d9`，實作 worktree `/tmp/qualitour-github-staging-20261110`。原始 checkout 的未發布首頁 review/featured 修改保持原狀。本輪是檢查與設計，沒有安裝新依賴、改程式、觸發發布或修改 WordPress 正式站。

## 建議架構

保留 Astro + React + WordPress + cPanel 靜態託管。WordPress 管內容；GitHub 在建置時取得一致的內容快照，Astro 產生完整 HTML；React 負責搜尋、分頁、頁籤與查詢表單。主要標題、行程文字、價格說明、連結和 metadata 不依賴瀏覽器 API 才出現。內容預渲染與資料快取共同設計，不能用空殼 HTML 來縮短 build。

cPanel 靜態託管不需要 Cloudflare runtime adapter。預設 build/dev/preview 應與 cPanel 目標一致；若仍保留 Cloudflare 舊部署，應獨立明確命令與設定，不把兩套預設混在一起。保持目前 `/staging` 路線及外觀，正式上線另有 root 目標，不在這次更新中切換正式站。

## 實證問題

| 優先 | 問題 | 實際證據與影響 |
|---|---|---|
| P0 | 行程主要內容僅 client fetch | 255 個詳情頁全部沒有初始 H1，title 全部為 `Tour | Qualitour`。`TourPageClient.tsx` 初始 loading=true，在 effect 才讀 WordPress。Google 可能延後渲染；分享抓取器與其他機器人未必執行 JS。不是「Google 絕對看不到」，但目前內容交付不穩定。 |
| P0 | Canonical 帶 `.html` | 255 個詳情頁皆指向 `.html`，但導覽使用 extensionless URL；Apache 尚無外部 `.html` →乾淨 URL 301，存在重複版本。 |
| P0 | staging 可索引 | 一般頁面 meta index/follow，回應沒有 staging noindex；`/staging/robots.txt` 不控制全網域，root WordPress robots 目前沒有排除 staging。應在 staging 自身回應加 noindex，讓爬蟲可讀取此標籤；不改 root 正式站 robots。 |
| P0（正式切換前） | 舊新網址不同 | 正式 WordPress sitemap 有192個英文 tour URLs，使用 `/tour/<slug>/`；Astro 用 `/tours/<slug>`。不能直接替換正式站。需來源 inventory、逐一映射，保留舊 URL 或單跳301；缺失頁回404/410，不能全部轉首頁。 |
| P1 | 沒有 Astro sitemap/hreflang | 未找到 sitemap 產生器、輸出 sitemap、hreflang。staging public/robots 指向過時 isquarestudio 網域。需將 sitemap、canonical、alternate 由同一份發布 URL 清單產生。 |
| P1 | build 目標不一致 | `astro.config.mjs` 是 Cloudflare server output、舊 site host、自訂 `/api/image`；cpanel config 卻是 static。`build` 與 `build:cpanel` 行為不同，後者仍要暫移 API 來源。 |
| P1 | 資料快取契約不足 | 列表端點刻意只輸出摘要，請求 content/goodlayers/modified 也不會得到它們。完整詳情需要既有單項端點。不可用列表 hash 判定內文未變；否則內文修改不會失效快取。 |
| P2 | JS 與首屏資源 | React client runtime 未壓縮約182KiB。SEO 文字應先輸出HTML，表單/評論盡量分離互動島。重點是量測實際 LCP/INP/CLS、壓縮後傳輸，不以這個檔案大小直接推算分數。 |

既有有效部分：所有行程 slug 在 build 時列舉；發布前核對英文192/中文63與詳情路徑；部署使用 checksum 增量上傳，先備份、先資產後 HTML、失敗還原；404 meta noindex；接送 JSON 9路線共用首頁前三組。這些應保留。

## 版本與遷移

lockfile Astro5.16.6、Vite6.4.1、@astrojs/react4.4.2、React19.2.3、Cloudflare adapter12.6.12。2026-11-10 查 registry，Astro latest7.4.10、React integration7.1.7。Astro7.4 有正式 build `--timings`；其最低 Node>=22.23.4，需連同 CI/dev runtime 檢查。不要單獨套用最新 integration 或一次升所有依賴。

沿官方 v5→v6→v7 遷移指引，分兩個可回退步驟；每一步都先跑套件相依檢查、型別/既有18個測試、完整 build、route inventory 對照，尤其留意中文 percent-encoded 路由、import.meta.env 內嵌與 build compiler/Vite 變動。新增版本的實驗性平行渲染與增量建置先不啟用，待標準流程穩定且量測證實需要再評估。

## 可驗收的實作順序

### 第一輪：先修 HTML 與 SEO 契約

- 建立 `src/lib/site-config.ts` 和 `src/lib/seo.ts`：統一 environment、site/base、乾淨 public URL、canonical、OG、語言資訊。對根目錄/zh、中文slug、`.html`、query/fragment 做具體測試。
- 修改 `src/pages/[...lang]/tours/[slug].astro` 與 `TourPageClient.tsx`：build 時提供完整 tour props 與唯一 title/description/OG；初始 React state 直接顯示內容。進一步將大塊只讀文字移到 Astro，保留有互動的頁籤/表單。API 暫時不可用不應讓已發布頁面變成載入錯誤。
- 詳情取得使用有界併發（先4）、同一份一致快照；失敗停止發布，不輸出部分資料。每次發布確保最新。若要跨 build 快取，需可靠的 modified/ETag 或完整 webhook 變更集合；目前摘要端點不具這項契約。
- SeoHead/Layout：canonical 去除檔名副檔名，所有內部連結/OG/sitemap一致；只對存在的對應語言產生 hreflang，不憑 slug 猜翻譯。以繁體中文 `zh-Hant`/適當地區標記，不能把目前混用簡體的文字一律聲稱是繁體。
- 結構化資料先加入 Organization/WebSite/BreadcrumbList；TouristTrip/Offer 只使用真實欄位。不可把全站 generic Google reviews 包裝成該行程評分，也不補造幣別/日期/庫存。結構化資料不等於保證 rich result。
- staging加 meta/header noindex；正式環境保持可索引。設定不同 target 的 robots、sitemap及Apache規則。canonical正規化301不套用到資產/API。

### 第二輪：統一設定與升級

- cPanel作為明確預設：`npm run dev`、`build`、`preview`在同一 hosting/base/site 契約下工作；移走 Cloudflare-only API 至獨立來源並只在該 target 註冊，取消 build 時暫移檔案。
- Node版本、packageManager與lockfile固定；官方依賴按 major step 升級，保持 React/adapter 相容；把不再使用的 hosting adapter 從預設建置鏈移除，保留需求先確認，不擅自關閉別的部署。
- 建置資料/API認證模組與可進瀏覽器的 URL/helper 分開；只讓 PUBLIC_* 明確對外值進 client bundle，不把 WORDPRESS_* 整個前綴宣告為瀏覽器環境變數。
- GitHub加型別/SEO契約檢查、`--timings`與產物大小紀錄；保留增量發布和回復機制。CI量測分別記錄取資料、build、圖片、傳輸，冷/暖快取分開。
- 未更改版本的重跑已實測62秒、0/421檔案上傳。新架構完整HTML的 build 成本需另量測，不承諾升版本必然更快。

### 第三輪：正式站切換前的 SEO 驗收

- 建立 root WordPress 中英文 sitemaps/URL inventory，記錄舊 URL、ID、語言、目標與狀態。不能只處理英文 sitemap或只處理行程頁。
- 所有舊正式 URLs 在測試環境驗證保留或單跳永久轉址到正確內容；不能404、循環、跨語言錯配或全部指向首頁。
- 所有可索引行程在不用JS時就有唯一title、description、H1、主要文字和連結；canonical唯一、乾淨且正確語言，hreflang reciprocal，sitemap僅列正式canonical URLs。
- staging noindex/正式可索引規則做自動反例檢查，禁止將測試站設定帶上正式站。
- 測試桌面與窄版內容、頁籤、搜尋、照片、PDF連結、表單配置；未經授權不送查詢/下單。無JS內容測試與表單送達測試分開報告。
- 正式切換前用真實部署條件做可回復演練；現有413檔備份雜湊通過不能稱作已做復原演練。
- 正式切換後監看 Search Console sitemap、索引、404、canonical選擇與 Core Web Vitals。這是控制技術遷移風險，不能承諾排名完全不波動。

## 範圍與限制

本輪查閱官方文件、registry版本、本機已發布版程式與358份產物、正式HTTP回應和WordPress sitemap；另有一位獨立只讀來源覆核者核對SEO路徑。沒有新跑 Core Web Vitals／Lighthouse，沒有 Search Console存取、中文正式URL完整inventory、實際依賴升級或新版本build。沒有任何正式站、staging、GitHubmain或依賴改動。這份文件是具體實作計畫，不是已完成更新的宣稱。

## 官方來源

- [Astro v6 migration](https://docs.astro.build/en/guides/upgrade-to/v6/)
- [Astro v7 migration](https://docs.astro.build/en/guides/upgrade-to/v7/)
- [Astro7.4 build timings](https://astro.build/blog/astro-740/)
- [Astro static data and props](https://docs.astro.build/en/guides/content-collections/)
- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google site migration](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Google noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
