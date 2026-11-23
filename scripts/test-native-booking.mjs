import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { settleAbortable } from "../src/lib/booking/request.ts";
import { pollPendingPayment } from "../src/lib/booking/payment-status-poll.ts";

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

function mockPaymentPage(t) {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  globalThis.document = page;
  globalThis.window = { setTimeout, clearTimeout };
  t.after(() => {
    delete globalThis.document;
    delete globalThis.window;
  });
  return {
    async advance(ms) {
      t.mock.timers.tick(ms);
      await Promise.resolve();
    },
    visibility(value) {
      page.visibilityState = value;
      page.dispatchEvent(new Event("visibilitychange"));
    },
  };
}

test("status checks back off and stop within two minutes", async (t) => {
  const page = mockPaymentPage(t);
  const times = [];
  pollPendingPayment(async () => {
    times.push(Date.now());
    return true;
  });
  for (const delay of [5_000, 10_000, 20_000, 30_000, 30_000, 120_000])
    await page.advance(delay);
  assert.deepEqual(times, [5_000, 15_000, 35_000, 65_000, 95_000]);
});

test("status checks pause when hidden, wait for responses, and end on a terminal status", async (t) => {
  const page = mockPaymentPage(t);
  const first = Promise.withResolvers();
  const check = t.mock.fn(() => first.promise);
  const stop = pollPendingPayment(check);
  page.visibility("hidden");
  await page.advance(15_000);
  assert.equal(check.mock.callCount(), 0);
  page.visibility("visible");
  await page.advance(5_000);
  assert.equal(check.mock.callCount(), 1);
  await page.advance(30_000);
  assert.equal(check.mock.callCount(), 1);
  first.resolve(false);
  await page.advance(60_000);
  page.visibility("hidden");
  page.visibility("visible");
  await page.advance(5_000);
  assert.equal(check.mock.callCount(), 1);
  stop();
});
