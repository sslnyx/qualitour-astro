import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { settleAbortable } from "../src/lib/booking/request.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("transfer booking surfaces share the native Sandbox experience", async () => {
  const [page, card, button, dialog, experience, api] = await Promise.all([
    read("src/pages/[...lang]/book.astro"),
    read("src/components/TransferRouteCard.tsx"),
    read("src/components/TransferBookingModalButton.tsx"),
    read("src/components/booking/NativeBookingDialog.tsx"),
    read("src/components/booking/BookingExperience.tsx"),
    read("src/lib/booking/api.ts"),
  ]);
  assert.match(page, /<BookingExperience/);
  assert.match(card, /<NativeBookingDialog/);
  assert.match(button, /<NativeBookingDialog/);
  assert.match(dialog, /<BookingExperience/);
  assert.match(dialog, /open \? \(/);
  assert.match(dialog, /document\.body\.style\.overflow = "hidden"/);
  assert.match(api, /\/api\/transfer\//);
  assert.match(experience, /directoryProductId === selectedProductId/);
  assert.match(experience, /useState<"en" \| "zh">\(pageLang\)/);
  assert.match(experience, /languageDestination/);
  assert.match(experience, /This transfer is not open for test booking yet/);
});

test("private transfer booking no longer embeds or links to Zaui", async () => {
  const files = await Promise.all([
    read("src/pages/[...lang]/book.astro"),
    read("src/components/TransferRouteCard.tsx"),
    read("src/components/TransferBookingModalButton.tsx"),
    read("src/components/TransferBookingModal.tsx"),
    read("src/components/TransferCardsWithModal.tsx"),
  ]);
  const source = files.join("\n");
  assert.doesNotMatch(source, /qualitour\.zaui\.net\/booking/i);
  assert.doesNotMatch(source, /<iframe/i);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("Stripe handoff only accepts the hosted test checkout destination", async () => {
  const source = await read("src/components/booking/BookingExperience.tsx");
  assert.match(source, /destination\.protocol !== "https:"/);
  assert.match(source, /destination\.hostname !== "checkout\.stripe\.com"/);
  assert.match(source, /sandboxAcknowledged: true/);
  assert.doesNotMatch(source, /amountMinor\s*:/);
});

test("an aborted catalog request cannot surface a stale route error", async () => {
  const controller = new AbortController();
  let rejectRequest;
  const delayedRequest = new Promise((_, reject) => {
    rejectRequest = reject;
  });
  const result = settleAbortable(delayedRequest, controller.signal);

  controller.abort();
  rejectRequest(new DOMException("Superseded request", "AbortError"));

  assert.equal(await result, undefined);
});

test("a genuine catalog request failure is still reported", async () => {
  const controller = new AbortController();
  const failure = new Error("Catalog unavailable");

  await assert.rejects(
    settleAbortable(Promise.reject(failure), controller.signal),
    failure,
  );
});
