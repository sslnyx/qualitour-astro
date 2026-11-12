# Qualitour 全站原生 CMS 更新 — Claude 接手

更新：2026-11-12，America/Vancouver。**Ning 已要求先停在這裡，交給另一個 Claude session 接續。Codex 已停止開發／部署；沒有在途子 agent 或本任務建置／發布程序。**

## 1. 使用者目標與目前狀態

使用者已批准：把之前成功的小範圍 EmDash 原生自動更新擴至全站，**外觀、既有網址與 SEO 保持不變**。繼續使用同一個 `qualitour` Worker，保留資料、圖片優化、登入與 Sandbox booking。

**全站版本已實作、提交、完整建置，但尚未部署。** 最後獨立審查仍有兩項 SEO 相關問題待修，見第4節。不要把「建置通過」說成「全站自動更新已上線」。

目前公開站仍是上輪小範圍驗證版：

- https://qualitour.qualitour.workers.dev
- Live source：`ee8ce1e8ec1d18470bc4944e9cb3a4443de08136`，交接前再次公開讀取確認。
- Live Worker version：`d4898633-a94b-4cd0-90b7-4a4cc41b6bed`；deployment `b2feddce-039f-4555-bc48-7558207747a9`。
- 現時只有 `/native-proof/zh` 及該前綴的行程詳情使用原生更新，既有359個前台頁面仍是 static。
- `qualitour.ca` 的 WordPress 正式站與 DNS 沒有改動；workers.dev 仍保留原有 noindex。

## 2. 正確工作目錄及版本

**在這裡接手，不要從舊 redesign worktree 或 dirty main 重做：**

```sh
cd /Users/ning/.codex/worktrees/qualitour-native-proof/qualitour-astro-modernization
git status --short
git branch --show-current
git log -14 --oneline
```

- Branch：`codex/emdash-native-site-20261112`。
- 最新程式 commit：`b9c8f786c9795ed09cb06f7768c269c30296d566`。本 handoff 的 docs-only commit 可能讓 HEAD 再前進。
- 本輪 base：`8c5990c`，其上線程式 base 為前述 `ee8ce1e`。
- 暫停時所有本輪產品程式已提交。只有既有 untracked `.emdash/`、`node_modules`、`output/`；不要 `git add -A`、reset、stash、clean 或掃入它們。
- `node_modules` 是指向 main worktree 的 symlink，**不要提交**；依 packageManager 用 npm，不要新增別的 lockfile或升級套件。
- main `/Users/ning/Local Sites/qualitour/qualitour-astro-modernization` 還有未批准的 GitHub Actions／notifier dirty candidates，**不能拿來部署或混入本輪**。
- 舊 `/Users/ning/.codex/worktrees/qualitour-frontend-rebuild/qualitour-astro-modernization` 是放棄的改版方向，不使用。

主要 commits：

| Commit | 內容 |
| --- | --- |
| `8e40315` | 六個舊頁面的 runtime props fallback、純路由 props resolver |
| `c8e6688` | 原頁型注入 CMS server、runtime aliases、middleware、路由／部署 guard |
| `8ed1642` | 正確覆蓋相對路徑 injected component 的 prerender |
| `5f179ad` | visitor path-only cache key，preview/edit 在 lookup 前拒絕；固定 CMS origin |
| `7f96d61` | 顯式 CMS SEO overlay（仍有審查缺口，見下） |
| `a5898fc` | native catalogue/API/image、原生新行程及 string ID 支援 |
| `fbc573e` | ToursGrid 只傳產品卡／篩選資料，移除所有日程內容的重複傳輸 |
| `ff42e7a` | 不可變 CMS taxonomy 切換基線 |
| `9f1aa33` | 首頁沿用 native hero 真實尺寸／responsive variants |
| `b9c8f78` | 分類相容、明確清空、只公開實際使用的詞彙 |

## 3. 已完成的架構，請沿用

