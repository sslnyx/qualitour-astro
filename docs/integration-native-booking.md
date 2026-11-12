# Native booking integration — in progress

User selected on 2026-11-12: connect native booking to new `qualitour` same origin; Sandbox only. The earlier Pages proxy/separate Worker design was cancelled before deployment. No new Worker, Pages preview secret, production payment key or migration has been published by this work.

Frontend page `/book` and `/zh/book`, transfer shortcut dialogs share `BookingExperience`, `/api/transfer/*`, exact `transfer-product-{sourceActivityId}` selection. Current enabled test product is18. Other source products are explicitly unavailable, never silently mapped to another route. Zaui transfer iframe and fake successful request form removed.

Prepared server module: `src/server/native-booking/index.mjs`, export `routeNativeBooking(request, env, context): Promise<Response|null>`. Intercepts only `/api/transfer/*` and booking deep manage/return/receipt paths; CMS/other paths return null. Bind existing dedicated transfer staging D1 as `TRANSFER_DB` (`f8cb062c-16b1-4f44-992f-8563b71ced20`), encrypted **Sandbox-only** Stripe key as `TRANSFER_SANDBOX_KEY`. CMS `DB`, R2, KV, DO, auth settings remain unchanged. Bundle hashes/source provenance in `src/server/native-booking/provenance.json`; never expose it as static assets.

Pending integration after other session's combined Worker source is fixed: call routeNativeBooking before fetchFreeRuntime in `cms/src/emdash-free-worker.ts`; extend assets.run_worker_first for `/api/transfer/*` and `/book/*`; preserve CMS bindings and add only TRANSFER_DB. No new cron or webhook: existing transfer Access app performs Sandbox reconciliation in same D1; its configured signed endpoint remains unchanged. Stripe success/cancel returns same `qualitour` origin.

Root lead owns these native-booking files and final Sandbox acceptance; other combined-Worker work is active. This document is status, not a deployment-success claim.
