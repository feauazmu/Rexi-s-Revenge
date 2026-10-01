"""Inputs and outputs of Rexi's concept references (Refs #26): the character sheet and the title.

    uv run -q --with pillow --with numpy python scripts/art/characters/rexi_refs.py STEP

Steps, in the order they were run (the renders in art/raw/ are git-ignored, like every render;
their sidecars and the outputs here are committed):
sheet  art/templates/ref_sheet_composite.png: reference/rexi-character-sheet-v2.png with its front
       and back views mirrored in place, so the sleeve already sits on his RIGHT arm (viewer's left
       in front, viewer's right in back); the side view (facing right: his right arm is the near
       arm) and the insets are kept. The sheet edit (art/prompts/ref_rexi_sheet_v3.txt) starts from
       it and only redraws the sleeve as one continuous piece, so the model never has to move ink
       from one arm to the other (it failed at that before, see CREDITS.md).
finish reference/rexi-character-sheet.png from the chosen edit (art/raw/ref_rexi_sheet_v4.png): the
       model kept drawing the tattoo inset as a lion next to a separate building, so the inset is
       refilled with a 1x crop of the side view's own sleeve (shoulder to elbow), no resampling.
side   art/templates/ref_sheet_side.png and ref_sheet_front.png: crops of the new sheet, the design
       references of the sprite and portrait edits.
title-mirror
       art/templates/ref_title_mirrored.png: ref_title_v4 (the title with the tattoo removed)
       mirrored. The model always inks the arm holding the gavel, so the sleeve is added to the
       mirrored picture (ref_title_v6), whose gavel arm is then his right arm.
title-source
       reference/title-source.png: Rexi cut from ref_title_v6 and pasted unmirrored onto
       ref_title_plate (an empty plate of the original layout): the same composition and logo sky,
       the gavel in his inked right hand.
title  public/title.png: reference/title-source.png centre-cropped to 16:9 and downscaled to
       640x360 with Lanczos smoothing (the title illustration is the one decoded image, ADR 0002).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rexi_common import ROOT  # noqa: E402

REF = os.path.join(ROOT, "reference")
FRONT_X = (97, 499)          # the front view's columns (it is mirrored about its own centre)
BACK_BOX = (902, 0, 1300, 566)   # the back view above the insets
SIDE_SLEEVE = (638, 192, 750, 364)  # the side view's upper arm (shoulder to elbow) in ref_rexi_sheet_v4.png
SIDE_VIEW = (600, 30, 860, 750)     # the side view, head to boots
FRONT_UPPER = (95, 30, 500, 420)    # the front view, head to waist
INSET = (920, 576, 1129, 748)       # the tattoo inset's interior
SHEET_GREY = (166, 169, 174)
INSET_FILL = (40, 36, 52)           # robe-dark backdrop: the arm reads against it like on the robe
TITLE_FIGURE_X_MAX = 760          # Rexi's figure in the mirrored edit lies left of this column
TITLE_FIGURE_SEED = (420, 330)     # a pixel of his tank top in the mirrored edit


def sheet():
    im = Image.open(os.path.join(REF, "rexi-character-sheet-v2.png")).convert("RGB")
    out = im.copy()
    x0, x1 = FRONT_X
    out.paste(ImageOps.mirror(im.crop((x0, 0, x1, im.height))), (x0, 0))
    out.paste(ImageOps.mirror(im.crop(BACK_BOX)), BACK_BOX[:2])
    path = os.path.join(ROOT, "art", "templates", "ref_sheet_composite.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path)
    return path


def finish(src=os.path.join(ROOT, "art", "raw", "ref_rexi_sheet_v4.png")):
    im = Image.open(src).convert("RGB")
    arm = np.asarray(im.crop(SIDE_SLEEVE)).copy()
    grey = (np.abs(arm.astype(int) - SHEET_GREY).sum(-1) < 40)   # the sheet's background
    arm[grey] = INSET_FILL
    arm = Image.fromarray(arm)
    x0, y0, x1, y1 = INSET
    im.paste(INSET_FILL, INSET)
    im.paste(arm, (x0 + (x1 - x0 - arm.width) // 2, y0 + (y1 - y0 - arm.height) // 2))
    out = os.path.join(REF, "rexi-character-sheet.png")
    im.save(out, optimize=True)
    return out


def side():
    """art/templates/ref_sheet_side.png (and ref_sheet_front.png): the new sheet's side view (facing right, the sleeve on the
    near arm), the one view a sprite edit may see (never the whole sheet: the model copies it)."""
    sheet = Image.open(os.path.join(REF, "rexi-character-sheet.png")).convert("RGB")
    path = os.path.join(ROOT, "art", "templates", "ref_sheet_side.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.crop(SIDE_VIEW).save(path)
    # and the front view's upper half (the sleeve on the viewer's left), for the portrait
    sheet.crop(FRONT_UPPER).save(os.path.join(ROOT, "art", "templates", "ref_sheet_front.png"))
    return path


def title_mirror(src=os.path.join(ROOT, "art", "raw", "ref_title_v4.png")):
    path = os.path.join(ROOT, "art", "templates", "ref_title_mirrored.png")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    ImageOps.mirror(Image.open(src).convert("RGB")).save(path)
    return path


def _grow(m, n):
    for _ in range(n):
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        m = g
    return m


def _shrink(m, n):
    return ~_grow(~m, n)


def _flood(seed, inside, step=8):
    """The part of `inside` connected to the `seed` mask."""
    reach = seed & inside
    while True:
        grown = _grow(reach, step) & inside
        if (grown == reach).all():
            return reach
        reach = grown


def figure_mask(edit, plate, x_max=TITLE_FIGURE_X_MAX, seed=TITLE_FIGURE_SEED, threshold=60):
    """Where `edit` (the mirrored edit, Rexi on the left) differs from the mirrored empty plate:
    Rexi and his gavel. Closed, holes filled, only the piece connected to `seed` (his tank top),
    limited to x < x_max, then the light fringe the edit left along his outline trimmed."""
    px = np.asarray(edit).astype(int)
    d = np.abs(px - np.asarray(plate).astype(int)).sum(-1) > threshold
    d[:, x_max:] = False
    d = _shrink(_grow(d, 3), 3)
    border = np.zeros_like(d)
    border[0], border[-1], border[:, 0], border[:, -1] = True, True, True, True
    m = ~_flood(border, ~d)                                 # holes filled
    s = np.zeros_like(m)
    s[seed[1], seed[0]] = True
    m = _flood(s, m)
    m &= _grow(_shrink(m, 3), 3)                            # opening: drops thin background wisps
    m = _flood(s, m)
    light = px.sum(-1) > 3 * 150
    for _ in range(2):                                      # the outline is dark: drop light edge pixels
        edge = m & ~_shrink(m, 1)
        m &= ~(edge & light)
    return m


def title_source(edit=os.path.join(ROOT, "art", "raw", "ref_title_v6.png"),
                 plate=os.path.join(ROOT, "art", "raw", "ref_title_plate.png")):
    """reference/title-source.png: the empty plate (the original layout: courthouse on the left,
    empty sky for the logo) with Rexi cut from ref_title_v6 (an edit of the mirrored picture, the
    only way the model put the sleeve on the right arm: it always inks the gavel arm) pasted
    unmirrored where he stood, so he holds the gavel in his right hand and wears the sleeve on
    that arm."""
    e = Image.open(edit).convert("RGB")
    p = Image.open(plate).convert("RGB")
    mask = figure_mask(e, ImageOps.mirror(p))
    ys, xs = np.nonzero(mask)
    x0, x1 = xs.min(), xs.max()
    dx = (e.width - 1 - x1) - x0                          # his box lands on the original's box
    out = np.asarray(p).copy()
    src = np.asarray(e)
    out[ys, xs + dx] = src[ys, xs]
    path = os.path.join(REF, "title-source.png")
    Image.fromarray(out).save(path, optimize=True)
    return path


def title(src=os.path.join(REF, "title-source.png"), out=os.path.join(ROOT, "public", "title.png")):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    cw, ch = (w, round(w * 9 / 16)) if w * 9 <= h * 16 else (round(h * 16 / 9), h)
    box = ((w - cw) // 2, (h - ch) // 2, (w - cw) // 2 + cw, (h - ch) // 2 + ch)
    im.crop(box).resize((640, 360), Image.LANCZOS).convert("RGBA").save(out, optimize=True)
    return out


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    steps = {"sheet": sheet, "finish": finish, "side": side, "title-mirror": title_mirror, "title-source": title_source,
             "title": title}
    if cmd not in steps:
        sys.exit(__doc__)
    print(os.path.relpath(steps[cmd](), ROOT))
