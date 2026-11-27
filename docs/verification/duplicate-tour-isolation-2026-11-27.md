# 複製團令整個團目錄建立失敗（2026-11-27）

分支 `fix/duplicate-tour-isolation-20261127`，基於上線分支 `codex/emdash-native-site-20261112` 的 `8670c84`。
寫本文時：**未提交、未 push、未部署，沒有讀寫上線 CMS 或 D1。**

## 原因

- EmDash 的 Duplicate 複製全部欄位，包括 `source_key`、`source_status`（`ContentRepository.duplicate`）。
- `buildCatalogue` 遇到重複或不認得的身分會拋錯，沒有逐團隔離。
- 即時載入每批 256 團、每批各自檢查。跨批的複本不會報錯，會出現兩個同網址的團。
- 複本的團 ID 和原團一樣。只修拋錯並不夠：複本那一行仍會改寫原團的分類、詳細頁來源和中英對照。

## 修法

| 情況 | 現在的結果 |
| --- | --- |
| 匯入團的複本（同批或跨批） | 只隱藏複本，原團內容、分類、網址不變 |
| 原團未發布，只有複本已發布 | 複本仍然隱藏，不會接手舊網址 |
| 不認得或空白的舊系統編號 | 只隱藏那一團 |
| 新團網址和上線中的匯入團相同 | 匯入團保留網址，新團隱藏 |
| 兩個新團網址相同 | 較早發布的保留 |
| 同一個 CMS 項目讀到兩次 | 照舊拋錯（這是讀取出錯，不是某一團的問題） |

原團的判斷用固定清單 `src/data/cms-tour-owners.json`（256 個匯入團各自的 CMS ID）。
資料取自 11-12 和 11-26 兩次 CMS 讀出，256 個 ID 完全一致。沒有用「誰較早」判斷：`createdAt` 在 11-12 已改回 WordPress 日期，而且只看已發布的團時，原團一下架，複本就會接手。判斷只看該項目本身，所以 CMS Worker、靜態網站建置（只看得到已發布的團）和後台提示結果一定相同，也不用多讀 D1。

**維護：** 匯入團若被永久刪除後重建，新 ID 要更新到清單，否則會被當成複本隱藏。從垃圾桶還原不會改 ID。

## 同事看到甚麼

- 行程編輯頁頂部紅色提示，儲存前後、發布前後都顯示，說明原因和做法，複本有「打開原團」連結。
- 按發佈或排程時，確認框再提示一次。沒有阻止發布。
- 複本不再顯示「自動檢查沒有發現問題」。
- 新團網址撞到舊匯入團時，「要確認」清單多一項。
- 管理員在 Worker log 和網站建置 log 看到 `[tours] … left out of the site (…)`。
- 行程列表沒有標記。列表上已發布的複本仍顯示為已發布，打開才看到原因。

## 複本：排除，還是當成有自己網址的新團

**建議並已實作：排除。** 理由（按代碼和相容資料）：

- 匯入團的公開頁以凍結的舊版資料為底，CMS 欄位沒改過的部分沿用舊版。複本改走新團路徑後只剩 CMS 欄位。256 個匯入團全部帶有 CMS 欄位以外的舊版面區塊，其中 42 團的這些區塊有超過 80 字的文字（沒有逐團比較客人實際看到的差異）。
- Duplicate 沒有複製分類，新團不會出現在目的地和類別頁。
- 複本標題帶「(Copy)」，網址由標題自動產生。誤按發佈就會公開一個重複的團。
- 複本仍帶著原團的 `source_key`。現有批次工具假設編號唯一。

代價：同事暫時不能用「複製」開新團，要用新增行程。已發布的複本不會上網站。
之後如要支援複製開團（P5），應由專用功能清走 `source_key` 和 `source_status`（兩個都要是空值）、複製分類、讓同事定網址。
從未公開過的匯入團（`source_status` 為 draft/pending/private）的複本，和以前一樣按新團處理。

## 驗證

| | 改動前 | 改動後 |
| --- | --- | --- |
| `.mjs` 測試檔 / 測試項 | 67 / 463 通過，0 失敗 | 69 / 481 通過，0 失敗 |
| `test_pages_static.py`、`test_staging_seo.py` | 通過 | 通過 |
| `test_staging_release.py` | 失敗：找不到 `seo_check` 模組 | 相同（與本次無關） |

