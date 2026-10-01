"""End to end on real data: the prototype root rebuilds byte-identical sprites from its grids, and
the TypeScript export round-trips."""
import json
import os
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
