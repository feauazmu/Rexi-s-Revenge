"""The Enemy pass (#27): slot sheets with drafts and explicit slots, the ink pass, drawn projectiles."""
import numpy as np
from PIL import Image

import enemies
import templates as T
from palette import MASTER, hex2rgb

OUTLINE = hex2rgb(MASTER["outline"])


def solid(w, h, name):
    sp = np.zeros((h, w, 4), np.uint8)
    sp[..., :3] = hex2rgb(MASTER[name])
    sp[..., 3] = 255
    return sp


def test_slotsheet_places_boxes_drafts_and_anchor_where_asked():
    anchor = Image.fromarray(solid(6, 20, "robe"))
    draft = Image.fromarray(solid(10, 6, "red3"))
    im = np.asarray(T.slotsheet(anchor, 2, (14, 10), None, draft, [(60, 40), (150, 90)], (20, 100)))
    assert im.shape[:2] == (T.GH, T.GW)
    # The anchor stands with its bottom row on row 99, centred on column 20.
    assert tuple(im[99, 20, :3]) == hex2rgb(MASTER["robe"])
    assert tuple(im[100, 20, :3]) == (255, 255, 255)
    for cx, cy in [(60, 40), (150, 90)]:
        assert tuple(im[cy, cx, :3]) == hex2rgb(MASTER["red3"])     # the draft, centred
        assert tuple(im[cy - 5, cx, :3]) == T.BOX                    # the box's top edge


def test_ink_outlines_light_edges_and_inks_dark_ones():
    sp = solid(5, 5, "marble")
    sp[0, :, :3] = hex2rgb(MASTER["night"])                # a dark top edge
    out = enemies.ink(sp)
    assert out.shape[:2] == (6, 7)                          # grown on the light sides, not the top
    assert tuple(out[0, 2, :3]) == OUTLINE                  # the dark edge became outline in place
    assert tuple(out[3, 0, :3]) == OUTLINE                  # a new outline left of the light edge
    assert tuple(out[3, 3, :3]) == hex2rgb(MASTER["marble"])
    cut = enemies.ink(solid(4, 4, "marble"), grow=False)
    assert cut.shape[:2] == (4, 4) and tuple(cut[0, 0, :3]) == OUTLINE


def test_drawn_projectiles_are_rectangular_pixel_text():
    for name, rows in enemies.DRAWN.items():
        assert len({len(r) for r in rows}) == 1, name
        assert enemies.projectile(name)[..., 3].any(), name
