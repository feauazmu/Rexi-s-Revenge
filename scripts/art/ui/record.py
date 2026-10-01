"""Hand pass for the Veredicto court record's ornaments (#29).

    uv run -q --with pillow --with numpy python scripts/art/ui/record.py   # art/sprites/record/*.png

`art.py gen record` drew a court seal, a wax seal with ribbons and a gavel on its sound block
(art/raw/record.png), on the right grid this time (the 16 px shield icon in cell 0 held the
pixel size). `art.py clean record` writes them to art/sprites/record-clean/. This pass:
  1. inks the silhouette edge of the seal and the wax seal with the outline colour (the model
     drew their rims without one: the audit's weak-outline warning);
  2. applies the pixel-text patches below.
The gavel is used as cleaned.
"""
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from palette import MASTER, ROOT, hex2rgb  # noqa: E402
from pixtext import paint  # noqa: E402

ART = os.path.join(ROOT, "art")
INK = (*hex2rgb(MASTER["outline"]), 255)
EDGE_INK = ("seal", "wax")
# Pixel-text patches per sprite: [(x, y, rows)]; ' ' keeps, '_' clears.
PATCHES = {}


def ink_edge(sp):
    a = sp[..., 3] > 0
    p = np.pad(a, 1)
    inside = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
    out = sp.copy()
    out[a & ~inside] = INK
    return out


def main():
    src = os.path.join(ART, "sprites", "record-clean")
    for name in ("seal", "wax", "gavel"):
        sp = np.asarray(Image.open(os.path.join(src, name + ".png")).convert("RGBA")).copy()
        if name in EDGE_INK:
            sp = ink_edge(sp)
        for x, y, rows in PATCHES.get(name, []):
            sp = paint(sp, x, y, rows)
        path = os.path.join(ART, "sprites", "record", name + ".png")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        Image.fromarray(sp).save(path)
        print(os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
