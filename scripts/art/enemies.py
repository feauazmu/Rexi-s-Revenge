"""Hand pass on the cleaned Enemy and projectile sheets -> art/enemies/ and art/projectiles/ (#27).

    uv run -q --with pillow --with numpy python scripts/art/enemies.py

Sources are the `clean` outputs in art/sprites/ (sheets enemy_*, projectiles_v2). Every change is
a rule or a pixel-text patch here, so the pass is reviewable and repeatable (ADR 0002):
  1. ink: dark pixels on the silhouette edge become `outline`, and a light edge pixel gets an
     outline pixel outside it, so every sprite has the 1 px outline the snap smudged;
  2. per-sprite pixel-text patches (PATCHES): readable LEDs, joined handlebars, glints;
  3. projectiles were drawn at twice the game size and are reduced exactly 2:1 (reduce.py);
  4. debris chunks are cut from each finished Enemy (DEBRIS rectangles) and re-inked along the cut.
The game draws everything facing right and mirrors it; the TypeScript comes from `art.py export`.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import holes  # noqa: E402
from palette import ROOT, hex2rgb, MASTER  # noqa: E402
from pixtext import RGB, from_text, paint  # noqa: E402
from reduce import reduce2  # noqa: E402

ART = os.path.join(ROOT, "art")
SPRITES = os.path.join(ART, "sprites")
OUTLINE = np.array(hex2rgb(MASTER["outline"]), np.uint8)
INK_LUMA = 70

# The best copy of each sheet (a, b or c: the three are separate samples of one design).
BODIES = {
    "maletin": "enemies/maletin_b",
    "archivador": "enemies/archivador_b",
    "caminadora": "enemies/caminadora_a",
    "banca": "enemies/banca_v3",
}
PROJECTILES = ["gavel", "stamp", "dumbbell", "law_book", "subpoena", "paper", "bullet", "rocket", "drawer",
               "paper_tilt"]

# Colour fixes after the snap, per body: {from code: to code} (pixtext codes). The Caminadora's
# chrome intake rings snapped to the mauve stone ramp and its dark reds to skin tones.
STEEL = {"S": "1", "T": "2", "U": "3"}   # stone1/stone2/stoneLight -> the grey steps
RECOLOR = {
    "maletin": STEEL,
    "archivador": {**STEEL, "a": "p", "b": "q"},
    "banca": STEEL,
    "caminadora": {"S": "1", "T": "2", "U": "3", "L": "p", "a": "p", "b": "q", "c": "t", "d": "t", "f": "t",
                   "N": "q"},
}

# Pixel-text patches (x, y, rows) applied after the ink pass; ' ' keeps a pixel, '_' clears it.
PATCHES = {
    # The console snapped to mush: a red housing with a dark screen of coral LED readouts and two
    # gold buttons, on the same two posts.
    "caminadora": [(40, 0, [
        "____kkkk___",
        "__kkvvvvkk_",
        "_kvvssssvvk",
        "kvskkkkkksk",
        "ksskttvtksk",
        "ksskhnnnksk",
        "ksskvttnksk",
        "kqskkkkkksk",
        "kqsYsYsssqk",
        "kkqqqqqqqkk",
    ])],
}

# Projectiles redrawn in pixel text at game size. The projectiles_v2 render (twice the game size)
# fixes their design, palette and lighting, but its 2:1 reduction loses the details that read at
# 8-15 px (the scales emblem, the stamp's neck, the plates' rims), so these are drawn over it by
# hand. paper_tilt is the reduction itself.
DRAWN = {
    # Mazo Automático: the handle on the left, the barrel head upright on the right, brass bands.
    "gavel": [
        "......kkkkk.",
        ".....khhOOMk",
        ".....kYYyyLk",
        "kkkkkkhOONMk",
        "khOOOOhOONMk",
        "kNMMMMhOONMk",
        "kkkkkkhOONMk",
        ".....kYyyyLk",
        ".....kOONMLk",
        "......kkkkk.",
    ],
    # Lluvia de Sellos: a red knob and neck on a wooden block with a blue rubber pad.
    "stamp": [
        "...kkk...",
        "..ktvsk..",
        "..kvssk..",
        "..kssqk..",
        "...kqk...",
        "...ksk...",
        ".kkksqkk.",
        "khOOOONMk",
        "kOOONNMMk",
        "kkkkkkkkk",
        "k6555554k",
        ".kkkkkkk.",
    ],
    # Mancuernas: two iron plates with lit rims on a short chrome bar.
    "dumbbell": [
        ".kkk.....kkk.",
        "k1Rrk...k1Rrk",
        "k1Rukkkkk1Ruk",
        "k1Ruk666k1Ruk",
        "k1Ruk222k1Ruk",
        "k1Rukkkkk1Ruk",
        "k1Rrk...k1Rrk",
        ".kkk.....kkk.",
    ],
    # Código Penal: the red book flying right, spine at the back, a gold scales emblem, pages below.
    "law_book": [
        ".kkkkkkkkkkkk.",
        "kpqvvvvvvvvvtk",
        "kpqssssYsssssk",
        "kpqsYYYYYYYssk",
        "kpqsysssYsyssk",
        "kpqyYysYsyYysk",
        "kpqssssYsssssk",
        "kpqssYYYYYsssk",
        "kpkkkkkkkkkkkk",
        "kpmmmmmmmmmm3k",
        ".kkkkkkkkkkkk.",
    ],
    # Citaciones Teledirigidas: a manila envelope, its flap a V, sealed with red wax.
    "subpoena": [
        "kkkkkkkkkkkkk",
        "khllllllllllk",
        "kOhlllllllhNk",
        "kOOhllllhONNk",
        "kOOOkvtkONNNk",
        "kOOOvssqONNNk",
        "kOOhkqqkhNNNk",
        "kOhOOOONNhNNk",
        "kkkkkkkkkkkkk",
    ],
    # A demanda: one sheet of legal paper with text lines and a folded corner.
    "paper": [
        "kkkkkkk..",
        "kwwwwwkk.",
        "kw222wk3k",
        "kwwwwwkkk",
        "kw22222mk",
        "kwwwwwwmk",
        "kw22222mk",
        "kwwwwwwmk",
        "kw222wwmk",
        "kwwwwwwmk",
        "kkkkkkkkk",
    ],
    # Caminadora a Reacción gatling round: a brass slug with a white-hot tip.
    "bullet": [
        ".kkkkk.",
        "kMyYllk",
        "kLNyYwk",
        ".kkkkk.",
    ],
    # Banca Artillada rocket: red fins at the tail, a steel body with a lit top, a red warhead.
    "rocket": [
        "kkk...........",
        "kqsk..........",
        ".kqkkkkkkkkk..",
        ".k45666665tvk.",
        ".k44445555ssvk",
        ".k4kkkkkkkqsk.",
        ".kqk.....kkk..",
        "kqsk..........",
        "kkk...........",
    ],
    # The Archivador Artillado's drawer bomb: steel front with a brass label and handle, files
    # sticking out of the top, the fuse curling from the top right corner (its tip is the top
    # right pixel; the spark is code).
    "drawer": [
        "..............N",
        "..kk.kkk.kk..N.",
        ".kwwkwwmkwmkN..",
        ".kwmkw22kwmkN..",
        "kkkkkkkkkkkkkk.",
        "k666666666664k.",
        "k65555yYYy554k.",
        "k6555yllllY54k.",
        "k65555yYYy554k.",
        "k655555555554k.",
        "k655yYYYYy554k.",
        "k655555555554k.",
        "k444444444441k.",
        "kkkkkkkkkkkkkk.",
    ],
}
# Glints the cleaner cut out as background (white cells ringed by ink, `art.py holes -v`): filled
# back with their own colour. The other ink-ringed holes are real gaps (between the console
# posts, under the barbell) and stay open.
HOLES = {
    "maletin": [(36, 10)],
    "caminadora": [(5, 8), (5, 10), (5, 13), (45, 15), (18, 26), (25, 26)],
}

# Parts cut out of a body into their own sprite, so the game can move or swap them: the
# Archivador's bomb-bay hatch (it opens while a drawer is lowered). Its top-left pixel is (25, 39).
SPLIT = {"archivador": {"hatch": (25, 39, 34, 41)}}

# Debris chunks, in the order the game indexes them: name -> (x0, y0, x1, y1) in the finished
# body (end exclusive). Each is re-inked along its cut.
DEBRIS = {
    "maletin": {"0_mast": (17, 0, 24, 8), "1_cockpit": (29, 7, 43, 20), "2_case": (8, 10, 22, 20),
                "3_tail": (0, 13, 9, 19)},
    "archivador": {"0_drawer": (17, 9, 42, 17), "1_wing": (0, 16, 17, 30), "2_thruster": (17, 38, 24, 43),
                   "3_corner": (16, 0, 30, 9), "4_pod": (43, 16, 61, 30)},
    "caminadora": {"0_jet": (3, 0, 22, 8), "1_console": (38, 0, 51, 12), "2_belt": (10, 14, 40, 20),
                   "3_gatling": (33, 20, 51, 28), "4_handlebar": (29, 4, 40, 8), "5_jet": (0, 7, 20, 15)},
    "banca": {"0_plate": (0, 1, 14, 27), "1_motor": (19, 0, 30, 12), "2_canopy": (51, 11, 72, 20),
              "3_pod": (8, 32, 24, 46), "4_pad": (14, 20, 45, 28), "5_foot": (30, 42, 43, 47)},
}


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def save(sp, *parts):
    path = os.path.join(ART, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(trim(sp)).save(path)
    return path


def trim(sp):
    ys, xs = np.nonzero(sp[..., 3])
    return sp[ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy() if len(ys) else sp


def luma(rgb):
    return 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]


def _edges(a):
    """Opaque pixels with a transparent (or off-canvas) 4-neighbour."""
    p = np.pad(a, 1)
    clear_nb = ~p[:-2, 1:-1] | ~p[2:, 1:-1] | ~p[1:-1, :-2] | ~p[1:-1, 2:]
    return a & clear_nb


def ink(sp, grow=True):
    """Dark silhouette-edge pixels -> outline; light ones get an outline pixel outside them
    (grow) or become outline themselves (grow=False, for cut edges)."""
    sp = np.pad(sp, ((1, 1), (1, 1), (0, 0))) if grow else sp.copy()
    a = sp[..., 3] > 0
    edge = _edges(a)
    dark = luma(sp[..., :3].astype(float)) < INK_LUMA
    sp[edge & dark, :3] = OUTLINE
    light = edge & ~dark
    if grow:
        add = np.zeros_like(a)
        ys, xs = np.nonzero(light)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            add[np.clip(ys + dy, 0, a.shape[0] - 1), np.clip(xs + dx, 0, a.shape[1] - 1)] = True
        add &= ~a
        sp[add, :3] = OUTLINE
        sp[add, 3] = 255
    else:
        sp[light, :3] = OUTLINE
    return trim(sp)


def chunk(sp, box):
    x0, y0, x1, y1 = box
    return ink(sp[y0:y1, x0:x1].copy(), grow=False)


def recolor(sp, mapping):
    for src, dst in mapping.items():
        hit = (sp[..., 3] > 0) & (sp[..., :3] == np.array(RGB[src])).all(-1)
        sp[hit, :3] = RGB[dst]
    return sp


def body(kind):
    sp = recolor(load(os.path.join(SPRITES, BODIES[kind] + ".png")), RECOLOR.get(kind, {}))
    sp = ink(sp)
    for x, y, rows in PATCHES.get(kind, []):
        sp = paint(sp, x, y, rows)
    if HOLES.get(kind):
        sp, _ = holes.fill(sp, auto=False, fill=HOLES[kind])
    return sp


def projectile(name):
    if name in DRAWN:
        rows = DRAWN[name]
        bad = [i for i, r in enumerate(rows) if len(r) != len(rows[0])]
        if bad:
            raise ValueError(f"{name}: rows {bad} are not {len(rows[0])} wide")
        return from_text(rows)
    sp, _ = reduce2(load(os.path.join(SPRITES, "projectiles", "x2", name + ".png")))
    return ink(sp)


def main():
    for kind in BODIES:
        sp = body(kind)
        print(f"enemies/{kind}/body.png {sp.shape[1]}x{sp.shape[0]}")
        for name, box in DEBRIS.get(kind, {}).items():
            save(chunk(sp, box), "enemies", kind, f"debris_{name}.png")
        for name, (x0, y0, x1, y1) in SPLIT.get(kind, {}).items():
            save(sp[y0:y1, x0:x1].copy(), "enemies", kind, name + ".png")
            sp[y0:y1, x0:x1] = 0
        save(sp, "enemies", kind, "body.png")
    for name in PROJECTILES:
        sp = projectile(name)
        print(f"projectiles/{name}.png {sp.shape[1]}x{sp.shape[0]}")
        save(sp, "projectiles", name + ".png")


if __name__ == "__main__":
    main()
