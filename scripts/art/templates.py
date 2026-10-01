"""Reference images for the image model, built in code on the model's art grid (ADR 0002).

Gemini draws pixel art on a grid about 240 cells wide at any output size (manus-garden's finding,
confirmed by the version C prototype). Every template is drawn at 1 cell = 1 art pixel on that
grid and upscaled NEAREST to the 2K output (2752x1536), so the model sees the exact art-pixel
size, and the size anchor sits inside the image being edited. `save` writes both <name>.png
(what is passed to the model) and <name>_1x.png (the cells, for reading).

Builders (each returns a PIL RGBA image on the grid):
  editsheet(sprite, n)          n copies of a master on one ground row: keyframe edits
  lineup(anchor, draft, n)      a proven sprite as density anchor + n drafts with ground lines and
                                head-top ticks at the target height: masters
  slotsheet(anchor, n, box)     a size anchor + n empty slots, each with a light box of the
                                largest allowed size: props, enemies (flying: ground=None);
                                optionally a draft in each box and an explicit slot layout
  icongrid(n, cell, anchor)     n icon cells with guides, an accepted icon in cell 0
  poseguide(poses, n)           two-tone stick figures in the editsheet's slots
  draft(image, size, allowed)   a picture box-downscaled to its in-game size and palette-snapped:
                                a blurry draft fixing size, proportions and colours
  scene_tiles(draft, step)      a 640x360 scene draft cut into 240x135 tiles (one edit each, then
                                re-assembled by clean's `tiles`)
"""
import os

import numpy as np
from PIL import Image, ImageDraw

from pixelize import snap

GW, GH = 240, 135                 # the model's art grid for 16:9
FULL = (2752, 1536)               # 2K 16:9 output size
GROUND = 100                      # default ground row (feet stand on GROUND - 1)
GUIDE = (170, 170, 170)
TICK = (212, 212, 212)
BOX = (226, 226, 226)
NEAR, FAR = (105, 105, 105), (200, 200, 200)   # two-tone pose guides: the near limb is darker


def save(project, im, name):
    out = project.path("templates")
    os.makedirs(out, exist_ok=True)
    im.convert("RGB").resize(FULL, Image.NEAREST).save(os.path.join(out, name + ".png"))
    im.save(os.path.join(out, name + "_1x.png"))
    return os.path.join(out, name + ".png")


def _img(sprite):
    im = Image.fromarray(sprite) if isinstance(sprite, np.ndarray) else sprite.convert("RGBA")
    box = im.getbbox()
    return im.crop(box) if box else im


def blank():
    return Image.new("RGBA", (GW, GH), "white")


