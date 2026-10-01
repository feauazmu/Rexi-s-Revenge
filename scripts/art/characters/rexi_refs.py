"""Inputs and outputs of Rexi's concept references (Refs #26): the character sheet and the title.

    uv run -q --with pillow --with numpy python scripts/art/characters/rexi_refs.py STEP

Steps, in the order they were run (the renders in art/raw/ are git-ignored, like every render;
their sidecars and the outputs here are committed). The image model would not move the sleeve
from one arm to the other (it changed nothing, or inked the arm holding the gavel), so every
edit starts from a picture where rough ink already sits on his right arm:
sheet  art/templates/ref_sheet_composite.png: reference/rexi-character-sheet-v2.png with its front
       view mirrored in place, so the sleeve sits on the viewer's left, his RIGHT arm; the side
       view (facing right, his right arm is the near arm) and the back view (sleeve on the
       viewer's right, his right arm from behind) already had it right. The back view was mirrored
       too by mistake, so `finish` turns it back. The edit (ref_rexi_sheet_v3) only redraws the
       sleeve as one continuous piece; ref_rexi_sheet_v4 ends it at the elbow.
finish reference/rexi-character-sheet.png from ref_rexi_sheet_v4: the back view mirrored back in
       place, and the tattoo inset (twice drawn as a lion next to a separate building) refilled
       with a 1x crop of the side view's own sleeve, shoulder to elbow, no resampling.
side   art/templates/ref_sheet_side.png and ref_sheet_front.png: crops of the new sheet, the design
       references of the sprite and portrait edits.
title-hint
       art/templates/ref_title_hint.png: ref_title_v4 (the title with its tattoo removed) with the
       sheet's front-view sleeve ink roughly pasted on the flexing arm, his RIGHT arm.
title-source
       reference/title-source.png: ref_title_v8 (the hint cleaned up into a sleeve) with the arm
       holding the gavel pasted back from ref_title_v4, because the edit inked that arm too.
title  public/title.png: reference/title-source.png centre-cropped to 16:9, resampled to 640x360
       by cell-centre medians and snapped to the master palette, with the sky flattened into one
       colour per row (the title illustration is the one decoded image, ADR 0002; #30 put it on
       the palette so the golden palette check covers the Title too).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageOps

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rexi_common import ROOT  # noqa: E402

REF = os.path.join(ROOT, "reference")
RAW = os.path.join(ROOT, "art", "raw")
TEMPLATES = os.path.join(ROOT, "art", "templates")

FRONT_X = (97, 499)                    # the sheet's front view columns (mirrored about its centre)
BACK_BOX = (902, 0, 1300, 566)         # the back view above the insets
SIDE_SLEEVE = (638, 192, 750, 364)     # the side view's upper arm, shoulder to elbow
SIDE_VIEW = (600, 30, 860, 750)        # the side view, head to boots
FRONT_UPPER = (95, 30, 500, 420)       # the front view, head to waist
FRONT_SLEEVE = (105, 185, 205, 372)    # the front view's sleeve (his right upper arm)
INSET = (920, 576, 1129, 748)          # the tattoo inset's interior
SHEET_GREY = (166, 169, 174)
INSET_FILL = (40, 36, 52)              # robe-dark backdrop: the arm reads against it as on the robe

TITLE_UPPER_ARM = (760, 285, 885, 425)   # the flexing arm's upper arm in ref_title_v4
TITLE_SHOULDER, TITLE_ELBOW = (858, 285), (792, 412)
TITLE_GAVEL_ARM = (1030, 185, 1250, 420)  # the arm holding the gavel (stays bare)


def _templates(name):
    os.makedirs(TEMPLATES, exist_ok=True)
    return os.path.join(TEMPLATES, name)


def sheet():
    im = Image.open(os.path.join(REF, "rexi-character-sheet-v2.png")).convert("RGB")
    out = im.copy()
    x0, x1 = FRONT_X
    out.paste(ImageOps.mirror(im.crop((x0, 0, x1, im.height))), (x0, 0))
    out.paste(ImageOps.mirror(im.crop(BACK_BOX)), BACK_BOX[:2])    # undone by `finish`
    path = _templates("ref_sheet_composite.png")
    out.save(path)
    return path


def finish(src=os.path.join(RAW, "ref_rexi_sheet_v4.png")):
    im = Image.open(src).convert("RGB")
    im.paste(ImageOps.mirror(im.crop(BACK_BOX)), BACK_BOX[:2])     # the sleeve on his right arm
    arm = np.asarray(im.crop(SIDE_SLEEVE)).copy()
    grey = (np.abs(arm.astype(int) - SHEET_GREY).sum(-1) < 40)     # the sheet's background
    arm[grey] = INSET_FILL
    arm = Image.fromarray(arm)
    x0, y0, x1, y1 = INSET
    im.paste(INSET_FILL, INSET)
    im.paste(arm, (x0 + (x1 - x0 - arm.width) // 2, y0 + (y1 - y0 - arm.height) // 2))
    out = os.path.join(REF, "rexi-character-sheet.png")
    im.save(out, optimize=True)
    return out


def side():
    sheet = Image.open(os.path.join(REF, "rexi-character-sheet.png")).convert("RGB")
    path = _templates("ref_sheet_side.png")
    sheet.crop(SIDE_VIEW).save(path)
    sheet.crop(FRONT_UPPER).save(_templates("ref_sheet_front.png"))
    return path


def title_hint(src=os.path.join(RAW, "ref_title_v4.png")):
    """The sheet's front-view sleeve ink, turned and scaled along the flexing arm's upper arm
    (shoulder to elbow), darkening only its skin."""
    im = np.asarray(Image.open(src).convert("RGB")).astype(int)
    sheet = Image.open(os.path.join(REF, "rexi-character-sheet.png")).convert("RGB").crop(FRONT_SLEEVE)
    ink = Image.fromarray(((np.asarray(sheet).astype(int).mean(-1) < 95) * 255).astype(np.uint8))
    (sx, sy), (ex, ey) = TITLE_SHOULDER, TITLE_ELBOW
    length = float(np.hypot(ex - sx, ey - sy))
    angle = float(np.degrees(np.arctan2(ex - sx, ey - sy)))         # from straight down, toward +x
    ink = ink.resize((max(1, round(sheet.width * length / sheet.height)), round(length)), Image.NEAREST)
    m = np.asarray(ink.rotate(angle, expand=True, resample=Image.NEAREST)) > 127
    x0 = int(round((sx + ex) / 2 - m.shape[1] / 2))
    y0 = int(round((sy + ey) / 2 - m.shape[0] / 2))
    out = im.copy()
    bx0, by0, bx1, by1 = TITLE_UPPER_ARM
    for y, x in zip(*np.nonzero(m)):
        X, Y = x + x0, y + y0
        if bx0 <= X < bx1 and by0 <= Y < by1:
            r, g, b = im[Y, X]
            if r > 150 and r > g + 25 and g > b:                    # tanned skin only
                out[Y, X] = (70, 38, 30)
    path = _templates("ref_title_hint.png")
    Image.fromarray(out.astype(np.uint8)).save(path)
    return path


def title_source(edit=os.path.join(RAW, "ref_title_v8.png"), clean=os.path.join(RAW, "ref_title_v4.png")):
    """The edit keeps the picture's geometry, so the gavel arm's box pastes back seamlessly."""
    im = Image.open(edit).convert("RGB")
    im.paste(Image.open(clean).convert("RGB").crop(TITLE_GAVEL_ARM), TITLE_GAVEL_ARM[:2])
    path = os.path.join(REF, "title-source.png")
    im.save(path, optimize=True)
    return path


SKY_BOTTOM = 226          # title rows above the sun's top and the skyline: open sky only
SKY_MATCH = 14.0          # CIELAB distance from a row's sky colour that still counts as sky
SKY_SAMPLE = (0, 300)     # columns of pure sky (left of Rexi, the logo goes there) for each row


def title(src=os.path.join(REF, "title-source.png"), out=os.path.join(ROOT, "public", "title.png")):
    """Centre-crop to 16:9, take each 640x360 cell's centre median (no smoothing across cell
    edges, so outlines stay hard) and snap it to the master palette in CIELAB. The sky is then
    flattened into one palette colour per row: the source's soft gradient noise would otherwise
    snap into speckles between neighbouring ramp steps. A sky cell is one that is close to its
    row's sky colour and connected to the open sky, so Rexi, the gavel and the Enemies keep
    their pixels."""
    from pixelize import label, snap, to_lab

    a = np.asarray(Image.open(src).convert("RGB")).astype(float)
    h, w = a.shape[:2]
    cw, ch = (w, round(w * 9 / 16)) if w * 9 <= h * 16 else (round(h * 16 / 9), h)
    a = a[(h - ch) // 2:(h - ch) // 2 + ch, (w - cw) // 2:(w - cw) // 2 + cw]
    s, r = cw / 640, cw / 640 * 0.3
    grid = np.zeros((360, 640, 4), np.uint8)
    grid[..., 3] = 255
    for j in range(360):
        cy = (j + 0.5) * s
        for i in range(640):
            cx = (i + 0.5) * s
            cell = a[int(cy - r):int(cy + r) + 1, int(cx - r):int(cx + r) + 1]
            grid[j, i, :3] = np.median(cell.reshape(-1, 3), axis=0)
    rows = np.median(grid[:SKY_BOTTOM, SKY_SAMPLE[0]:SKY_SAMPLE[1], :3], axis=1)   # (rows, 3)
    near = np.sqrt(((to_lab(grid[:SKY_BOTTOM, :, :3].astype(float))
                     - to_lab(rows)[:, None, :]) ** 2).sum(-1)) < SKY_MATCH
    lab, _ = label(near, conn8=False)
    open_sky = set(np.unique(lab[:, SKY_SAMPLE[0]:SKY_SAMPLE[1]])) - {0}
    sky = np.isin(lab, list(open_sky))
    flat = grid[:SKY_BOTTOM].copy()
    flat[..., :3] = np.repeat(rows[:, None, :], 640, axis=1)
    grid[:SKY_BOTTOM][sky] = flat[sky]
    Image.fromarray(snap(grid)).save(out, optimize=True)
    return out


STEPS = {"sheet": sheet, "finish": finish, "side": side, "title-hint": title_hint,
         "title-source": title_source, "title": title}

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd not in STEPS:
        sys.exit(__doc__)
    print(os.path.relpath(STEPS[cmd](), ROOT))
