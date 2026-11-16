-- Public page text of a category, kept apart from EmDash's own tables: EmDash rewrites a term's `data` whenever an
-- editor saves its description, so text stored there would vanish. One row per (taxonomy, slug, locale).
-- Copied from the old site (qualitour.ca) on 2026-11-15. The Chinese Yellowknife and Whitehorse pages had no text.
CREATE TABLE IF NOT EXISTS term_public_text (
  taxonomy TEXT NOT NULL,
  slug TEXT NOT NULL,
  locale TEXT NOT NULL,
  intro TEXT,
  promo TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (taxonomy, slug, locale)
);
INSERT OR REPLACE INTO term_public_text (taxonomy, slug, locale, promo) VALUES
  ('destinations', 'geo-ca-nt', 'en', 'Plan ahead and save — Enjoy a special 5% discount when you book a Yellowknife tour 4 months before your departure!'),
  ('destinations', 'geo-ca-yt', 'en', 'Plan ahead and save — Enjoy a special 5% discount when you book a Whitehorse tour 4 months before your departure!');
-- 海洋三省 / 大西洋省份: the intro of /zh/atlantic-canada/. It belongs to the region tag, which is how the new site reaches that page.
INSERT OR REPLACE INTO term_public_text (taxonomy, slug, locale, intro) VALUES
  ('travel_regions', 'area-atlantic-canada', 'zh', '大西洋四省歷史悠久，是歐洲人在北美建立的第一批殖民地，其中愛德華王子島省(Prince Edward Island)是加拿大聯邦誕生地；新蘇格蘭省(Nova Scotia)是蘇格蘭以及愛爾蘭移民聚集地，以濃郁的英倫風情以及蘇格蘭文化傳統而聞名；新布倫斯瑞克省(New Brunswick)是加拿大唯一的雙語省，同時也是加拿大的森林王國，森林與海洋在這裏相遇，造就了世界聞名的芬迪灣；紐芬蘭與拉布拉多省(Newfoundland and Labrador)位於加拿大的最東端，從格羅斯莫恩國家公園的原始荒野和連綿不斷的天然海岸線，紐芬蘭島上的風景將讓您驚嘆不已！');
-- Remove the first attempt (keys inside the terms' data).
UPDATE taxonomies SET data = json_remove(data, '$.intro', '$.promo')
 WHERE json_extract(data, '$.intro') IS NOT NULL OR json_extract(data, '$.promo') IS NOT NULL;
