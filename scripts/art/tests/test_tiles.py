"""Scene tiles: registration, least-difference seams and patch insets (tiles.py)."""
import numpy as np

import tiles


def picture(h=60, w=100, seed=1):
    rng = np.random.default_rng(seed)
    img = np.zeros((h, w, 4), np.uint8)
    img[..., :3] = rng.integers(0, 6, (h, w, 1)) * 40
    img[..., 3] = 255
    return img


def test_register_finds_a_dropped_first_row_and_column():
    scene = picture(80, 140)
    step = (60, 40)
    grids = [[scene[r * 40 + 1:r * 40 + 40, c * 60 + 1:c * 60 + 80] for c in range(2)] for r in range(2)]
    assert tiles.register(grids, scene, step) == [[(1, 1), (1, 1)], [(1, 1), (1, 1)]]


def test_a_flat_tile_keeps_the_offset_the_others_agree_on():
    scene = picture(80, 140)
    scene[:40, 60:] = (90, 30, 140, 255)          # tile (0, 1) is flat: every offset fits
    grids = [[scene[r * 40 + 1:r * 40 + 40, c * 60 + 1:c * 60 + 80] for c in range(2)] for r in range(2)]
    assert tiles.register(grids, scene, (60, 40))[0][1] == (1, 1)


def test_compose_reassembles_consistent_tiles_exactly():
    scene = picture(80, 140)
    grids = [[scene[r * 40:r * 40 + 40, c * 60:c * 60 + 80] for c in range(2)] for r in range(2)]
    out = tiles.compose(grids, (60, 40), (140, 80))
    assert (out == scene).all()


def test_the_seam_follows_the_cheapest_path():
    cost = np.full((5, 6), 9)
    cost[:, 4] = 0
    assert tiles.seam(cost).tolist() == [4, 4, 4, 4, 4]


def test_compose_cuts_where_the_tiles_agree():
    scene = picture(40, 140)
    left, right = scene[:, :80].copy(), scene[:, 60:].copy()
    right[:, :10] = (255, 0, 0, 255)               # the right tile disagrees in its first 10 columns
    out = tiles.compose([[left, right]], (60, 40), (140, 40))
    assert not (out[..., :3] == (255, 0, 0)).all(-1).any()
    assert (out == scene).all()


def test_uncovered_border_cells_copy_their_neighbour_without_wrapping():
    scene = picture(40, 100)
    out = tiles.compose([[scene[1:, 1:]]], (60, 40), (100, 40), offsets=[[(1, 1)]])
    assert (out[0, 1:] == scene[1, 1:]).all()      # top row copied down from row 1, not row 39
    assert (out[1:, 0] == scene[1:, 1]).all()      # left column from column 1, not column 99


def test_inset_keeps_the_patch_inside_its_seams():
    scene = picture(60, 100)
    patch = scene[10:50, 20:80].copy()
    patch[15:25, 20:40] = (0, 255, 0, 255)        # the fix, well inside the margins
    out = tiles.inset(scene, patch, (20, 10), margin=8)
    assert (out[25:35, 40:60, :3] == (0, 255, 0)).all()
    unchanged = np.ones(scene.shape[:2], bool)
    unchanged[25:35, 40:60] = False
    assert (out[unchanged] == scene[unchanged]).all()
