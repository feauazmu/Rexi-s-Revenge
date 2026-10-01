"""Raw AI renders -> palette-snapped sprites (manus-garden's clean.py, trimmed to what Rexi needs).

    uv run -q --with pillow --with numpy python scripts/art/clean.py [NAME ...]

For each sheet in SHEETS:
  1. reference/manu-pipeline/raw/<sheet>.png -> pixel grid (pitch detected), cached as
     reference/manu-pipeline/grid/<sheet>.png (1 cell = 1 px, not yet snapped) + pitches.json;
  2. snap to the REXI palette subset in CIELAB (scripts/art/palette.py);
  3. drop specks, slice into sprites in reading order (recursive XY-cut), name them;
  4. normalise each sprite onto the 48x72 canvas: feet on row FEET, torso centre on column CX;
  5. fill enclosed holes that drop_pale opened inside the art (white tank top).
Writes reference/manu-pipeline/clean/<name>.png and prints sizes.
"""
import json
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import ROOT  # noqa: E402
import holes  # noqa: E402
from pixelize import to_grid, snap, despeckle, blobs  # noqa: E402

PIPE = os.path.join(ROOT, "reference", "manu-pipeline")
RAW, GRID, OUT = (os.path.join(PIPE, d) for d in ("raw", "grid", "clean"))
CANVAS = (48, 72)          # Rexi's frame: 48 wide, 72 tall
FEET = 69                  # the row his soles stand on (3 rows spare below for the hurt knock-back)
CX = 22                    # torso centre column (facing right, a little left of centre: room for the nose)

SHEETS = {
    "master_side_v4": {"names": [None, "master_a", "master_b", "master_c"]},
    "keys_v1": {"names": ["key_contact", "key_passing", "key_jump", "key_hurt"], "slots": 4},
    "arm_v1": {"names": ["arm_forward_a", "arm_forward_b"]},
    "keys_run_b": {"names": ["key_downA", "key_contactB", "key_downB", "key_passingB"]},
    "master_34_v5": {"names": ["m34_a", "m34_b", "m34_c"]},
    "keys_air": {"names": ["key_rise", "key_fall", "key_land", "key_hurt2"]},
}


def grid_for(name, pitch=None):
    gpath, rpath = os.path.join(GRID, name + ".png"), os.path.join(RAW, name + ".png")
    ppath = os.path.join(GRID, "pitches.json")
    pitches = json.load(open(ppath)) if os.path.exists(ppath) else {}
    if os.path.exists(gpath) and (not os.path.exists(rpath) or os.path.getmtime(gpath) > os.path.getmtime(rpath)):
        return np.asarray(Image.open(gpath).convert("RGBA")).copy(), pitches.get(name)
    g, s = to_grid(rpath, pitch, keep_white=True)
    os.makedirs(GRID, exist_ok=True)
    Image.fromarray(g).save(gpath)
    pitches[name] = round(s, 3)
    json.dump(pitches, open(ppath, "w"), indent=1, sort_keys=True)
    return g, s


def normalise(sp, cx=None, feet=FEET):
    """Feet on row `feet`; torso centre (columns of the 35-60% height band) on column CX."""
    W, H = CANVAS
    h, w = sp.shape[:2]
    if cx is None:
        band = sp[int(h * 0.35):int(h * 0.6), :, 3] > 0
        cx = np.nonzero(band.any(0))[0].mean() if band.any() else w / 2
    out = np.zeros((H, W, 4), np.uint8)
    x0, y0 = int(round(CX - cx)), feet + 1 - h
    for y in range(h):
        for x in range(w):
            if sp[y, x, 3] and 0 <= y0 + y < H and 0 <= x0 + x < W:
                out[y0 + y, x0 + x] = sp[y, x]
    return out


def main(only):
    os.makedirs(OUT, exist_ok=True)
    ppath = os.path.join(OUT, "positions.json")
    positions = json.load(open(ppath)) if os.path.exists(ppath) else {}
    for name, cfg in SHEETS.items():
        if (only and name not in only) or not (os.path.exists(os.path.join(RAW, name + ".png"))
                                                or os.path.exists(os.path.join(GRID, name + ".png"))):
            continue
        g, s = grid_for(name, cfg.get("pitch", 2752 / 240))
        g = despeckle(snap(g, char=True))
        items = blobs(g, min_px=12)
        if len(items) != len(cfg["names"]):
            print(f"!! {name}: {len(items)} sprites, {len(cfg['names'])} names:",
                  [(it[2].shape[1], it[2].shape[0]) for it in items])
        for (y0, x0, sp), out in zip(items, cfg["names"]):
            if not out:
                continue
            sp, n = holes.fill(sp, auto=True)
            Image.fromarray(sp).save(os.path.join(OUT, out + ".png"))
            positions[out] = {"sheet": name, "x": int(x0), "y": int(y0), "w": int(sp.shape[1]), "h": int(sp.shape[0])}
            json.dump(positions, open(ppath, "w"), indent=1, sort_keys=True)
            print(f"{name} pitch {s:.3f} -> {out}: {sp.shape[1]}x{sp.shape[0]} at ({x0},{y0}), {n} hole px filled")


if __name__ == "__main__":
    main(sys.argv[1:])
