# Tour image classification

`classify.py` writes `src/data/tour-image-kinds.json`, which the tour page uses to build its photo gallery:
duplicates (the same picture uploaded under several media ids) appear once, and text pictures (tables, lists,
posters, ads, maps) stay out of the collage. `overrides.json` lists the ids OCR cannot recognise. Ids that are
not in the output are shown as photos, so new uploads work until the next refresh.

Run it on macOS after tour content changes, then commit the JSON and release the CMS Worker and the site:

```sh
node "/Users/ning/Local Sites/qualitour/_dev-fixtures/snapshot-tours.mjs"   # refresh the tour backup
python3 scripts/classify-tour-images/classify.py --fixtures "/Users/ning/Local Sites/qualitour/_dev-fixtures/tours"
```

The long-term fix is a "photo / info picture" choice in the CMS media or gallery field; this file is the interim.