- **直接重用現有 `src/pages`、Layout/Header/Footer/卡片/行程詳情。** 沒有採用 Kobu 大改稿，也沒有用 proof footer 取代正式頁尾。
- `astro.config.worker-cms.mjs` 注入現有中英首頁、列表、featured、行程詳情、activity/destination/duration/type、目的地 landing、about/contact/FAQ/reviews/visa/private-transfers/privacy/terms。
- root 靜態建置仍可跑，`getStaticPaths` 及原模板保留。CMS runtime 的 route hook 強制這些 injected routes 不 prerender；資料 props 透過 `Astro.locals.qualitourPageProps` 提供。
- `cms/scripts/lib/native-site-runtime.mjs` 僅在 CMS build 把 root API/image/build-data imports 換成 `native-site-{api,image,build-data}.mjs`。**訪客 runtime 不讀檔案快照、不帶 PAT、不去 WordPress 取 tour**。
- `native-site-data.mjs` 用官方 `getEmDashCollection` 查全部 published EN/ZH，不設100筆上限；只有 request-context WeakMap memo，沒有 isolate-level stale catalogue。
- imported tours 保留原 legacy numeric ID、public slug、rich HTML、翻譯關係。新 CMS tour 使用 CMS string ID 及有效 slug，新增互相對應的 published EN/ZH 可產生 reciprocal hreflang。
- 非 CMS 的公司資訊及49則公開 reviews 保留於 `cms/src/data/native-site-support.json`，包括原本空白 social 值，避免外觀內容悄悄改變。FAQ／條款等 hardcoded copy 並沒有憑空新增 CMS editor。
- 原 `NativeProofCache` named Worker entrypoint 已擴至 visitor HTML；default entrypoint 仍 cache disabled；發布在既有 CMS Durable Object 執行，透過 loopback RPC 在同一 cached entrypoint purge。
- `Authorization`／`Cookie` 在 shared lookup 前 `cache:'no-store'`；非200、Set-Cookie 也 no-store。`_preview`／`_edit` 在 lookup 前404。訪客 query 使用 trusted `cf.cacheKey=pathname`，原 Request URL/query 保留給 client-side filters；不因 tracking query 無限製造重渲染。
- 原別名 `/zh/`、`/zh.html`、`/tours/`、`/tours.html`、`/zh/faq/`、`/zh/faq.html` 皆307→extensionless；新 middleware 保持307。
- Booking/API/admin/media/assets 不進訪客 shared cache。Booking shell及 API 繼續既有 Sandbox 路徑；沒有改支付、車隊或 Live mode。
- 同 Worker `/_image` + IMAGES 壓縮 hero/gallery/inline；保留 originals/PDF download 及既有 supplier 圖片。沒有加入付費方案。

### 分類相容是重要決策，勿簡化掉

實際 CMS 是 `destinations`、`travel_styles`、`travel_regions`、`cruise_types`，與舊站分類不同。例如長江七號 CMS 選 `geo-cn`，舊站 visitor 是 Asia。直接採用全部 CMS 分類會改動現有分類頁數量／導航／SEO。

`cms/src/data/native-taxonomy-baseline.json` 為一次 read-only D1 快照：**260個未刪除 imported source keys（256公開＋4未公開）、四種 taxonomy 的 group/slugs，1126個 term metadata**。不要在一般發布時重新生成這份 baseline。

`native-site-taxonomy.mjs` 比對穩定 translation groups：未改的 imported assignments 維持 legacy 完全一致；改動／清空才投影；native 新行程用當前分類。優先既有 slug／明確 geo ancestor crosswalk，未映射用安全的已選詞彙。只加入實際公開行程用到的 selector，**不能把全部1126詞彙塞進導航**。`cruise_types` 沒有既有前台 facet，刻意不混進其他 facet。

worker 的實際基線重播：192/192 EN、64/64 ZH 無覆蓋，無新增導航詞彙。

