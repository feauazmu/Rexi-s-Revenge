"""Pre-baked rotations (ADR 0002): parts rotated offline with RotSprite, never at runtime.

    art.py bake [--root DIR] [PART ...]

Each manifest "parts" entry:
    "arm": {"src": "sprites/rexi/arm.png", "pivot": [6, 9],
            "angles": {"from": -90, "to": 90, "step": 22.5}, "out": "parts/arm"}
writes <out>/<angle>.png (e.g. -022.5.png) and <out>/pivots.json {angle: [x, y]}: where the pivot
pixel landed in each rotated sprite, so the game places it by the pivot. Turns are taken from
the nearest multiple of 90 degrees (an exact, lossless rot90) so each RotSprite pass is at most
45 degrees. Mirror the set in code for the other facing (the game draws facing right).
"""
import os

import numpy as np
from PIL import Image

from project import angles as angle_list, write_json
from rotsprite import rotate


def rotated(sp, deg, pivot):
    near = 90 * round(deg / 90)
    b, p = rotate(sp, near, pivot) if near else (sp, pivot)
    return rotate(b, deg - near, p) if deg != near else (b, p)


def trim(sp, pivot):
    ys, xs = np.nonzero(sp[..., 3])
    if not len(ys):
        return sp, pivot
    y0, x0 = ys.min(), xs.min()
    return sp[y0:ys.max() + 1, x0:xs.max() + 1].copy(), (pivot[0] - x0, pivot[1] - y0)


def run(project, only=(), log=print):
    for name, cfg in project.parts.items():
        if only and name not in only:
            continue
        src = project.path(cfg["src"])
        if not os.path.exists(src):
            log(f"-- parts.{name}: {cfg['src']} does not exist yet")
            continue
        sp = np.asarray(Image.open(src).convert("RGBA")).copy()
        out = project.path(cfg.get("out", os.path.join("parts", name)))
        os.makedirs(out, exist_ok=True)
        pivots = {}
        for a in angle_list(cfg["angles"]):
            r, p = trim(*rotated(sp, a, tuple(cfg["pivot"])))
            key = f"{a:+06.1f}"
            Image.fromarray(r).save(os.path.join(out, key + ".png"))
            pivots[key] = [round(float(p[0]), 2), round(float(p[1]), 2)]
        write_json(os.path.join(out, "pivots.json"), {"src": cfg["src"], "pivot": cfg["pivot"], "pivots": pivots})
        log(f"parts.{name}: {len(pivots)} angles -> {os.path.relpath(out, project.root)}")
    return 0
