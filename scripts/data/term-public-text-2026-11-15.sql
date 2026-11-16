-- Public page text for the three special pages of the old site, copied from qualitour.ca on 2026-11-15.
-- Stored beside (never in) the editors' `description` note: data.intro (paragraphs) and data.promo (one offer line).
-- English Yellowknife and Whitehorse: the old pages had only this offer line above the tours. The Chinese pages had no text.
UPDATE taxonomies SET data = json_set(data, '$.promo', 'Plan ahead and save — Enjoy a special 5% discount when you book a Yellowknife tour 4 months before your departure!')
 WHERE name = 'destinations' AND slug = 'geo-ca-nt' AND locale = 'en';
UPDATE taxonomies SET data = json_set(data, '$.promo', 'Plan ahead and save — Enjoy a special 5% discount when you book a Whitehorse tour 4 months before your departure!')
 WHERE name = 'destinations' AND slug = 'geo-ca-yt' AND locale = 'en';
-- 海洋三省 / 大西洋省份: the intro paragraph of /zh/atlantic-canada/. It belongs to the region tag, which is how the new site reaches the page.
UPDATE taxonomies SET data = json_set(data, '$.intro', '大西洋四省歷史悠久，是歐洲人在北美建立的第一批殖民地，其中愛德華王子島省(Prince Edward Island)是加拿大聯邦誕生地；新蘇格蘭省(Nova Scotia)是蘇格蘭以及愛爾蘭移民聚集地，以濃郁的英倫風情以及蘇格蘭文化傳統而聞名；新布倫斯瑞克省(New Brunswick)是加拿大唯一的雙語省，同時也是加拿大的森林王國，森林與海洋在這裏相遇，造就了世界聞名的芬迪灣；紐芬蘭與拉布拉多省(Newfoundland and Labrador)位於加拿大的最東端，從格羅斯莫恩國家公園的原始荒野和連綿不斷的天然海岸線，紐芬蘭島上的風景將讓您驚嘆不已！')
 WHERE name = 'travel_regions' AND slug = 'area-atlantic-canada' AND locale = 'zh';