## 4. 接續先修：尚未解決的獨立審查問題

### A. CMS SEO 分享圖片沒有完整傳遞

- `src/lib/cms/legacy-adapter.mjs` 的 `nativeSeo()` 保留 title/description/canonical/noIndex，**丟掉 image**；`WPTour.nativeSeo` type 也沒有 image。
- `cms/src/lib/cms/native-site-seo.mjs` 雖接受 image，但資料到不了它。
- **不要只允許 URL 就說完成。** `cms/src/plugins/tour-editor/TourSettings.tsx` 的 MediaPicker 寫入 `media.id`（不是 storageKey）；官方 `emdash/src/seo/media-url.ts` 的 `buildSeoImageUrl` 對 bare ID 直接拼 `/_emdash/api/media/file/<id>`。
- 本輪實際用既有 hero.id HEAD 該 URL 回 **404**。因此還要查明媒體 ID → storageKey／官方可用 URL 的解析方式；先做最小實測，不能盲目套官方 helper 後宣稱圖片可用。
- 相關已安裝來源：`node_modules/emdash/src/seo/{index,media-url}.ts`、`src/astro/routes/api/media/file/[...key].ts`；例子可從私有 fixture backup 的 hero.id/meta.storageKey 讀取，勿印整個憑證檔。

### B. Canonical override 與 JSON-LD URL 不一致

- `src/pages/[...lang]/tours/[slug].astro` 已把 CMS canonical overlay 給 Layout/SeoHead。
- 但 `tourStructuredData(tour, origin, base, lang)` 仍用原 route slug，造成 schema `url/@id`／breadcrumb最後項與有效 canonical 不同。
- 修正時沿用 `SeoHead` 的 canonical normalization/origin 規則，讓有效 canonical 與 schema一致；不要無意改動全部既有頁面的 schema。
- Reviewer 已澄清：schema `name` 保留行程 display title 是合理的，**不需要硬換成帶品牌的 SEO title**。

請加 regression：從 catalogue projection 經 SEO overlay 到 head/schema，覆蓋非空 image、title、canonical；再用本輪自有 test fixture 做真正渲染驗證。現有空白 SEO 必須維持所有舊頁面 metadata 不變。

其他仍須核對的邊界：4個未公開 imported entries 有 taxonomy baseline、但不在256筆公開 compatibility manifest；將來首次發布這4筆的策略尚未處理，不能把它們冒充已支援。新建無 source_key 的 CMS tour 已有支援，兩者不是同一情形。舊 `/native-proof` helper 對新的 native無source_key tour 仍按 legacy source_key lookup，新增公開 native tour 時可能使舊 prototype503；可退役／導向正式路由或修正，勿讓它誤導驗收。

## 5. 已跑與未跑的驗證

已跑：

- 目前92項 targeted Node tests：**92/92 pass**，原始結果 `.astro/native-site/tests.log`。
- `npm run check`：0 errors、0 warnings、249個 existing hints；`.astro/native-site/astro-check.log`。
- 完整 combined build 成功：CMS約11秒；static359頁約2分12秒；EN192、ZH64；merged3387 assets。
- source marker：`.astro/worker-release/release-ready.json` 是 `b9c8f786c9795ed09cb06f7768c269c30296d566`，4653個檔案指紋。
- build log：`.astro/native-site/build.log`。`getStaticPaths ignored` 和 bundle-size warnings 是本次 server build 的已知提示，不是0 build warnings。
- 舊全部359個已部署 HTML 的 metadata／結構基線已保存到 `.astro/native-site/before/page-baseline.json`，在建置覆蓋 assets 前擷取。
- 輕量列表原8.6MB EN /2.3MB ZH，建置後約568KB /248KB；畫面／filter要再用 browser 驗收，不可單憑 byte減少宣稱通過。
- D1 read-only taxonomy baseline 查詢 `rows_written:0`；沒有改動既有行程／分類資料。

