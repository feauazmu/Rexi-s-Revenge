"""The 16x16 Weapon and Power-up icons (#29): the size anchor and the hand pass.

    uv run -q --with pillow --with numpy python scripts/art/ui/icons.py anchor   # art/hand/icon_anchor.png
    uv run -q --with pillow --with numpy python scripts/art/ui/icons.py finish   # art/sprites/icons/*.png

How the icons were made:
  1. `anchor` writes a hand-drawn 16x16 Creatina tub, which sits in cell 0 of the
     `icon_cells` template as the size and style anchor.
  2. `art.py gen icons` drew the eleven designs (art/raw/icons.png). The model ignored the
     16 px cells and drew every icon at about 2x (32 px, the anchor included), with the bottom row
     twice; `art.py clean icons` cleans those large icons into art/sprites/icons-clean/.
  3. A 2:1 reduction (reduce.py) keeps the silhouettes but turns the emblems, labels and
     shading to mush at 16 px, so each icon below is redrawn by hand on the 16x16 grid over its
     reduced copy, keeping the generated design: composition, colours and props. This is the
     hand pass ADR 0002 allows on top of the pipeline, kept as reviewable pixel text.
  4. `finish` writes the pixel text to art/sprites/icons/, which `art.py export icons` turns into
     src/render/art/generated/icons.ts.

Codes are pixtext.CODES (one per master-palette colour); '.' is clear.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from palette import ROOT  # noqa: E402
from pixtext import from_text  # noqa: E402

ART = os.path.join(ROOT, "art")
SIZE = 16

# Creatina, drawn by hand on the 16x16 cell: steel lid, white tub, gold label with a red x3.
ANCHOR = [
    "................",
    "...kkkkkkkkkk...",
    "..k6666666665k..",
    "..k5555555554k..",
    "..kkkkkkkkkkkk..",
    "..kwwmmmmmm32k..",
    "..kwmmmmmmm32k..",
    "..kYYYYYYYYYyk..",
    "..kYYYYYsssYyk..",
    "..kYYYYYYYsYyk..",
    "..kYsYsYYssYyk..",
    "..kYYsYYYYsYyk..",
    "..kYsYsYsssYyk..",
    "..kmmmmmmmm32k..",
    "..k3333333322k..",
    "...kkkkkkkkkk...",
]

ICONS = {
    # A gavel on the 45-degree lattice: brown head with two gold bands, handle to the lower right.
    "mazo-automatico": [
        ".....kk.........",
        "....kONk........",
        "...kOlNMk.......",
        "..kOONYNMk......",
        ".kOONNNyMk......",
        "kOlNNNMMk.......",
        "kNNYNMMOk.......",
        ".kMNyMkNOk......",
        "..kMMk.kNOk.....",
        "...kk...kNOk....",
        ".........kNOk...",
        "..........kNOk..",
        "...........kNOk.",
        "............kNOk",
        ".............kNk",
        "..............k.",
    ],
    # A red rubber stamp over its blue inked face.
    "lluvia-de-sellos": [
        "......kkkk......",
        ".....ktvsqk.....",
        "....ktvssssk....",
        "....kvssssqk....",
        "....kssssqqk....",
        ".....kqsqqk.....",
        "......kqpk......",
        "......ksqk......",
        "......ksqk......",
        "...kkkksqkkkk...",
        "..ktvvssssssqk..",
        ".kvsssssssssqpk.",
        ".kqqqqqqqqqqqpk.",
        ".kkkkkkkkkkkkkk.",
        ".kjiiiiiiiiiigk.",
        "..kkkkkkkkkkkk..",
    ],
    # A steel dumbbell, two plates a side, with a lit fuse.
    "mancuernas": [
        ".............F..",
        "............FlF.",
        ".............N..",
        ".kkk........kkk.",
        "k665k......k665k",
        "k655kkk..kkk655k",
        "k655k6k..k6k655k",
        "k555k5kkkk5k555k",
        "k554k566665k554k",
        "k554k555445k554k",
        "k554k4kkkk4k554k",
        "k544k4k..k4k544k",
        "k544kkk..kkk544k",
        "k444k......k444k",
        ".kkk........kkk.",
        "................",
    ],
    # The red law book with gold scales, a rocket flame from its lower left.
    "codigo-penal": [
        "....kkkkkkkkkkk.",
        "...kqpvvvvvvvvsk",
        "...kqpvsssssssqk",
        "...kqpssssYssssk",
        "...kqpsYYYYYYYsk",
        "...kqpsYssYssYsk",
        "...kqpYYYsYsYYYk",
        "...kqpssssYssssk",
        "...kqpsssYYYsssk",
        ".v.kqpvsssssssqk",
        "vGvkqpqqqqqqqqqk",
        "GHGkqkmmmmmmmm3k",
        "HlHkqqqqqqqqqqqk",
        "GHlGkkkkkkkkkkk.",
        "vGHGv...........",
        ".v.v............",
    ],
    # A cream envelope locked on by a red reticle.
    "citaciones-teledirigidas": [
        "................",
        "kkkkkkkkkkkkk...",
        "keNeeeeeeeNek...",
        "keeNeeeeeNeek...",
        "keeeNeeeNeeek...",
        "keeeeNeNeeeek...",
        "keeeeeNeeekkk...",
        "keeeeeeekkssskk.",
        "keeeeeeekskkksk.",
        "kdeeeeekskddkksk",
        "kddddddkskdskksk",
        "kkkkkkkkskkkkksk",
        "........kskkksk.",
        "........kkssskk.",
        "..........kkk...",
        "................",
    ],
    # An unrolled sentence firing a golden beam to the upper right.
    "sentencia-firme": [
        "...........kFYlH",
        "..........kFYlHF",
        ".........kFYlHFk",
        "........kFYlHFk.",
        ".......kFYlHFk..",
        "......kFYlHFk...",
        ".....kFYlHFk....",
        ".kkkkkkkkFk.....",
        "kOeeeeeeOk......",
        "kNkkkkkkNk......",
        ".kedNNNek.......",
        ".keeeeeek.......",
        ".keNNNdek.......",
        "kkkkkkkkkk......",
        "kOeeeeeeOk......",
        ".kkkkkkkk.......",
    ],
    # A blue-lidded shaker of orange pre-workout with a stopwatch.
    "pre-entreno": [
        "...kkk.....kkk..",
        "...kjk....kwwwk.",
        "kkkkikkkkkwwkwmk",
        "kjjiiiiikkwwkkmk",
        "kjiiiiigkkwwwwmk",
        "kkkkkkkkk.k333k.",
        ".kjxxxjk...kkk..",
        ".kjGFFvk........",
        ".kjGFFvk........",
        ".kjFFFvk........",
        ".kjFFFvk........",
        ".kjFFFvk........",
        ".kjFFvvk........",
        ".kiiiigk........",
        "..kkkkk.........",
        "................",
    ],
    # A take-away coffee (brown lid and sleeve) with a red health cross.
    "receso": [
        "................",
        ".kkkkkkkk.......",
        "kNOOOOONMk......",
        "kMMMMMMMLk......",
        "kkkkkkkkkk......",
        ".kwmmmm3k.......",
        ".kwmmmm3kkkkkk..",
        ".kONNNNMkktvsk..",
        ".kOhNNNkkkvsskkk",
        ".kONNNNktvssssqk",
        "..kwmm3kvsssssqk",
        "..kwmm3kqqqsqqqk",
        "..kkkkkkkksqqkkk",
        ".........ksqqk..",
        ".........kkkkk..",
        "................",
    ],
    # A gold heraldic shield bearing the scales of justice.
    "inmunidad-judicial": [
        "kkkkkkkkkkkkkkk.",
        "klllllllllllllk.",
        "klYYYYYYYYYYyyk.",
        "klYYYYYMYYYYyyk.",
        "klYYMMMMMMMYyyk.",
        "klYYMYYMYYMYyyk.",
        "klYMMMYMYMMMyyk.",
        "klYYYYYMYYYYyyk.",
        "klYYYYMMMYYYyyk.",
        ".kyYYYYYYYYYyk..",
        ".kyYYYYYYYYYyk..",
        "..kyYYYYYYYyk...",
        "...kyYYYYYyk....",
        "....kyYYYyk.....",
        ".....kyyyk......",
        "......kkk.......",
    ],
    # A muscular leg, knee forward, a jet flame blasting from under its sneaker.
    "dia-de-pierna": [
        "kkkkkkkkkkkkk...",
        "k21kddeeddddddk.",
        "k21kdfffffffffdk",
        "k11kfffffffffcfk",
        "kkkkcccccccfcfck",
        "....kbbbbbkffcck",
        ".........kdffcbk",
        "........kdfffcbk",
        "........kdffccbk",
        ".........kfcbk..",
        "........kmwwwkk.",
        "........kwwsswwk",
        "........k322222k",
        "........kkkkkkkk",
        "........FHlllHF.",
        ".........FGHGF..",
    ],
    "creatina": ANCHOR,
}


def save(sp, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(sp).save(path)
    print(os.path.relpath(path, ROOT))


def check(name, rows):
    if len(rows) != SIZE or any(len(r) != SIZE for r in rows):
        raise ValueError(f"{name}: icons are {SIZE}x{SIZE} pixel text")


def anchor():
    save(from_text(ANCHOR), os.path.join(ART, "hand", "icon_anchor.png"))


def finish():
    for name, rows in ICONS.items():
        check(name, rows)
        save(from_text(rows), os.path.join(ART, "sprites", "icons", name + ".png"))


if __name__ == "__main__":
    {"anchor": anchor, "finish": finish}[sys.argv[1]]()
