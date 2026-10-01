"""Enclosed transparent holes in sprites: the audit, and the fill clean.py applies.

    python Art/tools/holes.py                 # audit every sprite PNG under Art/ (counts per file)
    python Art/tools/holes.py -v FILE ...     # one line per hole: seed, size, box, hidden colour, ring

A hole is a 4-connected transparent region that the image border can't reach. The palette cleanup
(pixelize.drop_pale) drops small white and pale components, even on keep_white sheets, so white
eyebrows, lens glints, shirt stripes, sugar specks and roof ribs came out as holes. It zeroes only
the alpha, so the dropped cell still carries the colour the grid snapped it to (the "hidden
colour"); filling a hole restores that colour.

Not every hole is lost white. Background also showed through real gaps: between an arm and the
body, between legs, through a basket handle or between pergola slats. Two rules tell them apart:
  - a hole whose ring (the opaque cells around it) is only outline ink is air between two parts,
    so `fill` keeps it open unless a seed names it;
  - any other hole is filled when `auto` is on, except the ones a `keep` seed names.
Seeds are (x, y) points in the saved sprite; each names the hole that contains it. A fill seed may
carry a colour ("#rrggbb") to use instead of the hidden one. `-v` prints each hole's seed.

`seal` names canvas sides that are a crop line rather than open air (a portrait's bottom edge
cuts through the shirt), so holes that only reach those sides still count as enclosed.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pixelize import hex2rgb, label  # noqa: E402

ART = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "reference", "manu-pipeline")
INK = 60            # an opaque cell darker than this in every channel is outline ink
SKIP = ("raw/", "build/", "templates/", "comparison/", "anim/", "prompts/")


def find(sp, seal=()):
    """Holes of an RGBA sprite: dicts with mask, seed (x, y), size and ink_only."""
    opaque = sp[..., 3] > 0
    lab, sizes = label(~opaque, conn8=False)
    sides = {"top": lab[0], "bottom": lab[-1], "left": lab[:, 0], "right": lab[:, -1]}
    outside = {int(i) for side, row in sides.items() if side not in seal for i in row}
    ink = opaque & (sp[..., :3].max(-1) < INK)
    out = []
    for i in range(1, len(sizes)):
        if i in outside:
            continue
        m = lab == i
        grown = m.copy()
        grown[1:] |= m[:-1]; grown[:-1] |= m[1:]; grown[:, 1:] |= m[:, :-1]; grown[:, :-1] |= m[:, 1:]
        ring = grown & ~m & opaque
        ys, xs = np.nonzero(m)
        out.append({"mask": m, "seed": (int(xs[0]), int(ys[0])), "size": int(m.sum()),
                    "box": (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())),
                    "ink_only": not (ring & ~ink).any(), "ring": ring})
    return out


def fill(sp, auto=True, keep=(), fill=(), seal=()):
    """Fill the holes of `sp` (see the module doc). Returns (sprite, number of cells filled)."""
    sp = sp.copy()
    hs = find(sp, seal)
    at = lambda pt: next((h for h in hs if h["mask"][pt[1], pt[0]]), None)
    kept = {id(at(p)) for p in keep}
    forced = {id(h): (p[2] if len(p) > 2 else None) for p in fill if (h := at(p)) is not None}
    for p in list(keep) + list(fill):
        if at(p) is None:
            raise ValueError(f"no hole at {tuple(p[:2])}")
    n = 0
    for h in hs:
        if id(h) in forced:
            colour = forced[id(h)]
        elif auto and not h["ink_only"] and id(h) not in kept:
            colour = None
        else:
            continue
        m = h["mask"]
        if colour:
            sp[m, :3] = hex2rgb(colour)
        elif not sp[m, :3].any():          # no hidden colour: the lightest non-ink ring cell
            ring = sp[h["ring"], :3]
            ring = ring[ring.max(-1) >= INK] if (ring.max(-1) >= INK).any() else ring
            sp[m, :3] = ring[ring.astype(int).sum(-1).argmax()]
        sp[m, 3] = 255
        n += int(m.sum())
    return sp, n


def audit(paths, verbose=False):
    total = 0
    for p in paths:
        rel = os.path.relpath(p, ART)
        sp = np.asarray(Image.open(p).convert("RGBA"))
        hs = find(sp)
        if not hs:
            continue
        air = [h for h in hs if h["ink_only"]]
        rest = [h for h in hs if not h["ink_only"]]
        total += len(rest)
        print(f"{rel}: {len(rest)} holes ({sum(h['size'] for h in rest)} px), "
              f"{len(air)} ink-ringed ({sum(h['size'] for h in air)} px)")
        if verbose:
            for h in hs:
                m = h["mask"]
                hid = {"#%02x%02x%02x" % tuple(c) for c in sp[m, :3]}
                ring = {"#%02x%02x%02x" % tuple(c) for c in sp[h["ring"], :3]}
                print(f"   seed {h['seed']} {h['size']:4d} px box {h['box']} {'ink ' if h['ink_only'] else ''}"
                      f"hidden {sorted(hid)} ring {sorted(ring)}")
    return total


if __name__ == "__main__":
    args = sys.argv[1:]
    verbose = "-v" in args
    args = [a for a in args if a != "-v"]
    if not args:
        args = sorted(p for p in glob.glob(os.path.join(ART, "**", "*.png"), recursive=True)
                      if not os.path.relpath(p, ART).startswith(SKIP))
    audit(args, verbose)
