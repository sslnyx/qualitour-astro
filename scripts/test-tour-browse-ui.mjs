import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

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
  assert.match(filters, /restoreFocusRef\.current\.focus\(\)/);
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