def editsheet(sprite, n, ground=GROUND):
    im = blank()
    m = _img(sprite)
    sw = GW // n
    for c in range(n):
        im.alpha_composite(m, (c * sw + sw // 2 - m.width // 2, ground - m.height))
    return im


def lineup(anchor, draft, n=3, height=64, ground=GROUND):
    """Slot 1: the anchor (a sprite already on the 240 grid); slots 2..n+1: the draft, each with a
    ground line and a short tick one row above the target head top."""
    im = blank(); d = ImageDraw.Draw(im)
    sw = GW // (n + 1)
    a = _img(anchor)
    im.alpha_composite(a, (sw // 2 - a.width // 2, ground - a.height))
    r = _img(draft)
    for c in range(1, n + 1):
        cx = c * sw + sw // 2
        d.line([(cx - sw // 2 + 4, ground), (cx + sw // 2 - 4, ground)], fill=GUIDE)
        d.line([(cx - 6, ground - height - 1), (cx + 6, ground - height - 1)], fill=TICK)
        im.alpha_composite(r, (cx - r.width // 2, ground - r.height))
    return im


def slotsheet(anchor, n, box, ground=GROUND, draft=None, slots=None, anchor_at=None):
    """Slot 0: the size anchor standing on the ground; slots 1..n: a light box `box` (w, h) of the
    largest allowed size, bottom on the ground row (or vertically centred when ground is None,
    for flying Enemies), for the model to draw into. `draft` (a sprite on the grid) is drawn
    centred in every box: a blurry guide fixing size and composition. `slots` [[cx, cy], ...]
    places the box centres explicitly and `anchor_at` [cx, bottom] the anchor, for boxes too
    wide for one row (n is then len(slots))."""
    im = blank(); d = ImageDraw.Draw(im)
    sw = GW // (n + 1)
    a = _img(anchor)
    base = ground if ground is not None else GH // 2 + a.height // 2
    ax, ab = anchor_at if anchor_at else (sw // 2, base)
    im.alpha_composite(a, (ax - a.width // 2, ab - a.height))
    bw, bh = box
    centres = slots or [(c * sw + sw // 2, (ground - bh // 2) if ground is not None else GH // 2)
                        for c in range(1, n + 1)]
    r = _img(draft) if draft is not None else None
    for cx, cy in centres:
        top = cy - bh // 2
        d.rectangle([cx - bw // 2, top, cx + bw // 2 - 1, top + bh - 1], outline=BOX)
        if ground is not None and not slots:
            d.line([(cx - sw // 2 + 4, ground), (cx + sw // 2 - 4, ground)], fill=GUIDE)
        if r is not None:
            im.alpha_composite(r, (cx - r.width // 2, cy - r.height // 2))
    return im


def icongrid(n, cell, anchor=None, cols=None):
    """n cells of `cell` px with a light frame each, laid out in rows; cell 0 holds `anchor`."""
    cols = cols or min(n, 8)
    rows = -(-n // cols)
    gap = max(4, cell // 2)
    im = blank(); d = ImageDraw.Draw(im)
    x0 = (GW - (cols * (cell + gap) - gap)) // 2
    y0 = (GH - (rows * (cell + gap) - gap)) // 2
    for i in range(n):
        x, y = x0 + (i % cols) * (cell + gap), y0 + (i // cols) * (cell + gap)
        d.rectangle([x - 1, y - 1, x + cell, y + cell], outline=BOX)
        if i == 0 and anchor is not None:
            a = _img(anchor)
            im.alpha_composite(a, (x + (cell - a.width) // 2, y + (cell - a.height) // 2))
    return im


def _stick(d, pts, width=2):
    head = pts["head"]
    d.ellipse([head[0] - 4, head[1] - 5, head[0] + 4, head[1] + 4], outline=GUIDE, width=width)
    two = pts.get("twotone")
    for a, b in (("neck", "hip"), ("neck", "elbowN"), ("elbowN", "handN"), ("neck", "elbowF"),
                 ("elbowF", "handF"), ("hip", "kneeN"), ("kneeN", "footN"), ("hip", "kneeF"), ("kneeF", "footF")):
        if a in pts and b in pts:
            col = (NEAR if "N" in a + b else FAR) if two else GUIDE
            d.line([pts[a], pts[b]], fill=col, width=width)


def poseguide(poses, ground=GROUND):
    """poses: list of joint dicts in slot-local coords (x from the slot centre, y = grid row):
    head, neck, hip, elbowN/F, handN/F, kneeN/F, footN/F; "twotone": True draws the near limbs
    dark and the far ones light (tell the model which is which in the prompt)."""
    im = Image.new("RGB", (GW, GH), "white"); d = ImageDraw.Draw(im)
    sw = GW // len(poses)
    for c, pose in enumerate(poses):
        cx = c * sw + sw // 2
        d.line([(cx - sw // 2 + 4, ground), (cx + sw // 2 - 4, ground)], fill=GUIDE)
        _stick(d, {k: (v if k == "twotone" else (cx + v[0], v[1])) for k, v in pose.items()})
    return im.convert("RGBA")


def draft(image, size, allowed=None, alpha=None):
    """Area-average `image` (PIL) down to `size` and snap it to the palette. `alpha` (a PIL L
    mask of the same size as `image`) keeps the figure and drops its background."""
    small = image.convert("RGB").resize(size, Image.BOX)
    a = np.full(size[::-1], 255, np.uint8) if alpha is None else \
        (np.asarray(alpha.resize(size, Image.BOX)) > 110).astype(np.uint8) * 255
    return snap(np.dstack([np.asarray(small), a]).astype(np.uint8), allowed)


def scene_tiles(scene, step=(200, 113), tile=(GW, GH)):
    """Cut a scene draft (RGBA array at game size, e.g. 640x360) into overlapping grid-sized
    tiles: [(row, col, (x, y), tile image)]. Tile (r, c) starts at (c * step_x, r * step_y), so
    neighbours overlap by tile - step cells; edges are padded with the scene's edge pixels."""
    h, w = scene.shape[:2]
    tw, th = tile
    out = []
    rows = max(1, -(-(h - th) // step[1]) + 1)
    cols = max(1, -(-(w - tw) // step[0]) + 1)
    padded = np.pad(scene, ((0, max(0, (rows - 1) * step[1] + th - h)), (0, max(0, (cols - 1) * step[0] + tw - w)), (0, 0)),
                    mode="edge")
    for r in range(rows):
        for c in range(cols):
            x, y = c * step[0], r * step[1]
            out.append((r, c, (x, y), Image.fromarray(padded[y:y + th, x:x + tw].copy())))
    return out
