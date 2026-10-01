"""Hand pass on the cleaned master -> reference/manu-pipeline/master_side.png on the 48x72 frame.

The source is clean/m34_b.png: master_side_v4's copy b (the best of three) after master_34_v5
turned the head and chest toward the camera (both eyes, a toothy grin). Below the chest the two
are the same pixels, so the key poses drawn from v4 still fit.

Every change is a rule or a pixel-text patch here, so the pass is reviewable and repeatable:
  1. the robe snapped to outline black: interior black becomes `night`, so pure black stays
     the outline (docs/architecture.md, Palette); the robe's folds stay `robe`, and folds on the
     lit (left) half of the robe get `robeSheen`;
  2. the boots snapped to leather1 (almost black): their inside steps up to leather2 with a
     leather3 glint on the toe cap, as on the character sheet;
  3. small face and tattoo patches (see PATCHES).

    uv run -q --with pillow --with numpy python scripts/art/characters/rexi_master.py
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rexi_common import PIPE  # noqa: E402
from pixtext import RGB, to_text, from_text, paint  # noqa: E402

SRC = os.path.join(PIPE, "clean", "m34_b.png")   # ¾ face (master_34_v5); body as master_b
OUT = os.path.join(PIPE, "master_side.png")
CANVAS = (48, 72)
OFFSET = (10, 5)          # master (0, 0) on the frame: feet row 64 -> frame row 69

ROBE = set("knrR")
INSIDE_ROBE = (11, 56)    # master rows the robe spans

# Pixel-text patches in master coordinates: (x, y, rows); ' ' keeps, '_' clears.
PATCHES = []


def fix(rows):
    h, w = len(rows), len(rows[0])
    g = [list(r) for r in rows]
    at = lambda x, y: g[y][x] if 0 <= x < w and 0 <= y < h else "."
    # 1. robe interior black -> night
    out = [r[:] for r in g]
    for y in range(*INSIDE_ROBE):
        for x in range(w):
            if g[y][x] != "k":
                continue
            ns = [at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if all(n in ROBE for n in ns):
                out[y][x] = "n"
    # robe folds on the lit half (left of the robe's centre line) catch the light
    for y in range(13, 56):
        for x in range(0, 14):
            if out[y][x] == "r":
                out[y][x] = "R"
    # 2. boots: leather1 inside -> leather2, toe-cap glint
    for y in range(56, h):
        for x in range(w):
            if g[y][x] == "L":
                ns = [at(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
                if all(n not in "." for n in ns) and at(x, y + 1) != "k":
                    out[y][x] = "M"
    return ["".join(r) for r in out]


def build():
    src = np.asarray(Image.open(SRC).convert("RGBA"))
    rows = fix(to_text(src))
    sp = from_text(rows)
    for x, y, p in PATCHES:
        paint(sp, x, y, p)
    W, H = CANVAS
    frame = np.zeros((H, W, 4), np.uint8)
    ox, oy = OFFSET
    frame[oy:oy + sp.shape[0], ox:ox + sp.shape[1]] = sp
    Image.fromarray(frame).save(OUT)
    return frame


if __name__ == "__main__":
    f = build()
    for y, r in enumerate(to_text(f)):
        print(f"{y:3d} {r}")
