"""Contact sheets: every sprite, part and animation of an art root, scaled up nearest-neighbour.

    art.py preview [--root DIR] [--scale 4]

Writes <root>/build/preview/<group>.png and an index.html that shows them all (open it in a
browser; it is self-contained apart from the PNGs next to it). Groups:
  sheet:<name>   the sprites a manifest sheet produced, labelled, on a checker (feet line for chars)
  parts:<name>   a RotSprite set, every angle with its pivot marked
  anim:<name>    each animation in <root>/frames/anim.json as a strip, with fps
Previews are for review only: their background, labels and markers are not game art.
"""
import glob
import html
import json
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFont

CHECK = ((44, 44, 56, 255), (52, 52, 66, 255))
LABEL = (228, 228, 236)
MARK = (255, 64, 160, 255)
FONT = None


def _font():
    global FONT
    if FONT is None:
        try:
            FONT = ImageFont.load_default(size=14)
        except TypeError:
            FONT = ImageFont.load_default()
    return FONT


def cell(sp, scale, feet=None, pivot=None):
    h, w = sp.shape[:2]
    bg = Image.new("RGBA", (w, h))
    px = bg.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = CHECK[((x // 4) + (y // 4)) % 2]
    bg.alpha_composite(Image.fromarray(sp))
    big = bg.resize((w * scale, h * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    if feet is not None:
        d.line([(0, (feet + 1) * scale), (w * scale, (feet + 1) * scale)], fill=(110, 112, 140, 255))
    if pivot is not None:
        cx, cy = (pivot[0] + 0.5) * scale, (pivot[1] + 0.5) * scale
        d.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], outline=MARK)
    return big


def strip(items, scale, title):
    """items: [(label, RGBA, feet, pivot)] -> one labelled row image."""
    cells = [(lab, cell(sp, scale, feet, pivot)) for lab, sp, feet, pivot in items]
    gap, head, lab_h = 8, 24, 18
    W = sum(c.width for _, c in cells) + gap * (len(cells) + 1)
    H = head + max(c.height for _, c in cells) + lab_h + gap
    im = Image.new("RGBA", (max(W, 320), H), (30, 30, 38, 255))
    d = ImageDraw.Draw(im)
    d.text((gap, 4), title, fill=LABEL, font=_font())
    x = gap
    for lab, c in cells:
        im.alpha_composite(c, (x, head))
        d.text((x, head + c.height + 2), lab, fill=LABEL, font=_font())
        x += c.width + gap
    return im


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def groups(project):
    out = []
    for name, cfg in project.sheets.items():
        files = [(n, os.path.join(project.out_dir(cfg), n + ".png")) for n in
                 ([cfg.get("name", name)] + [f"{cfg.get('name', name)}_{l}" for l in cfg.get("layers", {})]
                  if cfg["kind"] == "scene" else [n for n in cfg["names"] if n])]
        items = [(os.path.basename(n), load(p), cfg.get("feet") if cfg["kind"] == "char" else None, None)
                 for n, p in files if os.path.exists(p)]
        if items:
            scale = 1 if cfg["kind"] == "scene" else None
            out.append((f"sheet:{name}", items, scale))
    for name, cfg in project.parts.items():
        d = project.path(cfg.get("out", os.path.join("parts", name)))
        meta = os.path.join(d, "pivots.json")
        if os.path.exists(meta):
            piv = json.load(open(meta))["pivots"]
            out.append((f"parts:{name}", [(k, load(os.path.join(d, k + ".png")), None, v) for k, v in piv.items()], None))
    anim = project.path("frames", "anim.json")
    if os.path.exists(anim):
        meta = json.load(open(anim))
        for a, info in meta["anims"].items():
            frames = sorted(glob.glob(project.path("frames", a, "*.png")))
            out.append((f"anim:{a} ({info['fps']} fps{', loop' if info.get('loop') else ''})",
                        [(os.path.basename(f)[:-4], load(f), meta.get("baseline"), None) for f in frames], None))
    return out


def run(project, scale=4, log=print):
    out_dir = project.path("build", "preview")
    os.makedirs(out_dir, exist_ok=True)
    entries = []
    for title, items, own_scale in groups(project):
        fname = title.split(" ")[0].replace(":", "_").replace("/", "_") + ".png"
        strip(items, own_scale or scale, title).convert("RGB").save(os.path.join(out_dir, fname), optimize=True)
        entries.append((title, fname))
    page = ["<!doctype html><meta charset='utf-8'><title>Art preview</title>",
            "<style>body{background:#1c1c24;color:#e4e4ec;font:14px system-ui;margin:16px}"
            "img{image-rendering:pixelated;max-width:100%;display:block;margin:4px 0 20px}</style>",
            f"<h1>{html.escape(project.rel)}</h1>"]
    for title, fname in entries:
        page.append(f"<h2>{html.escape(title)}</h2><img src='{fname}' alt='{html.escape(title)}'>")
    open(os.path.join(out_dir, "index.html"), "w").write("\n".join(page))
    log(f"{len(entries)} contact sheets -> {os.path.relpath(out_dir, project.root)}/index.html")
    return entries
