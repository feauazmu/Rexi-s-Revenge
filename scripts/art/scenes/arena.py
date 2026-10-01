"""The Arena's hand pass and layer split (#28): the assembled scene -> four layers.

    uv run -q --with pillow --with numpy python scripts/art/scenes/arena.py

Reads art/sprites/arena/scene.png (the nine tile edits and the centre fix, assembled by
`art.py clean arena`) and writes art/sprites/arena/layers/{sky,far,buildings,plaza}.png, the
four layers the renderer draws back to front, with the drifting clouds between sky and far.

The hand pass, all of it here so every change to the pipeline's pixels is reviewable:

1. **Sky.** The tile edits each drew their own band heights, so the sky is rebuilt row by row:
   every open-sky pixel takes its row's most common sky colour, and each band climbs into the
   one above through a sparse row and a checkerboard row (ADR 0002: dither, never gradients).
   Open sky is what a flood from the top row reaches through sky-ramp colours. The sun and the
   lit horizon (gold and lighter) are not open sky and stay as the centre fix drew them.
2. **Fixes.** A few rectangles where tiles disagreed: a stray finial floating above the
   courthouse pediment goes back to sky, a dark smudge left on the plaza by a discarded lamp is
   replaced by the slabs beside it, and the right tile's curb is recoloured to match the others.
3. **Layers.** A partition of the scene: open sky (made opaque, the sun included) is `sky`;
   whatever else lies inside the skyline's box is `far`; the rest above the plaza is
   `buildings`; the plaza from the wall down is `plaza`.
"""
import os
import sys
from collections import Counter, deque

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from palette import MASTER, RAMPS, ROOT, hex2rgb  # noqa: E402

ART = os.path.join(ROOT, "art", "sprites", "arena")
SCENE = os.path.join(ART, "scene.png")
OUT = os.path.join(ART, "layers")

#: Sky-ramp colours that open sky may have (gold and lighter are the sun and the horizon glow).
SKY = [n for n in RAMPS["sky"] if n not in ("night", "gold", "sunYellow", "light")]
#: skyIndigo is also the skyline's shadow colour, so it counts as sky only above this row.
INDIGO_SKY_ROWS = 140
#: Window of the running median over the per-row band (rows).
SMOOTH_ROWS = 15
#: Rows of the plaza: the back wall's top and everything below (the ground line is 317).
PLAZA_TOP = 276
#: The skyline's box [x0, y0, x1, y1): non-sky pixels inside it (and above the plaza) are `far`.
SKYLINE_BOXES = [(228, 140, 372, PLAZA_TOP), (372, 140, 496, 222), (620, 160, 640, PLAZA_TOP)]

#: [x0, y0, x1, y1) rectangles that become open sky: a finial floating over the pediment, and
#: strips of seam noise: between the skyline and the tower (around the mast at x 471), right of
#: the courthouse wing and right of the tower.
CLEAR_TO_SKY = [
    (110, 100, 128, 118),
    (428, 150, 471, 168),
    (472, 150, 496, 168),
    (210, 150, 236, 162),
    (618, 150, 640, 176),
]
#: Copies, in order: each `box` [x0, y0, x1, y1) takes the pixels `dx` columns away, mirrored
#: left to right if `mirror`.
COPY = [
    # The smudge a discarded lamp left on the plaza slabs: the slabs to its right.
    {"box": (176, 289, 233, 303), "dx": 90, "mirror": False},
    # Boissons' roof: the left tile drew a brick parapet and the right one a grey cap, so the
    # parapet continues to the right and ends in a mirror of its left end.
    {"box": (426, 211, 466, 225), "dx": -40, "mirror": False},
    {"box": (466, 211, 472, 225), "dx": -100, "mirror": True},
]
#: Recolours: inside each `box` [x0, y0, x1, y1), palette colour `from` -> `to` (by name).
RECOLOR = [
    # Boissons' awning: the right tile's stripes are peach, the left tile's cream.
    {"box": (400, 242, 472, 253), "map": {"skin4": "skin5", "stone2": "stoneLight"}},
    # The mirrored parapet end brought the sunset from the left; behind it is the skyline.
    {"box": (466, 211, 473, 225),
     "map": {"skyPeach": "skyIndigo", "skyOrange": "skyIndigo", "gold": "skyIndigo"}},
    # The bottom right tile drew the curb in sunlit orange and the pavement edge lighter: match
    # the other tiles' stone row by row (the curb's top edge and face, the black line under it
    # that the other tiles draw as the curb's outline, and the pavement's edge).
    {"box": (401, 316, 640, 317), "map": {"stoneLight": "stone2"}},
    {"box": (401, 318, 640, 319), "map": {"skin5": "stoneLight"}},
    {"box": (401, 319, 640, 323), "map": {"skin3": "stone2", "skin4": "stoneLight"}},
    {"box": (401, 323, 640, 324), "map": {"robe": "outline"}},
    {"box": (401, 329, 640, 330), "map": {"stone2": "stone1"}},
]


def rgb(name):
    return np.array(hex2rgb(MASTER[name]), np.uint8)


