"""Re-assembling a scene drawn as overlapping tile edits (ADR 0002, rule 5): registration and
minimum-error seams.

    from tiles import register, compose

Each tile is an edit of a crop of the scene's draft (templates.scene_tiles). Two things go wrong
when the edits are pasted back on a fixed grid:

- **Phase.** Grid recovery keeps whole cells only, so a 240x135 render usually comes back as
  239x133 cells with the first column and row dropped. `register` finds where each tile grid
  sits against its draft crop (the offset with the least mean colour distance, searched over
  +-`search` cells). Tiles that are mostly flat sky match almost anywhere, so a tile keeps the
  offset most tiles agree on unless its own best is clearly better (`margin`).
- **Seams.** Independent edits never agree pixel for pixel. `compose` cuts each overlap along
  the path where the two tiles differ least (dynamic programming, as in image quilting), first
  between the columns of each row, then between the rows, so a cut runs along an existing
  edge or through a flat area instead of across a window grid.
"""
from collections import Counter

import numpy as np


def _distance(a, b):
    return np.abs(a[..., :3].astype(np.int32) - b[..., :3].astype(np.int32)).sum(-1)


def offset_errors(grid, ref, origin, search=3):
    """{(dx, dy): mean colour distance} where grid pixel (y, x) is compared with ref pixel
    (origin_y + y + dy, origin_x + x + dx), over the part that falls inside ref."""
    h, w = grid.shape[:2]
    ox, oy = origin
    errors = {}
    for dy in range(-search, search + 1):
        for dx in range(-search, search + 1):
            y0, x0 = max(0, -(oy + dy)), max(0, -(ox + dx))
            y1, x1 = min(h, ref.shape[0] - oy - dy), min(w, ref.shape[1] - ox - dx)
            if y1 - y0 < h // 2 or x1 - x0 < w // 2:
                continue
            g = grid[y0:y1, x0:x1]
            r = ref[oy + dy + y0:oy + dy + y1, ox + dx + x0:ox + dx + x1]
            errors[(dx, dy)] = float(_distance(g, r).mean())
    return errors


def register(grids, ref, step, search=3, margin=0.85):
    """Offsets [[(dx, dy), ...], ...] for a rows x columns list of tile grids, tile (r, c)
    nominally at (c * step_x, r * step_y) of `ref` (the draft at scene size)."""
    errors = [[offset_errors(g, ref, (c * step[0], r * step[1]), search) for c, g in enumerate(row)]
              for r, row in enumerate(grids)]
    best = [[min(e, key=e.get) for e in row] for row in errors]
    consensus = Counter(o for row in best for o in row).most_common(1)[0][0]
    return [[b if e[b] < margin * e.get(consensus, float("inf")) else consensus
             for b, e in zip(brow, erow)] for brow, erow in zip(best, errors)]


def seam(cost):
    """A top-to-bottom path through `cost` (h, w) with the least total cost, moving at most one
    column per row: the path's column for each row."""
    h, w = cost.shape
    acc = cost.astype(np.float64).copy()
    for y in range(1, h):
        prev = acc[y - 1]
        left = np.concatenate([[np.inf], prev[:-1]])
        right = np.concatenate([prev[1:], [np.inf]])
        acc[y] += np.minimum(prev, np.minimum(left, right))
    path = np.empty(h, int)
    path[-1] = int(np.argmin(acc[-1]))
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path[y] = lo + int(np.argmin(acc[y, lo:hi]))
    return path


