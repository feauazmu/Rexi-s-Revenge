"""AI render -> true pixel grid on the master palette (library used by clean.py).

Ported from manus-garden's Art/tools/pixelize.py (itself from its art-spike-3), unchanged in
method: pitch detection on the edge-energy comb, phase search, median resampling of each cell
centre, pale/white guide removal, CIELAB nearest-colour snap and recursive XY-cut slicing.
The palette comes from src/render/palette.ts (scripts/art/palette.py); a manifest entry limits
the snap to its asset class's ramps (`allowed`).

Additions for this project: a chroma-key background (`background: "green"`, the #00FF00
keying that works for Gemini, which has no real alpha), opaque scenes (`background: "none"`),
and `fit`, an exact mode resample of a snapped grid to a target size (backgrounds drawn on a
coarser or finer grid than the game's 640x360).
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import MASTER, hex2rgb  # noqa: E402

FLAT = list(dict.fromkeys(MASTER.values()))


def to_lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.9505, 1.0, 1.089])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


PAL = np.array([hex2rgb(h) for h in FLAT], float)
PAL_LAB = to_lab(PAL)


def bg_mask(img, thresh=60):
    """Flood-fill the near-white background from the borders."""
    probe = img.convert("RGB").copy()
    w, h = probe.size
    seeds = [(x, 0) for x in range(0, w, 16)] + [(x, h - 1) for x in range(0, w, 16)] + \
            [(0, y) for y in range(0, h, 16)] + [(w - 1, y) for y in range(0, h, 16)]
    for s in seeds:
        if probe.getpixel(s) != (255, 0, 255) and min(probe.getpixel(s)) > 200:
            ImageDraw.floodfill(probe, s, (255, 0, 255), thresh=thresh)
    a = np.asarray(probe)
    return (a[..., 0] == 255) & (a[..., 1] == 0) & (a[..., 2] == 255)


def green_mask(img, hue_tol=22, min_sat=0.3, min_val=0.3):
    """Chroma key: pixels near pure green (#00FF00) in HSV, the keying that works for Gemini
    (no real alpha). Ask for a 2-3 px white outline buffer around each sprite in the prompt;
    drop_pale then removes that buffer like any other pale halo."""
    hsv = np.asarray(img.convert("HSV")).astype(float)
    hue = hsv[..., 0] * 360 / 255
    return (np.abs(hue - 120) <= hue_tol) & (hsv[..., 1] / 255 >= min_sat) & (hsv[..., 2] / 255 >= min_val)


def background_mask(img, background="white"):
    if background == "white":
        return bg_mask(img)
    if background == "green":
        return green_mask(img)
    if background == "none":
        return np.zeros((img.height, img.width), bool)
    raise ValueError(f"unknown background {background!r} (white, green or none)")


def _edge_profile(arr, axis):
    return np.abs(np.diff(arr, axis=axis)).sum(axis=2).sum(axis=0 if axis == 1 else 1).astype(float)


def _comb(e, s):
    """(score, phase): how much edge energy sits on a grid of pitch s, relative to chance."""
    idx = np.arange(len(e)) + 0.5
    best = (0.0, 0.0)
    tol = 0.6
    frac = min(1.0, 2 * tol / s)
    tot = e.sum() + 1e-9
    for o in np.arange(0, s, 0.1):
        r = (idx - o) % s
        on = e[(r < tol) | (r > s - tol)].sum() / tot
        sc = on / frac
        if sc > best[0]:
            best = (sc, o)
    return best


def detect_pitch(arr, lo=4.0, hi=24.0, cells=240):
    """Art-pixel size in output pixels. Gemini draws on a ~240-cell-wide grid, so width/240 is
    tried first and kept when it scores near the best candidate; otherwise the smallest pitch
    that scores close to the best one wins (multiples of the true pitch score as well)."""
    e = _edge_profile(arr, 1)
    cands = np.arange(lo, hi, 0.02)
    scores = np.array([_comb(e, s)[0] for s in cands])
    prior = arr.shape[1] / cells
    if _comb(e, prior)[0] >= 0.8 * scores.max():
        return prior
    good = cands[scores >= 0.88 * scores.max()]
    s = float(good.min())
    fine = np.arange(s - 0.05, s + 0.05, 0.005)
    return float(fine[np.argmax([_comb(e, f)[0] for f in fine])])


def best_phase(arr, s):
    offs = []
    for axis in (1, 0):
        offs.append(_comb(_edge_profile(arr, axis), s)[1])
    return offs


def resample(img, mask, s, ox, oy, keep_white=False, pale_guides=True):
    a = np.asarray(img.convert("RGB")).astype(float)
    h, w = mask.shape
    nx, ny = int((w - ox) // s), int((h - oy) // s)
    out = np.zeros((ny, nx, 4), np.uint8)
    pale = np.zeros((ny, nx), bool)
    white = np.zeros((ny, nx), bool)
    r = max(1, s * 0.25)
    for j in range(ny):
        cy = oy + (j + 0.5) * s; y0, y1 = int(cy - r), int(cy + r) + 1
        for i in range(nx):
            cx = ox + (i + 0.5) * s; x0, x1 = int(cx - r), int(cx + r) + 1
            if mask[y0:y1, x0:x1].mean() > 0.5:
                continue
            px = np.median(a[y0:y1, x0:x1].reshape(-1, 3), axis=0)
            pale[j, i] = px.min() > 238 or (px.max() - px.min() < 12 and px.min() > 150)   # white, light-grey guides
            white[j, i] = px.min() > 250
            out[j, i, :3] = px; out[j, i, 3] = 255
    return drop_pale(out, pale, white, keep_white) if pale_guides else out


def drop_pale(out, pale, white, keep_white=False, min_keep=24):
    """White / light-grey cells are either real art (white hair, plates, daisies: enclosed by a
    dark outline) or not (background showing through gaps between leaves, leftover guide lines,
    halos). Drop a pale component when it is small or mostly borders transparent cells, and a
    pure-white one (background seen through a gap) unless keep_white (white hair)."""
    lab, sizes = label(pale, conn8=False)
    opaque = out[..., 3] > 0
    for i, n in enumerate(sizes):
        if not i:
            continue
        m = lab == i
        ring = (np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1)) & ~m
        open_edge = (ring & ~opaque).sum() / max(1, ring.sum())
        if n < min_keep or open_edge > 0.5 or (not keep_white and white[m].mean() > 0.5):
            out[m, 3] = 0
    return out


def snap(g, allowed=None, chunk=65536):
    """Nearest master-palette colour in CIELAB. `allowed` = list of hex colours (the entry's
    asset class, palette.allowed_colors); None = the whole palette. Chunked, so a 640x360
    scene does not build a pixels x colours x 3 array at once."""
    rgb = g[..., :3].reshape(-1, 3).astype(float)
    banned = [i for i, h in enumerate(FLAT) if allowed and h not in allowed]
    idx = np.empty(len(rgb), int)
    for s in range(0, len(rgb), chunk):
        d = ((to_lab(rgb[s:s + chunk])[:, None, :] - PAL_LAB[None]) ** 2).sum(-1)
        d[:, banned] = 1e9
        idx[s:s + chunk] = d.argmin(1)
    out = g.copy()
    out[..., :3] = PAL[idx].reshape(g.shape[:2] + (3,)).astype(np.uint8)
    return out


def fit(g, size):
    """Resample a snapped RGBA grid to `size` (w, h) without new colours: each output pixel takes
    the most common colour of the source cells it covers (transparent if most are)."""
    W, H = size
    h, w = g.shape[:2]
    out = np.zeros((H, W, 4), np.uint8)
    key = (g[..., 0].astype(np.int64) << 16) | (g[..., 1].astype(np.int64) << 8) | g[..., 2]
    key = np.where(g[..., 3] > 0, key + (1 << 24), 0)
    for j in range(H):
        y0 = int(j * h / H); y1 = max(y0 + 1, int(round((j + 1) * h / H)))
        for i in range(W):
            x0 = int(i * w / W); x1 = max(x0 + 1, int(round((i + 1) * w / W)))
            b = key[y0:y1, x0:x1].ravel()
            if (b == 0).sum() * 2 > b.size:
                continue
            vals, cnt = np.unique(b[b > 0], return_counts=True)
            k = int(vals[cnt.argmax()]) - (1 << 24)
            out[j, i] = ((k >> 16) & 255, (k >> 8) & 255, k & 255, 255)
    return out


def despeckle(g):
    a = g[..., 3] > 0
    n = sum(np.roll(np.roll(a, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
    g[a & (n == 0), 3] = 0
    return g


def label(alpha, conn8=True):
    """Connected components -> (labels, sizes)."""
    h, w = alpha.shape
    lab = np.zeros((h, w), int); sizes = [0]; cur = 0
    nb = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (conn8 or not (dy and dx))]
    for y in range(h):
        for x in range(w):
            if alpha[y, x] and not lab[y, x]:
                cur += 1; stack = [(y, x)]; lab[y, x] = cur; n = 0
                while stack:
                    cy, cx = stack.pop(); n += 1
                    for dy, dx in nb:
                        ny_, nx_ = cy + dy, cx + dx
                        if 0 <= ny_ < h and 0 <= nx_ < w and alpha[ny_, nx_] and not lab[ny_, nx_]:
                            lab[ny_, nx_] = cur; stack.append((ny_, nx_))
                sizes.append(n)
    return lab, sizes


def drop_islands(f, min_px):
    a = f[..., 3] > 0
    lab, sizes = label(a, conn8=False)
    for i, n in enumerate(sizes):
        if i and n < min_px:
            f[lab == i, 3] = 0
    return f


def _runs(mask1d, min_gap):
    """[start, end) runs of True separated by at least min_gap False cells."""
    idx = np.nonzero(mask1d)[0]
    if not len(idx):
        return []
    runs, st, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > min_gap:
            runs.append((st, prev + 1)); st = i
        prev = i
    runs.append((st, prev + 1))
    return runs


def blobs(g, min_px=12, row_gap=1, col_gap=2, row_tol=10):
    """Sprites in reading order. Recursive XY-cut: split at empty scanlines, then at empty
    columns, and again inside each piece, until nothing splits; crumbs are dropped. Leaves are
    ordered in rows by their bottom edge (sprites stand on ground lines), then left to right.
    Returns [(y0, x0, sprite)]."""
    a = g[..., 3] > 0
    leaves = []

    def cut(y0, y1, x0, x1, horizontal):
        sub = a[y0:y1, x0:x1]
        runs = _runs(sub.any(1), row_gap) if horizontal else _runs(sub.any(0), col_gap)
        other = _runs(sub.any(0), col_gap) if horizontal else _runs(sub.any(1), row_gap)
        if len(runs) <= 1 and len(other) <= 1:
            leaves.append((y0, y1, x0, x1)); return
        if len(runs) <= 1:
            cut(y0, y1, x0, x1, not horizontal); return
        for r0, r1 in runs:
            if horizontal:
                cut(y0 + r0, y0 + r1, x0, x1, False)
            else:
                cut(y0, y1, x0 + r0, x0 + r1, True)

    cut(0, a.shape[0], 0, a.shape[1], True)
    items = []
    for y0, y1, x0, x1 in leaves:
        sp = g[y0:y1, x0:x1].copy()
        m = sp[..., 3] > 0
        if m.sum() < min_px:
            continue
        lab, sizes = label(m)
        big = max(sizes)
        keep = np.isin(lab, [i for i, n in enumerate(sizes) if i and n >= max(min_px, big * 0.03)])
        sp[~keep, 3] = 0
        ys, xs = np.nonzero(sp[..., 3])
        items.append((int(y0 + ys.min()), int(x0 + xs.min()), int(y0 + ys.max()), sp[ys.min():ys.max() + 1, xs.min():xs.max() + 1]))
    items.sort(key=lambda t: t[2])
    rows = []
    for it in items:
        if rows and it[2] - rows[-1][0][2] <= row_tol:
            rows[-1].append(it)
        else:
            rows.append([it])
    return [(t[0], t[1], t[3]) for r in rows for t in sorted(r, key=lambda t: t[1])]


def to_grid(path, pitch=None, keep_white=False, background="white"):
    """Raw render -> (unsnapped RGBA grid, pitch). Pitch is detected unless given. An opaque
    scene (background "none") keeps every cell, pale ones included."""
    img = Image.open(path)
    arr = np.asarray(img.convert("RGB")).astype(int)
    s = pitch or detect_pitch(arr)
    ox, oy = best_phase(arr, s)
    return resample(img, background_mask(img, background), s, ox, oy, keep_white,
                    pale_guides=background != "none"), s


def head_lock(frame, master, cut, search=4):
    """Paste the master's head (top `cut` rows) onto the frame at the best-matching offset.
    Removes face/hair 'boil' between AI frames while keeping each frame's own bob and lean."""
    dw = frame.shape[1] - master.shape[1]           # centre master on a canvas of the frame's width
    if dw > 0:
        master = np.pad(master, ((0, 0), (dw // 2, dw - dw // 2), (0, 0)))
    elif dw < 0:
        master = master[:, -dw // 2: -dw // 2 + frame.shape[1]]
    ma = master[..., 3] > 0
    ys = np.nonzero(ma.any(1))[0]; top = ys.min()
    region = master[top:top + cut]
    rm = region[..., 3] > 0
    xs = np.nonzero(rm.any(0))[0]; bx0, bx1 = xs.min(), xs.max()
    fa = frame[..., 3] > 0
    ftop = np.nonzero(fa.any(1))[0].min()
    best = None
    for dy in range(-search, search + 1):
        for dx in range(-search, search + 1):
            y0 = ftop + dy
            if y0 < 0: continue
            sub = frame[y0:y0 + cut, :]
            if sub.shape[0] < cut: continue
            sub = np.roll(sub, -dx, axis=1)
            diff = (rm & ((sub[..., 3] == 0) | (np.abs(sub[..., :3].astype(int) - region[..., :3].astype(int)).sum(-1) > 30))).sum()
            diff += ((~rm) & (sub[..., 3] > 0))[: cut - 6].sum()
            if best is None or diff < best[0]:
                best = (diff, dx, y0)
    _, dx, y0 = best
    out = frame.copy()
    x0c, x1c = max(0, bx0 + dx - 1), min(frame.shape[1], bx1 + dx + 2)
    out[:y0 + cut - 8, :] = 0                                # clear old head + anything above it (guide-line specks)
    out[y0 + cut - 8:y0 + cut - 4, x0c:x1c] = 0
    shifted = np.roll(region, dx, axis=1)
    m = shifted[..., 3] > 0
    out[y0:y0 + cut][m] = shifted[m]
    return out, (int(dx), int(y0 - ftop))


def shorten(f, remove, lo=0.30, hi=0.88):
    """Make a sprite `remove` px shorter by deleting its most redundant rows (the row most like
    the one below it) between lo and hi of its height. Used when the model draws a character
    taller than the cast (pixel size stays exact, unlike resampling)."""
    f = f.copy()
    for _ in range(remove):
        a = f[..., 3] > 0
        ys = np.nonzero(a.any(1))[0]; top, bot = ys.min(), ys.max()
        h = bot - top + 1
        best = None
        for y in range(top + int(h * lo), top + int(h * hi)):
            d = (np.abs(f[y].astype(int) - f[y + 1].astype(int)).sum(-1) > 0).sum()
            if best is None or d < best[0]:
                best = (d, y)
        y = best[1]
        f[1:y + 1] = f[0:y].copy()
        f[0] = 0
    return f
