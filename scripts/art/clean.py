"""Raw renders -> palette-snapped sprites, driven by the manifest (sheets.json "sheets").

    art.py clean [--root DIR] [SHEET ...]

For each sheet entry:
  1. raw/<sheet>.png -> art grid (pitch detected or given, background keyed), cached as
     grid/<sheet>.png + grid/pitches.json, so a fresh clone rebuilds without the renders;
  2. snap to the entry's palette (its asset class's ramps, or explicit ramps/colours) in CIELAB;
  3. by kind:
     sprite  despeckle, slice in reading order (recursive XY-cut), name from `names` (null skips
             a size anchor or a reject), trim;
     char    the same, then each sprite goes on a fixed `canvas` with the soles on row `feet` and
             the torso centre (or its template slot centre, `slots`) on column `cx`; optional
             `headlock` pastes the master's head to stop face boil;
     icon    the same, then centred on a fixed `canvas` (a HUD icon cell);
     scene   no slicing: `crop` [x0, y0, x1, y1] in grid cells, `fit` [w, h] (exact mode
             resample), then `layers` split it (see README "Scenes and layers");
  4. per-sprite `post`: `recolor` {hex: hex}, `shorten` rows, `fill_holes`, `holes` {keep, fill};
     sheet-wide `fill_holes` restores white the pale-guide removal cut out (holes.py).
Writes the sprites to the entry's `out` folder (default sprites/), <out>/positions.json (where
each sprite sat on its sheet: key poses are placed by it) and build/clean.json.
"""
import json
import os

import numpy as np
from PIL import Image

import holes
from palette import allowed_colors, hex2rgb
from project import write_json
from pixelize import blobs, despeckle, drop_islands, fit, head_lock, shorten, snap, to_grid


def grid_for(project, name, cfg):
    gpath, rpath = project.grid(name), project.raw(name)
    ppath = project.path("grid", "pitches.json")
    pitches = json.load(open(ppath)) if os.path.exists(ppath) else {}
    if os.path.exists(gpath) and (not os.path.exists(rpath) or os.path.getmtime(gpath) >= os.path.getmtime(rpath)):
        return np.asarray(Image.open(gpath).convert("RGBA")).copy(), pitches.get(name)
    if not os.path.exists(rpath):
        raise FileNotFoundError(f"{name}: neither grid/{name}.png nor raw/{name}.png exists")
    g, s = to_grid(rpath, cfg.get("pitch"), cfg.get("keep_white", False), cfg.get("background", "white"))
    os.makedirs(os.path.dirname(gpath), exist_ok=True)
    Image.fromarray(g).save(gpath)
    pitches[name] = round(s, 3)
    write_json(ppath, pitches, sort_keys=True)
    return g, pitches[name]


def normalise_char(sp, canvas, feet, cx_target, cx=None):
    """Soles on row `feet`; the torso centre (columns of the 35-60% height band), or the given
    cx, on column `cx_target`."""
    W, H = canvas
    h, w = sp.shape[:2]
    if cx is None:
        band = sp[int(h * 0.35):int(h * 0.6), :, 3] > 0
        cx = np.nonzero(band.any(0))[0].mean() if band.any() else w / 2
    out = np.zeros((H, W, 4), np.uint8)
    x0, y0 = int(round(cx_target - cx)), feet + 1 - h
    ys, xs = np.nonzero(sp[..., 3])
    keep = (ys + y0 >= 0) & (ys + y0 < H) & (xs + x0 >= 0) & (xs + x0 < W)
    out[ys[keep] + y0, xs[keep] + x0] = sp[ys[keep], xs[keep]]
    return out


