"""Palette audit and pixel-rule lint for an art root (ADR 0002).

    art.py audit [--root DIR] [--strict]

Checks every sprite the manifest's sheets write, every baked part, and the extra globs in the
manifest's "audit" section ({"frames/**/*.png": "character"}: glob -> palette class).
Errors (exit 1):
  - partial alpha (only fully opaque or fully clear pixels; dither instead);
  - a colour that is not in the master palette (src/render/palette.ts);
  - a colour outside the sprite's asset class (a character using the Arena's sky ramp).
Warnings (errors with --strict):
  - lone pixels with no opaque neighbour (crumbs from the slicer);
  - weak outline: under 70% of a sprite's silhouette edge is dark ink (ADR 0002: 1 px outline on
    characters, enemies, props and icons; scenes are exempt).
Prints the palette colours used, so unused ramps and over-use show up.
"""
import glob
import os
from collections import Counter

import numpy as np
from PIL import Image

from palette import NAME_OF, allowed_names, rgb2hex

INK_LUMA = 64          # a silhouette-edge pixel darker than this counts as outline ink
MIN_OUTLINE = 0.70


def lint(path, palette_spec, outlined=True):
    """(errors, warnings, Counter of colour names) for one PNG."""
    a = np.asarray(Image.open(path).convert("RGBA"))
    errors, warnings, used = [], [], Counter()
    alpha = a[..., 3]
    partial = (alpha > 0) & (alpha < 255)
    if partial.any():
        y, x = np.argwhere(partial)[0]
        errors.append(f"partial alpha ({int(partial.sum())} px, first at {x},{y})")
    allowed = set(allowed_names(palette_spec))
    opaque = alpha == 255
    cols, counts = np.unique(a[opaque][:, :3], axis=0, return_counts=True) if opaque.any() else ([], [])
    for c, n in zip(cols, counts):
        h = rgb2hex(c)
        name = NAME_OF.get(h)
        if name is None:
            errors.append(f"off-palette {h} ({int(n)} px)")
        else:
            used[name] += int(n)
            if name not in allowed:
                errors.append(f"{name} is outside its palette class ({int(n)} px)")
    p = np.pad(opaque, 1)
    nb8 = sum(p[1 + dy:1 + dy + opaque.shape[0], 1 + dx:1 + dx + opaque.shape[1]]
              for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx)
    lone = opaque & (nb8 == 0)
    if lone.any():
        warnings.append(f"{int(lone.sum())} lone pixel(s)")
    if outlined and opaque.any():
        nb4 = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        edge = opaque & ~nb4
        luma = a[..., :3].astype(float) @ np.array([0.299, 0.587, 0.114])
        share = float((luma[edge] < INK_LUMA).mean()) if edge.any() else 1.0
        if share < MIN_OUTLINE:
            warnings.append(f"weak outline: {share:.0%} of the edge is ink")
    return errors, warnings, used


def targets(project):
    out = [(path, spec, kind != "scene") for _, kind, spec, path in project.outputs()]
    for name, cfg in project.parts.items():
        d = project.path(cfg.get("out", os.path.join("parts", name)))
        out += [(f, cfg.get("palette", "character"), True) for f in sorted(glob.glob(os.path.join(d, "*.png")))]
    for pattern, spec in project.manifest.get("audit", {}).items():
        if pattern.startswith("_"):
            continue
        out += [(f, spec, True) for f in sorted(glob.glob(project.path(pattern), recursive=True))]
    seen, unique = set(), []
    for t in out:                      # first entry per file wins (sheet outputs before globs)
        if t[0] not in seen and os.path.exists(t[0]):
            seen.add(t[0]); unique.append(t)
    return unique


def run(project, strict=False, log=print):
    n_err = n_warn = 0
    used = Counter()
    files = targets(project)
    for path, spec, outlined in files:
        errors, warnings, u = lint(path, spec, outlined)
        used += u
        rel = os.path.relpath(path, project.root)
        for e in errors:
            log(f"ERROR {rel}: {e}")
        for w in warnings:
            log(f"{'ERROR' if strict else 'warn '} {rel}: {w}")
        n_err += len(errors) + (len(warnings) if strict else 0)
        n_warn += 0 if strict else len(warnings)
    log(f"{len(files)} files, {len(used)} palette colours used: {', '.join(sorted(used))}")
    log(f"errors: {n_err}, warnings: {n_warn}")
    return n_err
