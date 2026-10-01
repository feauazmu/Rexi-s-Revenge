"""Build the manifest's "templates" section: declarative reference images (templates.py).

    art.py templates [--root DIR] [NAME ...]

Each entry names a builder and its inputs; paths are relative to the art root:
  {"type": "editsheet", "sprite": "sprites/rexi/master.png", "n": 4}
  {"type": "lineup", "anchor": "...", "draft": "templates/x_draft_1x.png", "n": 3, "height": 64}
  {"type": "slotsheet", "anchor": "...", "n": 3, "box": [44, 32], "ground": null}
  {"type": "icongrid", "n": 11, "cell": 12, "anchor": "sprites/icons/mazo.png"}
  {"type": "poseguide", "poses": [{"head": [3, 42], "neck": [2, 47], ...}, ...]}
  {"type": "draft", "image": "../reference/arena.png", "size": [640, 360], "palette": "scene"}
  {"type": "scene_tiles", "draft": "templates/arena_draft_1x.png", "step": [200, 113]}
A `draft` is saved at its own size (<name>_1x.png only, not upscaled): it feeds `lineup` or
`scene_tiles`, which write <name>_r<row>c<col>.png, one template per tile.
"""
import os

import numpy as np
from PIL import Image

import templates as T
from palette import allowed_colors


def _load(project, path):
    return Image.open(path if os.path.isabs(path) else project.path(path)).convert("RGBA")


def build(project, name, spec):
    kind = spec["type"]
    if kind == "editsheet":
        return [T.save(project, T.editsheet(_load(project, spec["sprite"]), spec["n"], spec.get("ground", T.GROUND)), name)]
    if kind == "lineup":
        im = T.lineup(_load(project, spec["anchor"]), _load(project, spec["draft"]), spec.get("n", 3),
                      spec.get("height", 64), spec.get("ground", T.GROUND))
        return [T.save(project, im, name)]
    if kind == "slotsheet":
        im = T.slotsheet(_load(project, spec["anchor"]), spec["n"], spec["box"], spec.get("ground", T.GROUND))
        return [T.save(project, im, name)]
    if kind == "icongrid":
        anchor = _load(project, spec["anchor"]) if spec.get("anchor") else None
        return [T.save(project, T.icongrid(spec["n"], spec["cell"], anchor, spec.get("cols")), name)]
    if kind == "poseguide":
        poses = [{k: (v if k == "twotone" else tuple(v)) for k, v in p.items()} for p in spec["poses"]]
        return [T.save(project, T.poseguide(poses, spec.get("ground", T.GROUND)), name)]
    if kind == "draft":
        src = _load(project, spec["image"])
        if spec.get("crop"):
            src = src.crop(tuple(spec["crop"]))
        g = T.draft(src, tuple(spec["size"]), allowed_colors(spec.get("palette", "scene")))
        out = project.path("templates", name + "_1x.png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        Image.fromarray(g).save(out)
        return [out]
    if kind == "scene_tiles":
        scene = np.asarray(_load(project, spec["draft"]))
        return [T.save(project, im, f"{name}_r{r}c{c}") for r, c, _, im in
                T.scene_tiles(scene, tuple(spec.get("step", (200, 113))))]
    raise ValueError(f"templates.{name}: unknown type {kind!r}")


def run(project, only=(), log=print):
    for name, spec in project.section("templates").items():
        if only and name not in only:
            continue
        for path in build(project, name, spec):
            log(f"templates.{name} -> {os.path.relpath(path, project.root)}")
    return 0