def pad(sp, canvas):
    """Centre a sprite on a fixed canvas (icons). Larger sprites are an error, not a crop."""
    W, H = canvas
    h, w = sp.shape[:2]
    if w > W or h > H:
        raise ValueError(f"sprite {w}x{h} does not fit the {W}x{H} canvas")
    out = np.zeros((H, W, 4), np.uint8)
    out[(H - h) // 2:(H - h) // 2 + h, (W - w) // 2:(W - w) // 2 + w] = sp
    return out


def recolor(sp, mapping):
    for src, dst in mapping.items():
        hit = (sp[..., 3] > 0) & (sp[..., :3] == np.array(hex2rgb(src))).all(-1)
        sp[hit, :3] = hex2rgb(dst)
    return sp


def clean_sprites(project, name, cfg, g):
    kind = cfg["kind"]
    items = blobs(g, min_px=cfg.get("min_px", 12), row_gap=cfg.get("row_gap", 1),
                  col_gap=cfg.get("col_gap", 2), row_tol=cfg.get("row_tol", 10))
    names = cfg["names"]
    warnings = []
    if len(items) != len(names):
        warnings.append(f"{len(items)} sprites found, {len(names)} names; sizes: "
                        f"{[(it[2].shape[1], it[2].shape[0]) for it in items]}")
    written = []
    for k, ((y0, x0, sp), out_name) in enumerate(zip(items, names)):
        if not out_name:
            continue
        post = cfg.get("post", {}).get(out_name, {})
        sp = recolor(sp, {**cfg.get("recolor", {}), **post.get("recolor", {})})
        if post.get("shorten"):
            sp = shorten(sp, post["shorten"])
        if kind == "char":
            canvas = cfg.get("canvas", [64, 96])
            cx = (k + 0.5) * g.shape[1] / cfg["slots"] - x0 if cfg.get("slots") else None
            sp = normalise_char(sp, canvas, cfg.get("feet", canvas[1] - 2), cfg.get("cx", canvas[0] // 2), cx)
            if cfg.get("headlock"):
                master = np.asarray(Image.open(project.path(cfg["headlock"]["master"])).convert("RGBA"))
                sp, _ = head_lock(sp, master, cfg["headlock"].get("cut", 20))
                sp = drop_islands(sp, 20)
        elif kind == "icon":
            sp = pad(sp, cfg["canvas"])
        hcfg = post.get("holes", {})
        if cfg.get("fill_holes") or post.get("fill_holes") or hcfg:
            sp, _ = holes.fill(sp, auto=post.get("fill_holes", cfg.get("fill_holes", False)),
                               keep=hcfg.get("keep", []), fill=hcfg.get("fill", []), seal=cfg.get("seal", []))
        written.append((out_name, sp, {"sheet": name, "x": int(x0), "y": int(y0),
                                       "w": int(sp.shape[1]), "h": int(sp.shape[0])}))
    return written, warnings


def assemble_tiles(project, cfg, allowed):
    """`tiles` [[raw name, ...], ...] (rows of columns) placed every `tile_step` [x, y] cells:
    a scene drawn as several edits of a draft's tiles (templates.scene_tiles). Each tile keeps
    the middle of its overlap with the previous one, so seams fall mid-overlap."""
    tiles = cfg["tiles"]
    sx, sy = cfg.get("tile_step", [200, 113])
    grids = [[snap(grid_for(project, t, cfg)[0], allowed) for t in row] for row in tiles]
    th = min(g.shape[0] for row in grids for g in row)
    tw = min(g.shape[1] for row in grids for g in row)
    H, W = (len(tiles) - 1) * sy + th, (len(tiles[0]) - 1) * sx + tw
    out = np.zeros((H, W, 4), np.uint8)
    ox, oy = (tw - sx) // 2, (th - sy) // 2
    for r, row in enumerate(grids):
        for c, g in enumerate(row):
            x0, y0 = (ox if c else 0), (oy if r else 0)
            out[r * sy + y0:r * sy + th, c * sx + x0:c * sx + tw] = g[y0:th, x0:tw]
    return out


def _scene_grid(project, name, cfg, allowed):
    if cfg.get("tiles"):
        g = assemble_tiles(project, cfg, allowed)
    else:
        g, _ = grid_for(project, name, cfg)
        g = snap(g, allowed)
    if cfg.get("crop"):
        x0, y0, x1, y1 = cfg["crop"]
        g = g[y0:y1, x0:x1].copy()
    if cfg.get("fit"):
        g = fit(g, cfg["fit"])
    return g


def clean_scene(project, name, cfg, allowed):
    """A wide scene: one opaque picture, optionally split into layers. Layer specs combine:
    `sheet` (take the pixels from another scene entry, e.g. an edit that removed the
    foreground), `rows` [y0, y1) and `mask` (a PNG whose opaque pixels are kept), `ramps` /
    `colors` (keep only those palette colours)."""
    base = _scene_grid(project, name, cfg, allowed)
    out_name = cfg.get("name", name)
    written = [(out_name, base, {"sheet": name, "x": 0, "y": 0, "w": int(base.shape[1]), "h": int(base.shape[0])})]
    for layer, spec in cfg.get("layers", {}).items():
        if spec.get("sheet"):
            other = project.sheets[spec["sheet"]]
            src = _scene_grid(project, spec["sheet"], other, allowed_colors(project.palette_spec(other)))
        else:
            src = base
        if src.shape[:2] != base.shape[:2]:
            raise ValueError(f"{name}.{layer}: layer source is {src.shape[1]}x{src.shape[0]}, scene is "
                             f"{base.shape[1]}x{base.shape[0]} (give both the same crop/fit)")
        lay = src.copy()
        keep = lay[..., 3] > 0
        if "rows" in spec:
            r = np.zeros(keep.shape, bool); r[spec["rows"][0]:spec["rows"][1]] = True
            keep &= r
        if "mask" in spec:
            m = np.asarray(Image.open(project.path(spec["mask"])).convert("RGBA"))[..., 3] > 0
            keep &= m
        if "ramps" in spec or "colors" in spec:
            cols = np.array([hex2rgb(h) for h in allowed_colors({k: spec[k] for k in ("ramps", "colors") if k in spec})])
            keep &= (lay[..., None, :3] == cols[None, None]).all(-1).any(-1)
        lay[~keep] = 0
        written.append((f"{out_name}_{layer}", lay, {"sheet": name, "x": 0, "y": 0, "w": int(lay.shape[1]),
                                                     "h": int(lay.shape[0]), "layer": layer}))
    return written, []


def run(project, only=(), log=print):
    report_path = project.path("build", "clean.json")
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    problems = 0
    for name, cfg in project.sheets.items():
        if only and name not in only:
            continue
        sources = [t for row in cfg["tiles"] for t in row] if cfg.get("tiles") else [name]
        missing = [s for s in sources if not (os.path.exists(project.raw(s)) or os.path.exists(project.grid(s)))]
        if missing:
            log(f"-- {name}: no render yet for {', '.join(missing)} (art.py gen NAME)")
            continue
        allowed = allowed_colors(project.palette_spec(cfg))
        if cfg["kind"] == "scene":
            written, warnings = clean_scene(project, name, cfg, allowed)
            pitch = json.load(open(project.path("grid", "pitches.json"))).get(name) \
                if os.path.exists(project.path("grid", "pitches.json")) else None
        else:
            g, pitch = grid_for(project, name, cfg)
            g = despeckle(snap(g, allowed))
            written, warnings = clean_sprites(project, name, cfg, g)
        out_dir = project.out_dir(cfg)
        ppath = os.path.join(out_dir, "positions.json")
        positions = json.load(open(ppath)) if os.path.exists(ppath) else {}
        for out_name, sp, pos in written:
            path = os.path.join(out_dir, out_name + ".png")
            os.makedirs(os.path.dirname(path), exist_ok=True)
            Image.fromarray(sp).save(path)
            positions[out_name] = pos
        if written:
            os.makedirs(out_dir, exist_ok=True)
            write_json(ppath, positions, sort_keys=True)
        for w in warnings:
            log(f"!! {name}: {w}")
        problems += len(warnings)
        report[name] = {"pitch": pitch, "kind": cfg["kind"],
                        "sprites": [{"file": os.path.relpath(os.path.join(out_dir, n + ".png"), project.root),
                                     "w": p["w"], "h": p["h"]} for n, _, p in written]}
        log(f"{name} (pitch {pitch}): " + " ".join(f"{n}:{p['w']}x{p['h']}" for n, _, p in written))
    write_json(report_path, report, sort_keys=True)
    return problems
