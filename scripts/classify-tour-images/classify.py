#!/usr/bin/env python3
"""Classify tour images for the tour-page gallery and write src/data/tour-image-kinds.json.

The CMS media library holds the same picture under several file names, and tour galleries also contain
text pictures (visa tables, inclusion lists, posters, ads, maps). The gallery shows only real photos, once each:
  * duplicates: images that look the same (64-bit difference hash + similar aspect ratio) share one canonical id;
  * text pictures ("graphics"): macOS Vision OCR reads at least TEXT_CHARS characters, or the id is listed in
    overrides.json (posters/logos/maps OCR misses).
Needs macOS (swiftc, Vision), Pillow and numpy. Refresh after content changes; ids missing from the output are
treated as photos and shown.

  QUALITOUR_CMS_ORIGIN=https://qualitour.qualitour.workers.dev node scripts/classify-tour-images/collect-sources.mjs refs.json
  python3 scripts/classify-tour-images/classify.py --refs refs.json [--work DIR] [--force]

refs.json (step 1) maps the address a tour page sees for each picture to its static-site name m-<hash>; the
pictures themselves are downloaded from the static site.
"""
import argparse, json, re, subprocess, urllib.request, concurrent.futures as cf
from pathlib import Path
from PIL import Image
import io

TEXT_CHARS = 40
HERE = Path(__file__).resolve().parent
ID = re.compile(r'm-[0-9a-f]{16}')

ap = argparse.ArgumentParser()
ap.add_argument('--refs', required=True)
ap.add_argument('--origin', default='https://qualitour-site.qualitour.workers.dev')
ap.add_argument('--work', default=str(HERE / '.work'))
ap.add_argument('--out', default=str(HERE.parent.parent / 'src/data/tour-image-kinds.json'))
ap.add_argument('--force', action='store_true')
args = ap.parse_args()
work = Path(args.work); (work / 'full').mkdir(parents=True, exist_ok=True)

# 1. every distinct media id referenced by a tour gallery
refs = json.loads(Path(args.refs).read_text())
sources = {ident: f'/img/{ident}.webp' for ident in sorted(set(refs.values()))}
print(len(sources), 'distinct media ids')

def fetch(item):
    ident, full = item
    out = work / 'full' / f'{ident}.png'
    if out.exists(): return
    request = urllib.request.Request(args.origin + full if full.startswith('/') else full, headers={'User-Agent': 'Mozilla/5.0'})
    image = Image.open(io.BytesIO(urllib.request.urlopen(request, timeout=60).read())).convert('RGB')
    image.thumbnail((1600, 1600)); image.save(out)
with cf.ThreadPoolExecutor(10) as pool: list(pool.map(fetch, sources.items()))

# 2. OCR (macOS Vision)
ocr_json = work / 'ocr.json'
if args.force or not ocr_json.exists():
    binary = work / 'ocr'
    subprocess.run(['swiftc', '-O', str(HERE / 'ocr.swift'), '-o', str(binary)], check=True)
    subprocess.run([str(binary), str(work / 'full'), str(ocr_json)], check=True)
ocr = json.loads(ocr_json.read_text())

# 3. duplicate groups
def dhash(ident):
    image = Image.open(work / 'full' / f'{ident}.png')
    gray = list(image.convert('L').resize((9, 8), Image.LANCZOS).getdata())
    bits = 0
    for row in range(8):
        for col in range(8): bits = (bits << 1) | (gray[row * 9 + col + 1] > gray[row * 9 + col])
    return bits, image.size
info = {ident: dhash(ident) for ident in sources}
parent = {ident: ident for ident in info}
def find(x):
    while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
    return x
ids = sorted(info)
for i, a in enumerate(ids):
    for b in ids[i + 1:]:
        (ha, (wa, ta)), (hb, (wb, tb)) = info[a], info[b]
        if bin(ha ^ hb).count('1') <= 4 and abs(wa / ta - wb / tb) < 0.15: parent[find(a)] = find(b)
groups = {}
for ident in ids: groups.setdefault(find(ident), []).append(ident)

# 4. text pictures, decided per group; the largest member is the canonical id
overrides = json.loads((HERE / 'overrides.json').read_text())
force_graphic, force_photo = set(overrides['graphic']), set(overrides['photo'])
graphics, canonical = [], {}
for members in groups.values():
    best = max(members, key=lambda m: (info[m][1][0] * info[m][1][1], m))
    for member in members:
        if member != best: canonical[member] = best
    if any(ocr.get(m, {}).get('chars', 0) >= TEXT_CHARS or m in force_graphic for m in members) and not (set(members) & force_photo):
        graphics.append(best)

result = {'version': 2, 'textChars': TEXT_CHARS, 'graphics': sorted(graphics), 'canonical': dict(sorted(canonical.items())), 'refs': dict(sorted(refs.items()))}
Path(args.out).write_text(json.dumps(result, indent=0, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'{len(groups)} distinct pictures, {len(canonical)} duplicate ids, {len(graphics)} text pictures, {len(refs)} references -> {args.out}')
