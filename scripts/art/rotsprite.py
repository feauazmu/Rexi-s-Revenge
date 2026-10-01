"""RotSprite: rotate pixel art without shredding its clusters (Xenowhirl's method, as in Aseprite).

  1. scale the sprite 8x with Scale2x (EPX) three times, which grows edges as smooth diagonals
     instead of blocks;
  2. rotate the big image with nearest-neighbour sampling;
  3. scale back down 8x, each output pixel taking the most common colour of its 8x8 block
     (transparent when most of the block is), so no new colours appear.

Exact multiples of 90 degrees use np.rot90 (a bijection: no pixel changes).

    from rotsprite import rotate
    out, (px, py) = rotate(sprite, degrees, pivot=(x, y))   # counter-clockwise, screen y down
"""
import math

import numpy as np


def _key(sp):
    """RGBA -> one int per pixel (0 = transparent), so Scale2x can compare colours."""
    a = sp.astype(np.int64)
    k = (a[..., 0] << 16) | (a[..., 1] << 8) | a[..., 2] | (1 << 24)
    return np.where(sp[..., 3] > 0, k, 0)


def _unkey(k):
    out = np.zeros(k.shape + (4,), np.uint8)
    out[..., 0] = (k >> 16) & 255; out[..., 1] = (k >> 8) & 255; out[..., 2] = k & 255
    out[..., 3] = np.where(k > 0, 255, 0)
    return out


def scale2x(k):
    p = np.pad(k, 1, mode="edge")
    A, B, C, D, E = p[:-2, 1:-1], p[1:-1, :-2], p[1:-1, 2:], p[2:, 1:-1], p[1:-1, 1:-1]   # up, left, right, down, centre
    e0 = np.where((B == A) & (B != D) & (A != C), A, E)
    e1 = np.where((A == C) & (A != B) & (C != D), C, E)
    e2 = np.where((D == B) & (D != C) & (B != A), B, E)
    e3 = np.where((C == D) & (C != A) & (D != B), D, E)
    h, w = k.shape
    out = np.zeros((2 * h, 2 * w), k.dtype)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = e0, e1, e2, e3
    return out


def rotate(sp, deg, pivot):
    """Rotate RGBA `sp` by `deg` counter-clockwise (as seen on screen) about `pivot` (pixel
    centre coords, may be .5). Returns (sprite, new pivot) on a canvas big enough to hold it."""
    h, w = sp.shape[:2]
    px, py = pivot
    q = deg / 90
    if abs(q - round(q)) < 1e-9:
        n = int(round(q)) % 4
        out = np.rot90(sp, n)           # rot90 turns counter-clockwise for a y-down image
        cx, cy = px, py
        for _ in range(n):              # pivot follows: (x, y) -> (y, w - 1 - x)
            cx, cy, w, h = cy, (w - 1) - cx, h, w
        return out.copy(), (cx, cy)
    S = 8
    k = _key(sp)
    for _ in range(3):
        k = scale2x(k)
    # output canvas: radius of the farthest corner from the pivot
    R = max(math.hypot(x - px, y - py) for x in (-0.5, w - 0.5) for y in (-0.5, h - 0.5))
    n = int(math.ceil(R)) + 1
    ow = oh = 2 * n + 1
    opx, opy = n + (px - math.floor(px)), n + (py - math.floor(py))
    th = math.radians(deg)
    c, s = math.cos(th), math.sin(th)
    # sample positions of every big-output pixel centre, mapped back into the big source
    ys, xs = np.mgrid[0:oh * S, 0:ow * S]
    X = (xs + 0.5) / S - opx           # output coords relative to pivot (art px)
    Y = (ys + 0.5) / S - opy
    # screen rotation counter-clockwise with y down: inverse map
    sx = c * X - s * Y + px
    sy = s * X + c * Y + py
    bx = np.floor((sx + 0.5) * S).astype(int)   # into the 8x source (source px centre at i)
    by = np.floor((sy + 0.5) * S).astype(int)
    ok = (bx >= 0) & (by >= 0) & (bx < w * S) & (by < h * S)
    big = np.zeros((oh * S, ow * S), np.int64)
    big[ok] = k[by[ok], bx[ok]]
    # downsample: mode of each 8x8 block
    blocks = big.reshape(oh, S, ow, S).transpose(0, 2, 1, 3).reshape(oh, ow, S * S)
    out = np.zeros((oh, ow), np.int64)
    for j in range(oh):
        for i in range(ow):
            b = blocks[j, i]
            if (b == 0).sum() * 2 >= b.size:
                continue
            vals, cnt = np.unique(b[b > 0], return_counts=True)
            out[j, i] = vals[cnt.argmax()]
    return _unkey(out), (opx - 0.5, opy - 0.5)
