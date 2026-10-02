"""The Ledges' hand pass (#34): the cleaned stone ledges -> mahogany with a brass lip and fittings.

    uv run -q --with pillow --with numpy python scripts/art/scenes/ledges.py

Reads art/sprites/arena/stone/ledge_{102,144}.png (the props edit, as `art.py clean arena_props`
writes it) and writes art/sprites/arena/ledge_{102,144}.png, which `art.py export arena` exports.
A Ledge is a slab of polished courtroom mahogany with a brass edge (CONTEXT.md), so it stands
out over the marble, the sunset sky and the glass behind it (#33).

The silhouette is the cleaned sprite's, and so is the 1 px `night` outline: the slab's border
(rows 0 and 10 and its end columns) and every `night` pixel of the fittings. So the renderer's
block tiling (`ledgeSprite`, src/render/layers/arena.ts) keeps working. Everything inside is
redrawn by the rules below; the key light comes from the upper left.

- **Slab** (rows 1-9), top to bottom: the walkable brass lip (a `gold` top lit to `light` at the
  left end, a `brass` face), the lip's `leather1` shadow, four rows of mahogany (`leather2` with
  `leather3` and `leather1` grain), a `leather1` groove and a `leather2` bottom moulding. The
  left end catches the light and the right end is in shadow.
- **Panel seams** where the stone had block joints, every `PANEL` columns from `FIRST_SEAM`: a
  `leather1` groove and a `leather3` lit edge right of it. Each panel has its own grain, seeded
  by its index; the 102 px Ledge's panel from column 30 to 48 is the block `ledgeSprite` repeats.
- **Fittings** (rows 11-15): the two stone corbels become brass fittings, shaded from their
  silhouette (lit where the left or top side is open, shadowed along the right and bottom side),
  with a `light` rivet head.
"""
import os
import random
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from palette import ROOT  # noqa: E402
from pixtext import CODE_OF, from_text, to_text  # noqa: E402

ART = os.path.join(ROOT, "art", "sprites", "arena")
SOURCE = os.path.join(ART, "stone")
NAMES = ("ledge_102", "ledge_144")

#: Rows of the slab: its outlined top and bottom, and the fittings' rows under it.
TOP, BOTTOM, FITTINGS = 0, 10, range(11, 16)
#: The stone's block joints, now panel seams: every PANEL columns from FIRST_SEAM, while a full
#: panel still fits before the right end (src/render/layers/arena.ts LEDGE_BLOCK is 30-48).
FIRST_SEAM, PANEL = 12, 18

C = {name: CODE_OF[name] for name in
     ("night", "leather1", "leather2", "leather3", "brass", "gold", "light")}
#: The slab's rows inside the outline, top to bottom: (part, colour).
SLAB = [("lip", "gold"), ("lip", "brass"), ("lip shadow", "leather1")] \
    + [("wood", "leather2")] * 4 + [("groove", "leather1"), ("moulding", "leather2")]
assert TOP + 1 + len(SLAB) == BOTTOM
#: The walkable lip top, and the wood rows (the upper half takes lit grain, the lower dark).
LIP_TOP = TOP + 1
WOOD = [TOP + 1 + i for i, (part, _) in enumerate(SLAB) if part == "wood"]
#: Lip top columns lit to `light` at the slab's left end.
GLINT = 4


def seams(width):
    return list(range(FIRST_SEAM, width - PANEL + 1, PANEL))


def grain(rows, x0, x1, seed):
    """Polished grain inside one panel [x0, x1): two long, gently stepping grain lines, a lit
    one high and a dark one low."""
    rng = random.Random(seed)
    span = x1 - x0 - 3
    if span < 4:
        return
    half = len(WOOD) // 2
    for (top, low), code in ((WOOD[:half], "leather3"), (WOOD[half:], "leather1")):
        length = rng.randint(max(4, span * 3 // 5), span)
        start = rng.randint(x0 + 2, x1 - 1 - length)
        step = rng.randint(start + 2, start + length - 2)
        y0, y1 = (top, low) if rng.random() < 0.5 else (low, top)
        for x in range(start, start + length):
            rows[y0 if x < step else y1][x] = C[code]


def slab(rows, width):
    inner = range(1, width - 1)
    for i, (_, name) in enumerate(SLAB, start=TOP + 1):
        for x in inner:
            rows[i][x] = C[name]
    cuts = [1] + seams(width) + [width - 1]
    for k, (x0, x1) in enumerate(zip(cuts, cuts[1:])):
        grain(rows, x0 + (k > 0), x1, seed=k)
    for x in seams(width):
        for y in WOOD:
            rows[y][x] = C["leather1"]
            rows[y][x + 1] = C["leather3"]
    for x in range(1, 1 + GLINT):
        rows[LIP_TOP][x] = C["light"]
    # The ends below the lip top: the left end is lit, the right end in shadow.
    for y in range(LIP_TOP + 1, BOTTOM):
        left, right = rows[y][1], rows[y][width - 2]
        rows[y][1] = {C["brass"]: C["gold"], C["leather1"]: C["leather2"]}.get(left, C["leather3"])
        rows[y][width - 2] = {C["brass"]: C["leather3"]}.get(right, C["leather1"])


def fittings(rows, width):
    def open_at(y, x):
        return not (0 <= y < len(rows) and 0 <= x < width) or rows[y][x] in (".", C["night"])

    fill = [(y, x) for y in FITTINGS for x in range(width) if rows[y][x] not in (".", C["night"])]
    shade = {}
    for y, x in fill:
        lit = open_at(y, x - 1) or (y > FITTINGS[0] and open_at(y - 1, x))
        dark = open_at(y, x + 1) or open_at(y + 1, x)
        shade[y, x] = "gold" if lit and not dark else "leather3" if dark and not lit else "brass"
    for (y, x), name in shade.items():
        rows[y][x] = C[name]
    # A rivet head in each fitting: its second row, two columns in, with a shadow below right;
    # only where both pixels are inside the fitting (never on its outline).
    inside = set(fill)
    y = FITTINGS[1]
    for x0 in sorted({x for yy, x in fill if yy == y and open_at(yy, x - 1)}):
        if (y, x0 + 2) in inside and (y + 1, x0 + 3) in inside:
            rows[y][x0 + 2] = C["light"]
            rows[y + 1][x0 + 3] = C["leather3"]


def redraw(stone):
    """The mahogany Ledge for one cleaned stone ledge (an RGBA array): same silhouette and
    outline, everything inside redrawn."""
    rows = [list(r) for r in to_text(stone)]
    height, width = len(rows), len(rows[0])
    assert height == FITTINGS[-1] + 2, f"expected a 17 px ledge, got {height}"
    slab(rows, width)
    fittings(rows, width)
    return from_text(["".join(r) for r in rows])


def build(source=SOURCE, out=ART):
    """Writes <out>/ledge_*.png and returns {name: RGBA array}."""
    done = {}
    for name in NAMES:
        stone = np.asarray(Image.open(os.path.join(source, f"{name}.png")).convert("RGBA"))
        done[name] = redraw(stone)
        Image.fromarray(done[name]).save(os.path.join(out, f"{name}.png"))
    return done


def main():
    build()
    print("ledges ->", os.path.relpath(ART, ROOT))


if __name__ == "__main__":
    main()