**未跑／不可宣稱完成：** 全站候選 dry-run、部署、359 public runtime SEO parity、全站原生 publication/unpublish E2E、desktop/mobile browser、候選圖片解碼驗證。上輪 prototype 的成功結果不能代替本輪。

測試命令：

```sh
npm run check
node --test cms/scripts/test-native-site-*.mjs cms/scripts/test-native-cache-policy.mjs cms/scripts/test-emdash-free-runtime.mjs scripts/test-cms-content.mjs scripts/test-seo.mjs scripts/test-seo-pages.mjs scripts/test-worker-release.mjs scripts/test-native-booking-routes.mjs scripts/test-booking-calendar.mjs scripts/test-tour-browse.mjs
```

## 6. 已建立的測試草稿及私有驗證工具

只新建了兩筆明確 synthetic 草稿，**從未發布**，交接前再次 GET 確認皆 draft、version1。沒有改任何客戶 tour。

| Locale | ID | Slug |
| --- | --- | --- |
| EN | `01M78W488R3SADZQEHR1DS923W` | `cms-native-publish-check-20261112` |
| ZH | `01M78W4BFT9PT448KSKW8F74SD` | `cms-native-publish-check-20261112-zh` |

它們以 translationOf 配對，tour_code=`CMS-NATIVE-VERIFY-20261112`、noIndex=true，選加拿大／multi-day-tours，沿用既有 R2 圖片，沒有新上傳。

工作目錄下 ignored `.astro/native-site/`：

- `handoff-state.json`：最後 liveSource／兩草稿狀態。
- `before/fixture-{en,zh}.private.json`：原草稿資料／SEO，`fixture-ids.private.json`：限定寫入ID。
- `cms-client.mjs`：只對固定 CMS origin，使用現有管理員 CLI login；限制 mutation於上述ID或命名測試草稿，無 delete。不要把憑證／回應原文貼到對話或提交。
- `create-fixtures.mjs` 已跑，**不要再建兩筆**。
- `publish-site.mjs` **寫好但從未執行**。執行前由 Claude review／修正：預期首頁/list/Canada分類/detail更新；草稿不外露；互相hreflang；query cache一致；下架404／列表移除；finally還原資料至原草稿。它目前只還原data/status；如果為SEO測試改了seo/slug/taxonomies，必須擴大restore以覆蓋這些metadata。
- `before/entries.private.json`：已公開CMS資料的read-only backup；`before/{deployments,settings}.private.json`；taxonomy定義／例子；完整基線與logs。
- `read-taxonomy-baseline.py` 是一次性產生工具，不要在發布時自動再跑。

測試後保留草稿即可，無需永久刪除；驗證無任何測試產品留在公開首頁。不要送真實電郵、訂位或支付。

## 7. 修正後建置、部署及公開驗收順序

1. Claude 成為唯一 dispatcher／publisher；目前沒有另一個 agent 在寫入。先讀本文、plan與實際 diff，不重新做已完成的架構研究。
2. 修正第4節，加有意義的red/green及整合檢查；固定 source commit。
3. **重建 exact新commit。不能部署目前b9c8f78舊artifact。** 同一個npm環境、現有Keychain只讀build token：

```sh
python3 /Users/ning/agent-config/shared/skills/project-secrets/scripts/project-secrets.py exec qualitour --environment staging --consumer qualitour-pages-staging-build-local --include EMDASH_TOKEN -- env QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev npm run build:worker
/Users/ning/bin/cf-wrangler deploy --dry-run --config .astro/worker-release/cms/server/wrangler.json
```

