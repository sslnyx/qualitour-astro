# Tour image classification

`classify.py` writes `src/data/tour-image-kinds.json`, which the tour page uses to build its photo gallery:
duplicates (the same picture uploaded under several media ids) appear once, and text pictures (tables, lists,
posters, ads, maps) stay out of the collage. `overrides.json` lists the ids OCR cannot recognise. Ids that are
not in the output are shown as photos, so new uploads work until the next refresh.

Run it on macOS after tour content changes, then commit the JSON and release the CMS Worker and the site:

```sh
QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/classify-tour-images/collect-sources.mjs /tmp/refs.json
python3 scripts/classify-tour-images/classify.py --refs /tmp/refs.json
```

`collect-sources.mjs` reads the CMS (CLI login) and records the address the tour page sees for every picture (a CMS media
path, or the original address of a picture mirrored into the media library) with its static-site name `m-<sha1 of the
media path>`. `classify.py` downloads those pictures from the static site, groups look-alikes, runs OCR and writes the JSON.

The long-term fix is a "photo / info picture" choice in the CMS media or gallery field; this file is the interim.