- 新測試：`scripts/test-tour-duplicate-isolation.mjs`、`scripts/test-tour-identity-notice.mjs`。覆蓋同批、跨批（兩個方向）、不認得的編號、網址相撞、翻譯對照、驗證頁、後台提示。目錄測試先在舊程式上失敗。
- 暫時改壞三處關鍵程式（資料行過濾、跨批檢查、固定 ID），測試每次都失敗。
- 改了兩個舊測試：`test-cms-content.mjs` 原本要求整個拋錯的斷言，改為只剔除該團；`test-tour-ribbon-currency.mjs` 的假資料原用虛構 ID，改用原團 ID。
- 舊重現腳本用虛構 ID `a`、`b`，現在三項都會是 0 或少一團；原團改用真實 ID 後，「原團加複本」建出 1 團。
- `npm run build:worker-cms` 本機建置成功。提示元件單獨渲染檢查過文字和連結。
- 新增的發布 workflow 測試沒有加到 `main` 的 `site-release.yml`。

**未驗證：** 沒有在真實後台按 Duplicate 或看提示畫面（複本資料按 EmDash 原始碼模擬）；沒有跑完整的 `build:worker` 和 `release:site`（會讀上線 CMS）；沒有確認上線 CMS 現在是否已有複本、原團 ID 是否仍和清單一致。

## 部署步驟（每一步的提交、push、讀寫上線、部署都要 Ning 同意）

靜態網站發布固定用 `SITE_SOURCE_REF`（預設上線分支）建置。修正必須進入上線分支，只部署 Worker 不夠。`qualitour` Worker 內含訂車後端，**只可從包含目前上線版本的提交部署**。本次沒有改 `src/server/native-booking/`，沒有 D1 migration。

1. 在修正分支提交。
2. `git fetch origin`。上線分支如有新提交，rebase 上去，重跑測試。
3. **確認不會退回舊版。** 打開 `https://qualitour.qualitour.workers.dev/qualitour-release.json` 取得 `commit`，再執行
   `git merge-base --is-ancestor <該 commit> HEAD && echo OK`。
   沒有 `OK` 就停：上線 Worker 有這個分支沒有的程式。再用 `/Users/ning/bin/cf-wrangler deployments list --name qualitour` 核對最後部署時間，記下目前版本 ID 作回退點。
4. **唯讀核對原團清單：** `QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev npm run sync:cms`（只讀已發布的團，只寫本機檔案）。
   - 預期沒有任何 `left out of the site` 行，團數和目前網站一致。
   - 有 `copy` 行：在後台核對兩個 ID 哪個是真正的原團。若被隱藏的是原團，清單過時，**停止部署**並更新清單。若真是複本，部署後它不會顯示。
   - 有其他代碼的行：逐一核對，確認那團本來就不應顯示。
5. 乾淨 worktree、同一個提交：`npm ci`，然後 `QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev npm run build:worker`，再 `npm run deploy:worker`。
6. 立即把同一個提交 push 到上線分支（`git push origin HEAD:codex/emdash-native-site-20261112`，只可 fast-forward）。先部署後 push 是現行做法。兩步之間後台若有發布，自動網站發布仍用舊程式；沒有已發布的複本時不受影響。
7. `gh workflow run site-release.yml --repo sslnyx/qualitour-astro --ref main`。若 repo 變數 `SITE_SOURCE_REF` 另有設定，先確認它包含這個提交。
8. 檢查：`/`、`/zh`、`/tours`、`/zh/tours`、一個中文和一個英文匯入團、`/private-transfers`、`/booking-status` 回 200；團數和第 4 步一致；後台打開一個正常的團，沒有紅色身分提示。
9. 要在上線站試複製（會寫入上線 CMS，另需同意）：複製一團但先不發佈，打開複本應看到紅色提示，之後刪除複本。

回退：CMS Worker 回到第 3 步記下的版本；上線分支用 revert 提交，再重跑網站發布。回退後複製團問題會回來。

部署前請同事不要發佈任何複製出來的團。如果目錄已經因此壞掉，把複本下架或刪除應可恢復（按代碼推斷，沒有在上線站試）。

## 仍然會拖垮整個目錄的單團錯誤（本次沒有改）

本次只處理身分和網址重複。以下仍會令整個目錄建立失敗：新團網址用保留字（如 `featured`、`style`、`tags`）或含不允許字元、缺團名或發布日期、主圖/相簿/PDF 資料無效、SEO 標準網址無效、同語言兩團屬於同一翻譯組。快照失效後也沒有舊版頂替。
