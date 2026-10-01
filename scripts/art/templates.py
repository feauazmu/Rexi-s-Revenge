"""Reference images passed to the image model (written to reference/manu-pipeline/templates/).

Gemini draws pixel art on a grid about 240 cells wide at any output size (manus-garden's finding).
Every template is drawn at 1 cell = 1 art pixel on that grid and upscaled NEAREST to the 2K
output size, so the model sees the exact art-pixel size: the size anchor is inside the image
being edited (manus-garden lesson 1).

  anchor     the side view of reference/rexi-character-sheet.png box-downscaled to 64 px tall and
             snapped to the palette: a rough draft at the exact in-game size, redrawn in place
  editsheet  N copies of the cleaned master on a shared ground row (keyframe edits)
  poseguide  grey stick figures in the same N slots (run contact, run passing, jump, hurt, arm)

    uv run -q --with pillow --with numpy python scripts/art/templates.py
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import ROOT  # noqa: E402
from pixelize import snap  # noqa: E402

OUT = os.path.join(ROOT, "reference", "manu-pipeline", "templates")
GW, GH = 240, 135                 # the model's art grid for 16:9
FULL = (2752, 1536)               # 2K 16:9 output size
HEIGHT = 64                       # Rexi's height in art pixels (640x360 game)
GROUND = 100                      # ground row on the grid (feet stand on GROUND - 1)
GUIDE = (170, 170, 170)
NEAR, FAR = (105, 105, 105), (200, 200, 200)   # two-tone guides: the near leg is the darker one
SIDE_BOX = (630, 47, 815, 737)    # side view in the 1376x768 character sheet


def save(im, name):
    os.makedirs(OUT, exist_ok=True)
    im.convert("RGB").resize(FULL, Image.NEAREST).save(os.path.join(OUT, name + ".png"))
    im.save(os.path.join(OUT, name + "_1x.png"))


def side_anchor():
    """The character sheet's side view at 64 px: area-average downscale, then palette snap.
    Blurry on purpose: it fixes size, proportions and colours, the model supplies the pixels."""
    sheet = Image.open(os.path.join(ROOT, "reference", "rexi-character-sheet.png")).convert("RGB")
    crop = sheet.crop(SIDE_BOX)
    a = np.asarray(crop).astype(int)
    bg = np.array([170, 174, 181])
    fg = (np.abs(a - bg).sum(-1) > 40).astype(np.uint8) * 255
    w = round(crop.width * HEIGHT / crop.height)
    small = crop.resize((w, HEIGHT), Image.BOX)
    alpha = Image.fromarray(fg).resize((w, HEIGHT), Image.BOX)
    g = np.dstack([np.asarray(small), (np.asarray(alpha) > 110).astype(np.uint8) * 255])
    return snap(g.astype(np.uint8), char=True)


def anchor_sheet():
    """The rough 64 px draft alone, feet on the ground row, horizontally centred."""
    im = Image.new("RGBA", (GW, GH), "white")
    sp = Image.fromarray(side_anchor())
    im.alpha_composite(sp, (GW // 2 - sp.width // 2, GROUND - HEIGHT))
    save(im, "anchor_side")
    return sp


MANU = "/Users/felipe/github/feauazmu/manus-garden/Art/characters/manu/master_dr.png"


def density_sheet(draft_png):
    """Second master attempt. v1 came back on a 480-cell grid (128 px tall), so this template
    puts a proven 240-grid sprite beside the draft: Manu (manus-garden, 78 px) on the left as a
    pixel-density anchor, and the v1 render reduced 2:1 to 64 px (scripts/art/reduce.py) in the
    centre, to be redrawn in place."""
    im = Image.new("RGBA", (GW, GH), "white")
    m = Image.open(MANU).convert("RGBA"); m = m.crop(m.getbbox())
    im.alpha_composite(m, (60 - m.width // 2, GROUND - m.height))
    d = Image.open(draft_png).convert("RGBA"); d = d.crop(d.getbbox())
    im.alpha_composite(d, (GW // 2 - d.width // 2, GROUND - d.height))
    save(im, "density_side")


def coarse_sheet(draft_png, name="coarse_side", n=1, gw=160, ground=84):
    """Third master attempt. Flash redraws a figure at whatever share of the image height it
    likes (v1: 128 cells tall on a 480-cell grid, v2: 98 cells on the 240 grid), so instead of
    fighting that, the grid is made coarser: 160x90 cells (17.2 output px per art pixel), where
    a 64 px Rexi already fills ~70% of the height, the share the model drew him at both times."""
    gh = gw * 9 // 16
    im = Image.new("RGBA", (gw, gh), "white")
    d = Image.open(draft_png).convert("RGBA") if isinstance(draft_png, str) else Image.fromarray(draft_png)
    d = d.crop(d.getbbox())
    sw = gw // n
    for c in range(n):
        im.alpha_composite(d, (c * sw + sw // 2 - d.width // 2, ground - d.height))
    save(im, name)


def cast_sheet(draft_png, copies=3):
    """Fourth master attempt (manus-garden's cast_row: a lineup with head-top and ground lines).
    Slot 1 is Manu (78 px, a proven 240-grid sprite) as the pixel-density anchor; slots 2.. hold
    copies of the 64 px draft, each with a ground line and a short head-top tick. A crowded row
    keeps the model from enlarging the figure (v2 drew a lone figure 98 px tall), and the copies
    give several samples of the master for the price of one call."""
    im = Image.new("RGBA", (GW, GH), "white"); d = ImageDraw.Draw(im)
    n = copies + 1; sw = GW // n
    m = Image.open(MANU).convert("RGBA"); m = m.crop(m.getbbox())
    im.alpha_composite(m, (sw // 2 - m.width // 2, GROUND - m.height))
    r = Image.open(draft_png).convert("RGBA"); r = r.crop(r.getbbox())
    for c in range(1, n):
        cx = c * sw + sw // 2
        d.line([(cx - sw // 2 + 4, GROUND), (cx + sw // 2 - 4, GROUND)], fill=GUIDE)
        d.line([(cx - 6, GROUND - HEIGHT - 1), (cx + 6, GROUND - HEIGHT - 1)], fill=(212, 212, 212))
        im.alpha_composite(r, (cx - r.width // 2, GROUND - r.height))
    save(im, "cast_side")


def side_crop():
    """The side view alone, cropped out of the character sheet (design reference: passing the
    whole sheet made v3 redraw the sheet instead of editing the template)."""
    sheet = Image.open(os.path.join(ROOT, "reference", "rexi-character-sheet.png")).convert("RGB")
    x0, y0, x1, y1 = SIDE_BOX
    c = sheet.crop((x0 - 60, y0 - 10, x1 + 60, y1 + 10))
    c.save(os.path.join(OUT, "sheet_side_crop.png"))


def editsheet(master, name, n):
    """n copies of a master sprite (RGBA array) in one row, feet on the shared ground row."""
    im = Image.new("RGBA", (GW, GH), "white")
    m = Image.fromarray(master); m = m.crop(m.getbbox())
    sw = GW // n
    for c in range(n):
        cx = c * sw + sw // 2
        im.alpha_composite(m, (cx - m.width // 2, GROUND - m.height))
    save(im, name)


def _stick(d, pts, width=2):
    """A grey stick figure: pts = dict of named joints in grid coords."""
    head = pts["head"]
    d.ellipse([head[0] - 4, head[1] - 5, head[0] + 4, head[1] + 4], outline=GUIDE, width=width)
    for a, b in (("neck", "hip"), ("neck", "elbowN"), ("elbowN", "handN"), ("neck", "elbowF"),
                 ("elbowF", "handF"), ("hip", "kneeN"), ("kneeN", "footN"), ("hip", "kneeF"), ("kneeF", "footF")):
        if a in pts and b in pts:
            col = NEAR if "N" in a + b and pts.get("twotone") else FAR if "F" in a + b and pts.get("twotone") else GUIDE
            d.line([pts[a], pts[b]], fill=col, width=width)


# Pose guides, facing right, in slot-local coords: x relative to the slot centre, y = grid row.
# Built from Rexi's 64 px proportions: head top 36, neck 47, hip 70, knee 83, feet 99.
T, NECK, HIP, KNEE, FEET = GROUND - HEIGHT, GROUND - 53, GROUND - 30, GROUND - 16, GROUND - 1
POSES = {   # the near (tattooed) arm is left out: it becomes the separate aiming arm
    "contact": dict(head=(3, T + 6), neck=(2, NECK), hip=(0, HIP + 1),
                    elbowF=(7, NECK + 10), handF=(12, NECK + 16), kneeN=(7, KNEE), footN=(13, FEET),
                    kneeF=(-4, KNEE + 1), footF=(-12, FEET - 3)),
    "passing": dict(head=(3, T + 5), neck=(2, NECK - 1), hip=(0, HIP - 1),
                    elbowF=(2, NECK + 12), handF=(4, NECK + 21), kneeN=(0, KNEE), footN=(0, FEET),
                    kneeF=(7, KNEE - 5), footF=(0, FEET - 8)),
    "jump": dict(head=(3, T + 2), neck=(2, NECK - 3), hip=(0, HIP - 5),
                 elbowF=(9, NECK - 6), handF=(8, NECK - 15), kneeN=(9, KNEE - 12), footN=(3, FEET - 14),
                 kneeF=(-1, KNEE - 6), footF=(-7, FEET - 10)),
    "hurt": dict(head=(-6, T + 9), neck=(-4, NECK + 2), hip=(1, HIP + 1),
                 elbowF=(6, NECK - 5), handF=(11, NECK - 12), kneeN=(6, KNEE), footN=(9, FEET),
                 kneeF=(-3, KNEE + 1), footF=(-8, FEET)),
}
# Second key sheet: the rest of the run cycle and the jump arc. Two-tone legs (near = dark). No
# arms: both arms stay as in the master (the far arm is replaced by the aiming arm in code).
POSES.update({
    "downA": dict(head=(3, T + 7), neck=(2, NECK + 1), hip=(0, HIP + 2), kneeN=(6, KNEE + 1), footN=(9, FEET),
                  kneeF=(-5, KNEE - 1), footF=(-11, FEET - 6)),
    "contactB": dict(head=(3, T + 6), neck=(2, NECK), hip=(0, HIP + 1), kneeF=(7, KNEE), footF=(13, FEET),
                     kneeN=(-4, KNEE + 1), footN=(-12, FEET - 3)),
    "downB": dict(head=(3, T + 7), neck=(2, NECK + 1), hip=(0, HIP + 2), kneeF=(6, KNEE + 1), footF=(9, FEET),
                  kneeN=(-5, KNEE - 1), footN=(-11, FEET - 6)),
    "passingB": dict(head=(3, T + 5), neck=(2, NECK - 1), hip=(0, HIP - 1), kneeF=(0, KNEE), footF=(0, FEET),
                     kneeN=(7, KNEE - 5), footN=(0, FEET - 8)),
    "rise": dict(head=(3, T - 2), neck=(2, NECK - 7), hip=(0, HIP - 8), kneeN=(2, KNEE - 7), footN=(-1, FEET - 6),
                 kneeF=(-1, KNEE - 7), footF=(-5, FEET - 7)),
    "fall": dict(head=(3, T - 1), neck=(2, NECK - 6), hip=(0, HIP - 7), kneeN=(6, KNEE - 8), footN=(5, FEET - 5),
                 kneeF=(-2, KNEE - 6), footF=(-4, FEET - 3)),
    "land": dict(head=(4, T + 9), neck=(3, NECK + 4), hip=(-1, HIP + 6), kneeN=(8, KNEE + 3), footN=(7, FEET),
                 kneeF=(4, KNEE + 4), footF=(-5, FEET)),
    "hurt2": dict(head=(-8, T + 11), neck=(-6, NECK + 4), hip=(1, HIP + 2), kneeN=(7, KNEE + 1), footN=(10, FEET),
                  kneeF=(-2, KNEE + 2), footF=(-8, FEET)),
})
for _k in ("downA", "contactB", "downB", "passingB", "rise", "fall", "land", "hurt2"):
    POSES[_k]["twotone"] = True


def poseguide(name, order):
    im = Image.new("RGB", (GW, GH), "white"); d = ImageDraw.Draw(im)
    sw = GW // len(order)
    for c, pose in enumerate(order):
        cx = c * sw + sw // 2
        d.line([(cx - sw // 2 + 4, GROUND), (cx + sw // 2 - 4, GROUND)], fill=GUIDE)
        _stick(d, {k: (v if k == "twotone" else (cx + v[0], v[1])) for k, v in POSES[pose].items()})
    save(im, name)


def palette_swatch():
    """Rexi's palette subset as big squares, one ramp per row ('use only these colours')."""
    from palette import REXI
    rows = [["outline", "night", "robe", "robeSheen"], ["grey1", "grey2", "grey3", "marble", "white"],
            ["skin1", "skin2", "skin3", "skin4", "skin5"], ["leather1", "leather2", "leather3", "leather4", "hairLight"],
            ["brass", "gold", "light"], ["red1", "red2", "red3", "coral"]]
    im = Image.new("RGB", (5 * 40, len(rows) * 40), "white"); d = ImageDraw.Draw(im)
    for r, ramp in enumerate(rows):
        for c, n in enumerate(ramp):
            d.rectangle([c * 40 + 2, r * 40 + 2, c * 40 + 37, r * 40 + 37], fill=REXI[n])
    im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUT, "palette_swatch.png"))


if __name__ == "__main__":
    palette_swatch()
    sp = anchor_sheet()
    print("anchor", sp.size)
    poseguide("poseguide_keys", ["contact", "passing", "jump", "hurt"])
    poseguide("poseguide_run_b", ["downA", "contactB", "downB", "passingB"])
    poseguide("poseguide_air", ["rise", "fall", "land", "hurt2"])
    master = os.path.join(ROOT, "reference", "manu-pipeline", "master_side.png")
    if os.path.exists(master):
        editsheet(np.asarray(Image.open(master).convert("RGBA")), "edit_master_x4", 4)
    print(sorted(os.listdir(OUT)))
