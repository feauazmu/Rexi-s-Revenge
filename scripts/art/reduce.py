"""Exact 2:1 reduction of a palette sprite (the model drew Rexi on a 480-cell grid, twice our density).

Each 2x2 block becomes one pixel. Outline ink wins a block when it covers 2 of its 4 cells, so
1 px contour lines survive; otherwise the block takes its most common colour, ties going to the
colour that differs most from the block's neighbours (keeps eyes, mouths, tattoo lines). The
phase (which of the 4 offsets the blocks start on) is chosen to keep the most outline.

    from reduce import reduce2
"""
import numpy as np

INK_MAX = 60     # an opaque colour darker than this in every channel counts as outline ink


def _lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def reduce2(sp, phase=None):
    best = None
    phases = [phase] if phase else [(py, px) for py in (0, 1) for px in (0, 1)]
    for py, px in phases:
        out = _reduce(sp, py, px)
        ink = ((out[..., 3] > 0) & (out[..., :3].max(-1) < INK_MAX)).sum()
        if best is None or ink > best[0]:
            best = (ink, out, (py, px))
    return best[1], best[2]


def _reduce(sp, py, px):
    h, w = sp.shape[:2]
    p = np.zeros((h + 4, w + 4, 4), np.uint8)
    p[py + 1:py + 1 + h, px + 1:px + 1 + w] = sp
    H, W = (p.shape[0]) // 2, (p.shape[1]) // 2
    out = np.zeros((H, W, 4), np.uint8)
    for j in range(H):
        for i in range(W):
            blk = p[2 * j:2 * j + 2, 2 * i:2 * i + 2].reshape(-1, 4)
            op = blk[blk[:, 3] > 0]
            if len(op) < 2:
                continue
            ink = op[op[:, :3].max(-1) < INK_MAX]
            if len(ink) >= 2:
                cols, n = np.unique(ink[:, :3], axis=0, return_counts=True)
                out[j, i, :3] = cols[n.argmax()]; out[j, i, 3] = 255
                continue
            cols, n = np.unique(op[:, :3], axis=0, return_counts=True)
            top = cols[n == n.max()]
            if len(top) > 1:     # tie: the colour farthest from the 3x3 neighbourhood's mean
                nb = p[max(0, 2 * j - 2):2 * j + 4, max(0, 2 * i - 2):2 * i + 4].reshape(-1, 4)
                nb = nb[nb[:, 3] > 0][:, :3].astype(float).mean(0)
                top = top[np.argmax([abs(_lum(c) - _lum(nb)) for c in top.astype(float)])][None]
            out[j, i, :3] = top[0]; out[j, i, 3] = 255
    ys, xs = np.nonzero(out[..., 3])
    return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
