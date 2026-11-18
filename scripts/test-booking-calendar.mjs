import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const componentUrl = new URL(
  "../src/components/booking/ServiceCalendar.tsx",
  import.meta.url,
);

async function loadCalendarModule() {
  const source = await readFile(componentUrl, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "ServiceCalendar.tsx",
  }).outputText;
  const calendarModule = { exports: {} };
  const require = createRequire(componentUrl);
  const compile = new Function("require", "exports", "module", output);
  compile(require, calendarModule.exports, calendarModule);
  return calendarModule.exports;
}

const calendar = await loadCalendarModule();
const require = createRequire(componentUrl);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("the mobile confirmed quote is shown before the contact form", async () => {
  const view = await readFile(new URL("../src/components/booking/BookingView.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/booking/booking.css", import.meta.url), "utf8");
  const quotedTotal = /className="qb-trip-review__total"[\s\S]*?money\(quote\.amountMinor\)/.exec(view);
  assert.ok(quotedTotal, "a confirmed quote has an upfront total");
  assert.ok(quotedTotal.index < view.indexOf('t("接送與聯絡資料", "Transfer & contact details")'));
  assert.match(styles, /@media \(max-width: 760px\) \{[\s\S]*?\.qb-trip-review__total \{[^}]*display: flex/);
});

test("leap-year month lengths follow Gregorian rules", () => {
  assert.equal(calendar.getDaysInMonth(2024, 1), 29);
  assert.equal(calendar.getDaysInMonth(2023, 1), 28);
  assert.equal(calendar.getDaysInMonth(2100, 1), 28);
  assert.equal(calendar.getDaysInMonth(2000, 1), 29);
});

test("month grid starts on Sunday and spans adjacent month boundaries", () => {
  const days = calendar.getMonthGrid("2024-02");
  assert.equal(days.length, 42);
  assert.equal(days[0], "2024-01-28");
  assert.equal(days[4], "2024-02-01");
  assert.equal(days[41], "2024-03-09");
});

test("keyboard date movement crosses leap-day and week boundaries", () => {
  assert.equal(
    calendar.getKeyboardDate("2024-03-01", "ArrowLeft"),
    "2024-02-29",
  );
  assert.equal(calendar.getKeyboardDate("2024-03-01", "ArrowUp"), "2024-02-23");
  assert.equal(calendar.getKeyboardDate("2024-03-01", "Home"), "2024-02-25");
  assert.equal(calendar.getKeyboardDate("2024-03-01", "End"), "2024-03-02");
  assert.equal(
    calendar.getKeyboardDate("2024-03-31", "PageDown"),
    "2024-04-30",
  );
  assert.equal(
    calendar.getKeyboardDate("2024-02-29", "PageUp", true),
    "2023-02-28",
  );
});

test("Home and End search inward within the same week row", () => {
  const base = {
    date: "2024-06-12",
    min: "2024-06-09",
    max: "2024-06-15",
  };

  assert.equal(
    calendar.getEnabledKeyboardDate({
      ...base,
      key: "Home",
      isDateEnabled: (date) => date !== "2024-06-09",
    }),
    "2024-06-10",
  );
  assert.equal(
    calendar.getEnabledKeyboardDate({
      ...base,
      key: "End",
      isDateEnabled: (date) => date !== "2024-06-15",
    }),
    "2024-06-14",
  );
  assert.equal(
    calendar.getEnabledKeyboardDate({
      ...base,
      key: "Home",
      isDateEnabled: () => false,
    }),
    "2024-06-12",
  );
  assert.equal(
    calendar.getEnabledKeyboardDate({
      ...base,
      key: "End",
      isDateEnabled: () => false,
    }),
    "2024-06-12",
  );
});

test("month options include every month inside the min/max interval", () => {
  assert.deepEqual(calendar.getMonthOptions("2024-11-15", "2025-02-01"), [
    "2024-11",
    "2024-12",
    "2025-01",
    "2025-02",
  ]);
});

test("calendar markup exposes accessible selection and unavailable dates", () => {
  assert.equal(typeof calendar.ServiceCalendar, "function");
  const markup = renderToStaticMarkup(
    React.createElement(calendar.ServiceCalendar, {
      lang: "en",
      value: "2024-02-29",
      min: "2024-02-28",
      max: "2024-03-02",
      isDateEnabled: (date) => date !== "2024-03-01",
      onChange: () => {},
    }),
  );

  assert.match(markup, /class="qb-calendar__head"/);
  assert.match(markup, /class="qb-calendar__weekdays"/);
  assert.match(markup, /qb-calendar__selected/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /style="min-height:44px;min-width:44px"/);
  assert.match(
    markup,
    /<button[^>]+disabled=""[^>]+aria-label="Friday, March 1, 2024"/,
  );
  assert.ok(markup.indexOf(">Sun<") < markup.indexOf(">Mon<"));
});

test("roving focus falls forward when the supplied date is unavailable", () => {
  const markup = renderToStaticMarkup(
    React.createElement(calendar.ServiceCalendar, {
      lang: "en",
      value: "2024-03-01",
      min: "2024-03-01",
      max: "2024-03-03",
      isDateEnabled: (date) => date !== "2024-03-01",
      onChange: () => {},
    }),
  );

  assert.equal(markup.match(/tabindex="0"/g)?.length, 1);
  assert.match(
    markup,
    /<button[^>]+tabindex="0"[^>]+aria-label="Saturday, March 2, 2024"/,
  );
});

test("dynamic bounds clamp the visible month and restore a valid tab stop", () => {
  assert.deepEqual(
    calendar.getCalendarViewState({
      visibleMonth: "2024-03",
      focusedDate: "2024-03-15",
      value: "",
      min: "2024-06-10",
      max: "2024-06-30",
      isDateEnabled: (date) => date !== "2024-06-10",
    }),
    { visibleMonth: "2024-06", focusedDate: "2024-06-11" },
  );
});

test("availability ticks replace an invalid tab stop without moving valid focus", () => {
  const base = {
    visibleMonth: "2024-06",
    value: "2024-06-15",
    min: "2024-06-01",
    max: "2024-06-30",
  };

  assert.deepEqual(
    calendar.getCalendarViewState({
      ...base,
      focusedDate: "2024-06-11",
      isDateEnabled: (date) => date >= "2024-06-12",
    }),
    { visibleMonth: "2024-06", focusedDate: "2024-06-12" },
  );
  assert.deepEqual(
    calendar.getCalendarViewState({
      ...base,
      focusedDate: "2024-06-20",
      isDateEnabled: () => true,
    }),
    { visibleMonth: "2024-06", focusedDate: "2024-06-20" },
  );
});