def _join(a, b):
    """Merge two canvases (H, W, 4) whose covered pixels have alpha 255: where both cover, cut
    along the least-difference vertical path; a's side is the left."""
    both = (a[..., 3] > 0) & (b[..., 3] > 0)
    out = np.where((a[..., 3] > 0)[..., None], a, b)
    cols = np.flatnonzero(both.any(0))
    rows = np.flatnonzero(both.any(1))
    if not len(cols):
        return out
    x0, x1, y0, y1 = cols[0], cols[-1] + 1, rows[0], rows[-1] + 1
    cost = np.where(both[y0:y1, x0:x1], _distance(a[y0:y1, x0:x1], b[y0:y1, x0:x1]), 10 ** 6)
    path = seam(cost)
    for i, y in enumerate(range(y0, y1)):
        cut = x0 + path[i]
        take = both[y, cut:x1] | (b[y, cut:x1, 3] > 0)
        out[y, cut:x1][take] = b[y, cut:x1][take]
    return out


def inset(scene, patch, at, margin=12):
    """Paste `patch` (an edit of the crop of `scene` at `at` = (x, y)) back into `scene`, cut
    along least-error seams inside a `margin`-wide band on each of its four sides. Returns a new
    picture; the part of the patch outside the scene is ignored."""
    x, y = at
    h = min(patch.shape[0], scene.shape[0] - y)
    w = min(patch.shape[1], scene.shape[1] - x)
    p, s = patch[:h, :w], scene[y:y + h, x:x + w]
    cost = _distance(p, s)
    m = min(margin, w // 4, h // 4)
    left = seam(cost[:, :m])
    right = w - m + seam(cost[:, w - m:])
    top = seam(cost[:m].T)
    bottom = h - m + seam(cost[h - m:].T)
    ys, xs = np.mgrid[0:h, 0:w]
    keep = (xs >= left[:, None]) & (xs <= right[:, None]) & (ys >= top[None, :]) & (ys <= bottom[None, :])
    out = scene.copy()
    out[y:y + h, x:x + w][keep] = p[keep]
    return out


def _fill_uncovered(img):
    """Copy the nearest covered pixel (left/right, then up/down) into uncovered border cells."""
    def shifted(a, axis, step):
        """`a` moved one cell along `axis` (step +1: from the previous cell), no wrap-around."""
        out = np.zeros_like(a)
        src = [slice(None)] * 3
        dst = [slice(None)] * 3
        src[axis], dst[axis] = (slice(None, -1), slice(1, None)) if step > 0 else (slice(1, None), slice(None, -1))
        out[tuple(dst)] = a[tuple(src)]
        return out

    for _ in range(4):
        for axis, step in ((1, 1), (1, -1), (0, 1), (0, -1)):
            empty = img[..., 3] == 0
            if not empty.any():
                return img
            moved = shifted(img, axis, step)
            fill = empty & (moved[..., 3] > 0)
            img[fill] = moved[fill]
    return img


def compose(grids, step, size, offsets=None):
    """Assemble tile grids (rows x columns) into one opaque (h, w, 4) picture of `size` (w, h):
    tile (r, c) at (c * step_x + dx, r * step_y + dy), overlaps cut by `seam`."""
    w, h = size
    offsets = offsets or [[(0, 0)] * len(row) for row in grids]

    def placed(r, c):
        canvas = np.zeros((h, w, 4), np.uint8)
        g = grids[r][c]
        dx, dy = offsets[r][c]
        x, y = c * step[0] + dx, r * step[1] + dy
        gy0, gx0 = max(0, -y), max(0, -x)
        gy1, gx1 = min(g.shape[0], h - y), min(g.shape[1], w - x)
        canvas[y + gy0:y + gy1, x + gx0:x + gx1] = g[gy0:gy1, gx0:gx1]
        canvas[..., 3] = np.where(canvas[..., 3] > 0, 255, 0)
        return canvas

    rows = []
    for r, row in enumerate(grids):
        acc = placed(r, 0)
        for c in range(1, len(row)):
            acc = _join(acc, placed(r, c))
        rows.append(acc)
    out = rows[0]
    for nxt in rows[1:]:
        out = _join(out.transpose(1, 0, 2), nxt.transpose(1, 0, 2)).transpose(1, 0, 2)
    return _fill_uncovered(np.ascontiguousarray(out))