4. 核對named cache/defaultfalse、所有原binding/DO migration、有效Worker immutable ID，並確認沒有新GitHub notifier／workflow。`cf-wrangler` guard有過底層失敗仍exit0的歷史，必須看log與readback。
5. 原任務已授權同Worker部署，無需重複索取相同權限；但本次 Ning 要暫停，**只在 Claude 接到繼續指示後操作**。不改DNS、不建新Worker、不加staging/free-test名稱、不開付費方案、不建立新token。
6. 用專案既有 `npm run deploy:worker`（需要build讀憑證時沿用wrapper）；它保留store IDs與secrets並檢查source fingerprint。已加上 bounded **read-only** release propagation重試，勿因短暫讀舊manifest重複deploy。
7. 先確認首頁／長江詳情／booking／CMS正常，再跑全量舊URL SEO parity：

```sh
python3 scripts/verify-native-site.py --baseline .astro/native-site/before/page-baseline.json --output .astro/native-site/public-parity.json --workers 3
```

此script對canonical URL比較title/meta/canonical/hreflang/h1/JSON-LD及錯誤圖片src，保存差異；不含canonical的404/500頁不算在public parity內。它是HTML驗證，不是browser或實機測試。

8. review再執行本輪兩筆fixture publication E2E，讀回部署version前後相同，證明無build/poll；所有測試資料最後還原draft。不先拿真實客戶tour做改字測試。
9. 用實際Chrome檢查EN/ZH首頁、列表filter/pagination、分類、長江16日詳情、非tour頁、header/footer及booking正常；desktop與390px emulation分開記，不宣稱真機。檢查圖片真實格式/尺寸/bytes、無rawWP/原圖fallback；表單只能read-only檢查，未授權不要送信。
10. 寫完整驗收／handoff，再向Ning清楚區分「原生CMS tour全站更新」與「原本hardcoded copy／非CMS reviews snapshot」。

## 8. 固定遠端資源與回復

- Account `ca4d347f96116e87e8f5dbd6c62f0b30`；Worker name `qualitour`；immutable Worker ID `2e3006ccf9f04193b0b795a6ae7c49f8`。
- D1 `DB`: `cf36703e-a507-4810-b865-9cd57f6681a8`；`TRANSFER_DB`: `f8cb062c-16b1-4f44-992f-8563b71ced20`。
- R2 `MEDIA`: `qualitour-cms-free-test-media`；KV `SESSION`: `71990ee89fd4417a9046aacbbdb88fa4`。
- DO class `QualitourCmsRuntime`；namespace `334554d9e6084c4fb26a2e2a6f4bef28`；migration `v1-qualitour-cms-runtime`。**不要刪除／重建／改成新DO migration。**
- 保留加密 secrets `TRANSFER_SANDBOX_KEY`、`CF_PAGES_DEPLOY_HOOK_URL`。後者保留但重建plugin未啟用；不要重新接GitHub/watch。
- 新release回復基準：目前live `d4898633-a94b-4cd0-90b7-4a4cc41b6bed`；更早基準 `88012664-edad-4a21-9d8d-f78c249300f6`。
- 既有normal-table SQL backup在 main worktree `.astro/worker-merge-20261112/before/cms-normal-tables.sql`，75,239,965bytes，SHA256 `92e5ba16fe68f14b2219868ec944e81850f2730ff89b3ca6aa2e1fe459c7f33e`。不是完整FTS/R2備份，也沒有restore rehearsal。

## 9. 前文與協作紀錄

- Plan：`docs/superpowers/plans/2026-11-12-native-site.md`。
- 私有進度：`.astro/native-site/progress.md`（較早中途記錄，**本文優先**）。
- 上輪已上線proof驗收：`docs/verification/2026-11-12-emdash-native-content-proof.md`。
- 本輪Codex subagents均已完成：`hosting_code_evidence`負責route props；`worker_frontend_target`負責data/API/image/taxonomy；`unified_worker_release_review`只讀覆核。它們不是Claude；本輪程式尚未經原生Claude覆核。
- 不需要恢復這些Codex child session；Claude用已提交code／tests／本文接手即可。未測用量／費用節省，不作宣稱。
