import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { imageSize } from "image-size";
import snapshot from "../src/data/zaui-transfer-routes.json" with { type: "json" };
import { transferListingCovers, transferRouteCover } from "../src/lib/transfer-covers.ts";
import {
  legacyTransferProductRedirect,
  transferProductBySlug,
  transferProductPages,
  transferProducts,
  transferRouteCardLinks,
} from "../src/lib/transfer-products.ts";
import {
  productEntryForTransferCard,
  quoteInputForProductEntry,
} from "../src/lib/booking/contracts.ts";

test("all 18 directions and their detail entries use localized destination photos", () => {
  const zh = transferListingCovers(snapshot.routes, "zh");
  const en = transferListingCovers(snapshot.routes, "en");
  const links = transferRouteCardLinks(snapshot.routes, "");
  const photosByFile = new Map();
  const yvrDestinations = [];
  let directionCount = 0;
  for (const route of snapshot.routes) {
    for (const [direction, vehicles] of [["forward", route.vehicles], ["reverse", route.reverseActivityIds]]) {
      if (!vehicles.length) continue;
      const key = `${route.id}-${direction}`;
      const photo = zh[route.id]?.[direction];
      assert.ok(photo?.alt && en[route.id]?.[direction]?.alt, key);
      assert.notEqual(photo.alt, en[route.id][direction].alt, key);
      assert.equal(photo.src, en[route.id][direction].src, key);
      const slug = links[vehicles[0].activityId].split("/").at(-1);
      const entry = transferProductBySlug(slug).cardEntries.find(candidate => candidate.key === key);
      assert.deepEqual(transferRouteCover(entry.from, entry.to, "zh"), photo, key);
      directionCount++;
      if (entry.to === "Vancouver Airport (YVR)") yvrDestinations.push(photo);
      if (photosByFile.has(photo.src)) continue;
      const bytes = readFileSync(new URL(`../public${photo.src}`, import.meta.url));
      const dimensions = imageSize(bytes);
      assert.deepEqual([dimensions.type, dimensions.width, dimensions.height], ["webp", 1080, 608], key);
      photosByFile.set(photo.src, createHash("sha256").update(bytes).digest("hex"));
    }
  }
  assert.equal(directionCount, 18);
  assert.equal(yvrDestinations.length, 5);
  for (const photo of yvrDestinations) assert.deepEqual(photo, yvrDestinations[0]);
  assert.equal(photosByFile.size, 14);
  assert.equal(new Set(photosByFile.values()).size, photosByFile.size);
});

test("each catalogue direction resolves to one detail page with all of its original vehicle prices", () => {
  const links = transferRouteCardLinks(snapshot.routes, "/zh");
  const visited = new Set();
  for (const route of snapshot.routes) {
    for (const [direction, vehicles] of [["forward", route.vehicles], ["reverse", route.reverseActivityIds]]) {
      if (!vehicles.length) continue;
      const detail = links[vehicles[0].activityId];
      assert.match(detail, /^\/zh\/private-transfers\/[\w-]+$/);
      assert.ok(!detail.endsWith("-seater"));
      const slug = detail.split("/").at(-1);
      visited.add(slug);
      const page = transferProductBySlug(slug);
      assert.deepEqual(
        page.variants.map(({ activityId, seater, price, currency }) => ({ activityId, seater, price, currency })),
        vehicles.map(({ activityId, seater, price, currency }) => ({ activityId, seater, price, currency })),
      );
      assert.ok(vehicles.every(vehicle => links[vehicle.activityId] === detail));
      assert.ok(page.cardEntries.some(entry => entry.key === `${route.id}-${direction}`));
    }
  }
  assert.equal(visited.size, transferProductPages.length);
});

test("the two Whistler return cards keep distinct destinations on their shared detail page", () => {
  const page = transferProductBySlug("whistler-to-vancouver-yvr");
  assert.equal(page.to, "Vancouver Airport (YVR) / Greater Vancouver");
  assert.deepEqual(page.cardEntries, [
    { key: "route-0-reverse", routeId: "route-0", from: "Whistler", to: "Vancouver Airport (YVR)" },
    { key: "route-1-reverse", routeId: "route-1", from: "Whistler", to: "Greater Vancouver" },
  ]);
});

test("Whistler return card entries carry their matching quote product entry only", () => {
  const quote = {
    routeId: "test-route",
    rateId: "test-rate",
    departureLocal: "2026-11-23T09:00",
    passengers: 2,
  };
  for (const lang of ["en", "zh"]) {
    assert.equal(
      productEntryForTransferCard("whistler-to-vancouver-yvr", "route-0-reverse"),
      "whistler-to-yvr",
      `${lang} YVR return`,
    );
    assert.equal(
      productEntryForTransferCard("whistler-to-vancouver-yvr", "route-1-reverse"),
      "whistler-to-greater-vancouver",
      `${lang} Greater Vancouver return`,
    );
    assert.equal(productEntryForTransferCard("whistler-to-vancouver-yvr", undefined), undefined, `${lang} direct`);
    assert.equal(productEntryForTransferCard("vancouver-yvr-to-whistler", "route-0-forward"), undefined, `${lang} other product`);
  }
  assert.deepEqual(
    quoteInputForProductEntry(quote, "whistler-to-yvr"),
    { ...quote, productEntry: "whistler-to-yvr" },
  );
  const directQuote = quoteInputForProductEntry(quote, undefined);
  assert.deepEqual(directQuote, quote);
  assert.equal(Object.hasOwn(directQuote, "productEntry"), false);
});

test("all old vehicle-specific bookmarks retain their seat selection on the canonical route", () => {
  for (const prefix of ["", "/zh"]) {
    for (const product of transferProducts) {
      const oldPath = `${prefix}/private-transfers/${product.slug}`;
      const slug = product.slug.replace(/-\d+-seater$/, "");
      const page = transferProductBySlug(slug);
      assert.ok(page, oldPath);
      const response = legacyTransferProductRedirect(new Request("https://example.com" + oldPath));
      assert.equal(response?.status, 301, oldPath);
      const location = new URL(response.headers.get("Location"), "https://example.com");
      assert.equal(location.pathname, `${prefix}/private-transfers/${slug}`);
      assert.equal(location.searchParams.get("vehicle"), page.variants.length > 1 ? product.seater : null);
    }
  }
});
