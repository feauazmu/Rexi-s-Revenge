"""Grid reconstruction, palette snap, fit, RotSprite, IK limbs, audit and JSON output."""
import json
import os

import numpy as np
from PIL import Image

import audit
import ik
from palette import CLASSES, MASTER, RAMPS, allowed_names, hex2rgb
from pixelize import fit, snap, to_grid
from project import write_json
from rotsprite import rotate

rng = np.random.default_rng(7)


def sprite(w=24, h=20, names=("outline", "skin3", "robe", "gold")):
    """A small opaque-on-clear test sprite with an outline ring and palette fills."""
    sp = np.zeros((h, w, 4), np.uint8)
    for y in range(2, h - 2):
        for x in range(3, w - 3):
            n = names[1 + ((x // 4 + y // 5) % (len(names) - 1))]
            sp[y, x, :3] = hex2rgb(MASTER[n]); sp[y, x, 3] = 255
    m = sp[..., 3] > 0
    ring = np.zeros_like(m)
    ring[1:] |= m[:-1]; ring[:-1] |= m[1:]; ring[:, 1:] |= m[:, :-1]; ring[:, :-1] |= m[:, 1:]
    sp[ring & ~m] = (*hex2rgb(MASTER[names[0]]), 255)
    return sp


def test_palette_reads_56_colours_and_every_ramp_name_exists():
    assert len(MASTER) == 56
    for ramp in RAMPS.values():
        assert all(n in MASTER for n in ramp)
    assert "skyIndigo" not in allowed_names("character")
    assert "steel2" in allowed_names("character") and "coral" in allowed_names("character")
    assert set(CLASSES) == {"character", "enemy", "prop", "icon", "scene"}


def test_recovers_the_exact_grid_from_a_noisy_fractional_upscale(tmp_path):
    sp = sprite()
    canvas = np.full((40, 60, 3), 255, np.uint8)
    a = sp[..., 3] > 0
    canvas[10:30, 18:42][a] = sp[..., :3][a]
    pitch = 11.4667                                                   # 2752 / 240, like Gemini at 2K
    W, H = round(60 * pitch), round(40 * pitch)
    big = np.asarray(Image.fromarray(canvas).resize((W, H), Image.NEAREST)).astype(int)
    big = np.clip(big + rng.integers(-6, 7, big.shape), 0, 255).astype(np.uint8)   # render noise
    path = tmp_path / "raw.png"
    Image.fromarray(big).save(path)
    g, s = to_grid(str(path), pitch)
    g = snap(g)
    ys, xs = np.nonzero(g[..., 3])
    got = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    ys, xs = np.nonzero(sp[..., 3])
    sp = sp[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    assert got.shape == sp.shape
    assert (got[..., 3] == sp[..., 3]).all()
    on = sp[..., 3] > 0
    assert (got[on][:, :3] == sp[on][:, :3]).all()


def test_snap_respects_the_allowed_colours():
    g = np.zeros((1, 2, 4), np.uint8)
    g[0, 0] = (*hex2rgb(MASTER["skyRose"]), 255)
    g[0, 1] = (*hex2rgb(MASTER["skin3"]), 255)
    out = snap(g, [MASTER[n] for n in allowed_names("character")])
    assert tuple(out[0, 0, :3]) != hex2rgb(MASTER["skyRose"])
    assert tuple(out[0, 1, :3]) == hex2rgb(MASTER["skin3"])


def test_fit_resamples_without_new_colours():
    sp = sprite(40, 30)
    out = fit(sp, (20, 15))
    assert out.shape == (15, 20, 4)
    src = {tuple(c) for c in sp[sp[..., 3] > 0][:, :3]}
    assert {tuple(c) for c in out[out[..., 3] > 0][:, :3]} <= src
    assert set(np.unique(out[..., 3]).tolist()) <= {0, 255}


def test_rotsprite_is_lossless_at_90_and_adds_no_colours_between():
    sp = sprite()
    r, _ = rotate(sp, 90, (5, 5))
    assert (np.rot90(sp) == r).all()
    r, (px, py) = rotate(sp, 22.5, (5.0, 10.0))
    src = {tuple(c) for c in sp[sp[..., 3] > 0][:, :3]}
    assert {tuple(c) for c in r[r[..., 3] > 0][:, :3]} <= src
    assert set(np.unique(r[..., 3]).tolist()) <= {0, 255}
    assert r[int(round(py)), int(round(px)), 3] == 255                # the pivot pixel survived


def test_two_bone_ik_keeps_bone_lengths_and_reaches_reachable_targets():
    joint, end = ik.solve2((0, 0), (10, 8), 9, 9, bend=1)
    assert np.hypot(*joint) == __import__("pytest").approx(9, abs=1e-6)
    assert np.hypot(end[0] - joint[0], end[1] - joint[1]) == __import__("pytest").approx(9, abs=1e-6)
    assert np.allclose(end, (10, 8))
    other, _ = ik.solve2((0, 0), (10, 8), 9, 9, bend=-1)
    assert not np.allclose(joint, other)
    _, far = ik.solve2((0, 0), (100, 0), 9, 9)
    assert np.allclose(far, (18, 0), atol=1e-3)


def test_ik_limb_is_outlined_on_palette_and_hard_edged():
    sp, origin = ik.limb([(10, 4), (12, 13), (18, 20)], [3.5, 3, 2.5], ["skin2", "skin3", "skin4"])
    assert set(np.unique(sp[..., 3]).tolist()) == {0, 255}
    colours = {tuple(c) for c in sp[sp[..., 3] > 0][:, :3]}
    assert colours <= {hex2rgb(MASTER[n]) for n in ("outline", "skin2", "skin3", "skin4")}
    assert len(colours) == 4                                          # all three bands and the outline
    m = sp[..., 3] > 0
    p = np.pad(m, 1)
    edge = m & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    assert all(tuple(c) == hex2rgb(MASTER["outline"]) for c in sp[edge][:, :3])


def test_audit_flags_partial_alpha_off_palette_and_class(tmp_path):
    ok = sprite()
    Image.fromarray(ok).save(tmp_path / "ok.png")
    assert audit.lint(str(tmp_path / "ok.png"), "character")[0] == []
    bad = ok.copy()
    bad[5, 5] = (1, 2, 3, 255)
    bad[6, 6, 3] = 128
    Image.fromarray(bad).save(tmp_path / "bad.png")
    errors, _, _ = audit.lint(str(tmp_path / "bad.png"), "character")
    assert any("partial alpha" in e for e in errors) and any("off-palette #010203" in e for e in errors)
    sky = sprite(names=("outline", "skyRose", "skin3", "gold"))
    Image.fromarray(sky).save(tmp_path / "sky.png")
    assert any("skyRose is outside" in e for e in audit.lint(str(tmp_path / "sky.png"), "character")[0])
    assert audit.lint(str(tmp_path / "sky.png"), "scene")[0] == []


def test_write_json_matches_prettier_layout(tmp_path):
    p = tmp_path / "x.json"
    write_json(str(p), {"canvas": [120, 100], "anims": {"idle": {"fps": 6, "loop": True}}, "e": {}, "l": []})
    assert p.read_text() == ('{\n  "canvas": [120, 100],\n  "anims": {\n    "idle": {\n      "fps": 6,\n'
                             '      "loop": true\n    }\n  },\n  "e": {},\n  "l": []\n}\n')
    assert json.loads(p.read_text())["canvas"] == [120, 100]
    assert os.path.getsize(p) > 0
