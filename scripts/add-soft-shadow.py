#!/usr/bin/env python3
"""Add a soft drop shadow under a transparent cutout (vehicle photos on the Private Transfers page).

Run after scripts/remove-background.swift so every vehicle has the same light shadow as the Sienna photo:
    python3 scripts/add-soft-shadow.py van.png van-shadow.png
Needs Pillow. The shadow is the silhouette moved 2px right and 5px down, blurred (4px) at 38% black, so leave a few pixels of
transparent margin under the vehicle.
"""
import sys
from PIL import Image, ImageFilter

OFFSET, BLUR, OPACITY = (2, 5), 4, 0.38


def add_shadow(source, target):
    image = Image.open(source).convert('RGBA')
    shadow_mask = Image.new('L', image.size, 0)
    shadow_mask.paste(image.getchannel('A'), OFFSET)
    shadow_mask = shadow_mask.filter(ImageFilter.GaussianBlur(BLUR)).point(lambda value: int(value * OPACITY))
    shadow = Image.new('RGBA', image.size, (0, 0, 0, 0))
    shadow.putalpha(shadow_mask)
    Image.alpha_composite(shadow, image).save(target)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    add_shadow(sys.argv[1], sys.argv[2])
