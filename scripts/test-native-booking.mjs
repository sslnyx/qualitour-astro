import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { settleAbortable } from "../src/lib/booking/request.ts";
import { pollPendingPayment } from "../src/lib/booking/payment-status-poll.ts";
import { reconcileBookingCustomer } from "../src/lib/booking/customer-draft.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const customerDraft = {
  name: "Local test guest",
  email: "guest@example.test",
  phone: "6045550108",
  pickupLocationId: "whistler",
  pickupAddress: "100 Test Avenue",
  dropoffLocationId: "vancouver",
  dropoffAddress: "200 Test Avenue",
  flightNumber: "",
  notes: "Local test note",
};
const whistler = { id: "whistler", nameEn: "Whistler", nameZh: "惠斯勒" };
const vancouver = { id: "vancouver", nameEn: "Vancouver", nameZh: "溫哥華" };
const yvr = { id: "yvr", nameEn: "YVR", nameZh: "溫哥華機場", requiresAddress: false };

test("a new quote keeps contact details and still-available pickup and drop-off choices", () => {
  assert.deepEqual(reconcileBookingCustomer(customerDraft, {
    pickupOptions: [whistler],
    dropoffOptions: [vancouver, yvr],
  }), customerDraft);
});

test("a changed quote replaces incompatible options and clears only their addresses", () => {
  assert.deepEqual(reconcileBookingCustomer(customerDraft, {
    pickupOptions: [whistler],
    dropoffOptions: [yvr],
  }), {
    ...customerDraft,
    dropoffLocationId: "yvr",
    dropoffAddress: "",
  });
});

test("free-text addresses stay available and a saved address is cleared when its field is no longer applicable", () => {
  const draft = { ...customerDraft, pickupLocationId: undefined };
  assert.deepEqual(reconcileBookingCustomer(draft, {
    dropoffOptions: [{ ...vancouver, requiresAddress: false }],
  }), { ...draft, dropoffAddress: "" });
});

test("transfer details host the existing booking form and status pages only recover existing bookings", async () => {
  const [product, status, card, experience, api] = await Promise.all([
    read("src/pages/[...lang]/private-transfers/[slug].astro"),
    read("src/pages/[...lang]/booking-status.astro"),
    read("src/components/TransferRouteCard.tsx"),
    read("src/components/booking/BookingExperience.tsx"),
    read("src/lib/booking/api.ts"),
  ]);
  assert.match(product, /<BookingExperience lang=\{lang\} productId=\{product.productId\}/);
  assert.match(status, /<BookingExperience lang=\{currentLang\} client:load/);
  assert.match(card, /searchParams.set\("card",/);
  assert.match(card, /data-transfer-products=/);
  assert.doesNotMatch(card, /href=\{hrefs\[vehicle.activityId\]\}/);
  assert.match(experience, /directoryProductId === productId/);
  assert.match(experience, /if \(!productId && !routeState.id\)/);
  assert.match(api, /\/api\/transfer\//);
  assert.doesNotMatch(product + status + card, /qualitour\.zaui\.net\/booking|<iframe|localStorage|sessionStorage/i);
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