def open_sky(img):
    """Pixels a flood from the top row reaches through open-sky colours."""
    h, w = img.shape[:2]
    cols = np.array([hex2rgb(MASTER[n]) for n in SKY])
    skyish = (img[..., None, :3] == cols[None, None]).all(-1).any(-1)
    indigo = (img[..., :3] == rgb("skyIndigo")).all(-1)
    skyish &= ~indigo | (np.arange(h)[:, None] < INDIGO_SKY_ROWS)
    seen = np.zeros((h, w), bool)
    q = deque((0, x) for x in range(w) if skyish[0, x])
    for _, x in q:
        seen[0, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and skyish[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    return seen


def rebuild_sky(img, sky):
    """Row-majority bands over the open sky, with dithered seams. Returns the band colour per
    row (for rows without open sky, the nearest row above that has one)."""
    h = img.shape[0]
    ramp = [hex2rgb(MASTER[n]) for n in SKY]
    index = []
    for y in range(h):
        counts = Counter(c for c in map(tuple, img[y][sky[y]][:, :3]) if c in ramp)
        if counts:
            index.append(ramp.index(counts.most_common(1)[0][0]))
        else:
            index.append(index[-1] if index else 0)
    # The tiles disagree on band heights, so their majority flickers between neighbouring
    # bands: take a running median, then never step back up the ramp (the sky only warms
    # toward the horizon).
    half = SMOOTH_ROWS // 2
    padded = [index[0]] * half + index + [index[-1]] * half
    smooth = [int(np.median(padded[y:y + SMOOTH_ROWS])) for y in range(h)]
    smooth = list(np.maximum.accumulate(smooth))
    bands = np.array([ramp[i] for i in smooth], np.uint8)
    out = img.copy()
    ys, xs = np.nonzero(sky)
    out[ys, xs, :3] = bands[ys]
    # Dithered seams: the lower band climbs two rows into the upper one.
    for y in range(2, h):
        if (bands[y] == bands[y - 1]).all():
            continue
        lower = bands[y]
        for x in range(img.shape[1]):
            if sky[y - 1, x] and (x + y) % 2 == 0:
                out[y - 1, x, :3] = lower
            if sky[y - 2, x] and (x + 2 * (y % 2)) % 4 == 0:
                out[y - 2, x, :3] = lower
    return out, bands


def hand_pass(img):
    img = img.copy()
    for copy in COPY:
        x0, y0, x1, y1 = copy["box"]
        src = img[y0:y1, x0 + copy["dx"]:x1 + copy["dx"]]
        img[y0:y1, x0:x1] = src[:, ::-1] if copy["mirror"] else src
    for recolor in RECOLOR:
        x0, y0, x1, y1 = recolor["box"]
        region = img[y0:y1, x0:x1]
        for src, dst in recolor["map"].items():
            region[(region[..., :3] == rgb(src)).all(-1), :3] = rgb(dst)
    sky = open_sky(img)
    for x0, y0, x1, y1 in CLEAR_TO_SKY:
        sky[y0:y1, x0:x1] = True
    img, bands = rebuild_sky(img, sky)
    return img, sky, bands


def layers(img, sky, bands):
    h, w = img.shape[:2]
    sky_layer = img.copy()
    # Opaque sky: behind the buildings, each row's band colour.
    behind = ~sky
    behind[PLAZA_TOP:] = False
    ys, xs = np.nonzero(behind)
    in_far = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in SKYLINE_BOXES:
        in_far[y0:y1, x0:x1] = True
    # The sun and the lit horizon stay in the sky layer (they are behind the skyline).
    glow = np.zeros((h, w), bool)
    for name in ("gold", "sunYellow", "light"):
        glow |= (img[..., :3] == rgb(name)).all(-1)
    glow &= in_far
    keep_sky = sky | glow
    sky_layer[~keep_sky] = 0
    sky_layer[ys, xs, :3] = np.where(glow[ys, xs, None], img[ys, xs, :3], bands[ys])
    sky_layer[ys, xs, 3] = 255
    sky_layer[PLAZA_TOP:] = 0
    not_sky = ~keep_sky
    far = not_sky & in_far
    far[PLAZA_TOP:] = False
    plaza = np.zeros((h, w), bool)
    plaza[PLAZA_TOP:] = True
    buildings = not_sky & ~far & ~plaza

    def masked(mask):
        out = img.copy()
        out[~mask] = 0
        return out
    return {"sky": sky_layer, "far": masked(far), "buildings": masked(buildings), "plaza": masked(plaza)}


def build(scene=SCENE, out=OUT):
    """Hand pass and split: writes <out>/<layer>.png and returns {layer: RGBA array}."""
    img, sky, bands = hand_pass(np.asarray(Image.open(scene).convert("RGBA")))
    split = layers(img, sky, bands)
    os.makedirs(out, exist_ok=True)
    for name, layer in split.items():
        Image.fromarray(layer).save(os.path.join(out, f"{name}.png"))
    return split


def main():
    build()
    print("arena layers ->", os.path.relpath(OUT, ROOT))


if __name__ == "__main__":
    main()
