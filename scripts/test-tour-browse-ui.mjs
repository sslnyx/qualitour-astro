import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the mobile menu clips horizontally and its autofocus target does not slide offscreen", async () => {
  const source = await read("src/components/SiteNavAstro.astro");
  const drawer = source.match(/<dialog\s+id="mobile-drawer"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(drawer);
  assert.match(drawer, /\boverflow-clip\b/);
  assert.match(drawer, /id="mobile-close-btn"\s+type="button"\s+autofocus/);
  assert.doesNotMatch(drawer, /translate-x-/);
  assert.doesNotMatch(source, /#mobile-drawer\[open\][^{]*\{[^}]*animation:/);
});

test("category pages leave the document main landmark to Layout", async () => {
  const source = await read("src/components/TourCategoryPage.astro");
  assert.doesNotMatch(source, /<main\b/);
  assert.doesNotMatch(source, /<\/main>/);
});

test("the mobile tour filters behave as a keyboard modal", async () => {
  const [filters, grid] = await Promise.all([
    read("src/components/TourFilterSidebarClient.tsx"),
    read("src/components/ToursGrid.tsx"),
  ]);

  assert.match(filters, /role="dialog"/);
  assert.match(filters, /aria-modal="true"/);
  assert.match(filters, /onKeyDown=\{handleDrawerKeyDown\}/);
  assert.match(filters, /event\.key === "Escape"/);
  assert.match(filters, /restoreFocusRef\.current\.focus\(\{ preventScroll: true \}\)/);
  assert.match(filters, /mobileOpen && \(/);
  assert.match(filters, /window\.addEventListener\('urlchange', handleUrlChange\)/);
  assert.match(grid, /new CustomEvent\("toggle-mobile-filters"/);
  assert.match(grid, /aria-expanded=\{mobileFiltersOpen\}/);
});

test("tour search terms remain visible and removable in results", async () => {
  const source = await read("src/components/ToursGrid.tsx");

  assert.match(source, /searchingFor/);
  assert.match(source, /clearSearch/);
  assert.match(source, /filters\.q && \(/);
  assert.match(source, /t\.clearSearch/);
});

test("tour filters open a separate destination picker instead of scrolling a nested list", async () => {
  const source = await read("src/components/TourFilterSidebarClient.tsx");
  assert.match(source, /<TourDestinationPicker\b/);
  assert.match(source, /<select\b[^>]*id=\{styleId\}/);
  assert.doesNotMatch(source, /max-h-48.*max-h-64|Apply Filters|套用篩選/);
  const picker = await read("src/components/TourDestinationPicker.tsx");
  assert.match(picker, /aria-expanded=\{open\}/);
  assert.match(picker, /searchDestination/);
  assert.match(picker, /options\.slice\(0, visibleCount\)/);
});

test("Chinese browse controls use Traditional Chinese", async () => {
  const [filters, grid] = await Promise.all([
    read("src/components/TourFilterSidebarClient.tsx"),
    read("src/components/ToursGrid.tsx"),
  ]);
  const source = filters + grid;

  assert.match(source, /篩選/);
  assert.match(source, /搜尋行程/);
  assert.match(source, /未找到相關行程/);
  assert.doesNotMatch(source, /筛选|搜索行程|未找到相关行程/);
});
