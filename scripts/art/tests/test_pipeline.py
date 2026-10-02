"""End to end on real data: the prototype root rebuilds byte-identical sprites from its grids, and
the TypeScript export round-trips."""
import json
import os
import importlib.util
import re
import shutil

import numpy as np
import pytest
from PIL import Image

import clean
import export_ts
from palette import ROOT
from project import ManifestError, Project

PIPE = os.path.join(ROOT, "reference", "manu-pipeline")


def test_prototype_clean_reproduces_the_committed_sprites(tmp_path):
    root = tmp_path / "pipe"
    os.makedirs(root)
    shutil.copy(os.path.join(PIPE, "sheets.json"), root)
    shutil.copytree(os.path.join(PIPE, "grid"), root / "grid")
    project = Project(str(root))
    assert clean.run(project, log=lambda *_: None) == 0
    for name in json.load(open(os.path.join(PIPE, "clean", "positions.json"))):
        got = np.asarray(Image.open(root / "clean" / f"{name}.png").convert("RGBA"))
        want = np.asarray(Image.open(os.path.join(PIPE, "clean", f"{name}.png")).convert("RGBA"))
        assert got.shape == want.shape and (got == want).all(), name
    assert json.load(open(root / "clean" / "positions.json")) == \
        json.load(open(os.path.join(PIPE, "clean", "positions.json")))


def test_the_arena_rebuilds_from_its_committed_grids(tmp_path):
    art = os.path.join(ROOT, "art")
    root = tmp_path / "art"
    os.makedirs(root)
    shutil.copy(os.path.join(art, "sheets.json"), root)
    for folder in ("grid", "drafts"):
        shutil.copytree(os.path.join(art, folder), root / folder)
    assert clean.run(Project(str(root)), ["arena", "arena_props"], log=lambda *_: None) == 0
    names = ["scene", "stone/ledge_102", "stone/ledge_144"] + [f"cloud_{c}" for c in "abcde"]
    for name in names:
        got = np.asarray(Image.open(root / "sprites" / "arena" / f"{name}.png").convert("RGBA"))
        want = np.asarray(Image.open(os.path.join(art, "sprites", "arena", f"{name}.png")).convert("RGBA"))
        assert got.shape == want.shape and (got == want).all(), name


def test_the_arena_layers_partition_the_scene_and_match_the_committed_ones(tmp_path):
    path = os.path.join(ROOT, "scripts", "art", "scenes", "arena.py")
    spec = importlib.util.spec_from_file_location("arena_scene", path)
    arena = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(arena)

    split = arena.build(out=str(tmp_path))
    opaque = [layer[..., 3] > 0 for layer in split.values()]
    foreground = opaque[1] | opaque[2] | opaque[3]
    assert not (opaque[1] & opaque[2]).any() and not (opaque[2] & opaque[3]).any()
    assert (opaque[0] | foreground).all()          # nothing shows through the four layers
    for name, layer in split.items():
        want = np.asarray(Image.open(os.path.join(arena.OUT, f"{name}.png")).convert("RGBA"))
        assert (layer == want).all(), name


def test_the_ledges_keep_the_stone_silhouette_and_match_the_committed_ones(tmp_path):
    path = os.path.join(ROOT, "scripts", "art", "scenes", "ledges.py")
    spec = importlib.util.spec_from_file_location("ledges_scene", path)
    ledges = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ledges)

    for name, ledge in ledges.build(out=str(tmp_path)).items():
        stone = ledges.stone_ledge(name)
        assert ((ledge[..., 3] > 0) == (stone[..., 3] > 0)).all(), name
        for row in (ledges.TOP, ledges.BOTTOM):                    # the slab's outline
            assert (ledge[row, :, :3] == stone[row, :, :3]).all(), name
        assert (ledge[:ledges.BOTTOM, [0, -1], :3] == stone[:ledges.BOTTOM, [0, -1], :3]).all(), name
        want = np.asarray(Image.open(os.path.join(ledges.ART, f"{name}.png")).convert("RGBA"))
        assert (ledge == want).all(), name


def test_the_ledge_panels_line_up_with_the_renderers_block_tiling():
    path = os.path.join(ROOT, "scripts", "art", "scenes", "ledges.py")
    spec = importlib.util.spec_from_file_location("ledges_scene", path)
    ledges = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ledges)

    ts = open(os.path.join(ROOT, "src", "render", "layers", "arena.ts")).read()
    block = re.search(r"LEDGE_BLOCK = \{ from: (\d+), to: (\d+) \}", ts)
    right = re.search(r"LEDGE_RIGHT_FROM = (\d+);", ts)
    start, end, right_from = int(block[1]), int(block[2]), int(right[1])
    seams = ledges.seams(102)
    assert start in seams and right_from in seams and end - start == ledges.PANEL


def test_rle_round_trips_and_rows_use_fixed_codes():
    sp = np.asarray(Image.open(os.path.join(PIPE, "frames", "idle", "00.png")).convert("RGBA"))
    names, idx = export_ts.indexed(sp)
    data = export_ts.encode_rle(idx)
    assert (export_ts.decode_rle(data, idx.shape[1], idx.shape[0]) == idx).all()
    rows = export_ts.rows_of(names, idx)
    assert len(rows) == sp.shape[0] and set("".join(rows)) <= set(".knrRu123mw456abcfdeLMNOhyYlpqsvt")


def test_export_refuses_partial_alpha():
    sp = np.zeros((2, 2, 4), np.uint8)
    sp[0, 0] = (0, 0, 0, 100)
    with pytest.raises(export_ts.ExportError, match="partial alpha"):
        export_ts.indexed(sp)


def test_export_writes_a_module_with_relative_imports(tmp_path):
    project = Project(PIPE)
    [path] = export_ts.run(project, ["rexi_c"], out_override=str(tmp_path), log=lambda *_: None)
    src = open(path).read()
    assert "decodeSprite({ width: 120, height: 100" in src
    assert "from '" in src and "/src/render/sprite-data'" in src
    assert "export const anims" in src and "'aim/15'" in src


def test_manifest_validation(tmp_path):
    (tmp_path / "sheets.json").write_text(json.dumps({"sheets": {"x": {"kind": "icon", "names": ["a"]}}}))
    with pytest.raises(ManifestError, match="canvas"):
        Project(str(tmp_path))
