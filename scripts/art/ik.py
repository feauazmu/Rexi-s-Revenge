"""IK limbs for code-driven animation (ADR 0002; manus-garden's Art/anim/engine/limb.js, in Python).

A rig keeps the master's head, torso and clothes pixel for pixel and redraws only the moving
limbs per frame: solve the joints with two-bone IK, then rasterise each limb from its joints
with a width profile, ramp shading (3 bands: shadow, base, light from the upper left) and a
1 px outline. Every pixel is a palette colour; there is no anti-aliasing and no partial alpha.

    from ik import solve2, limb
    knee, foot = solve2(hip, target, 9, 9, bend=1)
    sp, origin = limb([hip, knee, foot], [3.5, 3, 2.5], ramp=["skin2", "skin3", "skin4"])
    # paste sp at origin (top-left in the same coordinates as the joints)
"""
import math

import numpy as np

from palette import MASTER, hex2rgb


def solve2(root, target, l1, l2, bend=1):
    """Two-bone IK: (joint, end) for bones of lengths l1, l2 from `root` toward `target`. An
    unreachable target is approached along the straight line. `bend` +1 / -1 picks which side
    the joint bends to (screen y down: +1 bends a leg's knee forward for a figure facing right
    when the target is below)."""
    rx, ry = root
    dx, dy = target[0] - rx, target[1] - ry
    d = math.hypot(dx, dy)
    d = max(abs(l1 - l2) + 1e-6, min(d, l1 + l2 - 1e-6))
    base = math.atan2(dy, dx)
    cos_a = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    a = math.acos(max(-1.0, min(1.0, cos_a)))
    th = base - bend * a
    joint = (rx + l1 * math.cos(th), ry + l1 * math.sin(th))
    end = (rx + d * math.cos(base), ry + d * math.sin(base))
    return joint, end


def _seg_dist(px, py, a, b):
    ax, ay = a
    bx, by = b
    vx, vy = bx - ax, by - ay
    L2 = vx * vx + vy * vy or 1e-9
    t = np.clip(((px - ax) * vx + (py - ay) * vy) / L2, 0, 1)
    cx, cy = ax + t * vx, ay + t * vy
    return np.hypot(px - cx, py - cy), t, (px - cx), (py - cy)


def limb(joints, widths, ramp, light=(-1.0, -1.0), outline="outline"):
    """Rasterise a chain of bones. joints: [(x, y), ...] (>= 2); widths: a radius per joint
    (pixels, may be fractional), linearly interpolated along each bone; ramp: 3 palette names
    dark to light. Returns (RGBA sprite, (x0, y0)) where (x0, y0) is the sprite's top-left in
    joint coordinates."""
    if len(joints) < 2 or len(widths) != len(joints):
        raise ValueError("need >= 2 joints and one width per joint")
    if len(ramp) != 3:
        raise ValueError("ramp: [shadow, base, light] palette names")
    pad = int(math.ceil(max(widths))) + 2
    xs, ys = [j[0] for j in joints], [j[1] for j in joints]
    x0, y0 = int(math.floor(min(xs))) - pad, int(math.floor(min(ys))) - pad
    W, H = int(math.ceil(max(xs))) + pad - x0 + 1, int(math.ceil(max(ys))) + pad - y0 + 1
    gy, gx = np.mgrid[0:H, 0:W]
    px, py = gx + x0 + 0.5, gy + y0 + 0.5                      # pixel centres
    best = np.full((H, W), np.inf)
    shade = np.zeros((H, W))
    for (a, b), (wa, wb) in zip(zip(joints, joints[1:]), zip(widths, widths[1:])):
        d, t, ox, oy = _seg_dist(px, py, a, b)
        r = wa + (wb - wa) * t
        inside = d <= r
        rel = np.where(inside, d / np.maximum(r, 1e-6), np.inf)   # 0 at the bone, 1 at the rim
        closer = rel < best
        best = np.where(closer, rel, best)
        ln = math.hypot(*light)
        lit = (ox * light[0] + oy * light[1]) / (np.maximum(d, 1e-6) * ln)   # -1 away .. 1 toward
        shade = np.where(closer, lit * np.minimum(1, rel * 1.6), shade)
    mask = np.isfinite(best)
    out = np.zeros((H, W, 4), np.uint8)
    band = np.where(shade > 0.35, 2, np.where(shade < -0.25, 0, 1))
    for i, name in enumerate(ramp):
        sel = mask & (band == i)
        out[sel, :3] = hex2rgb(MASTER[name]); out[sel, 3] = 255
    ring = np.zeros_like(mask)
    ring[1:] |= mask[:-1]; ring[:-1] |= mask[1:]; ring[:, 1:] |= mask[:, :-1]; ring[:, :-1] |= mask[:, 1:]
    ring &= ~mask
    out[ring, :3] = hex2rgb(MASTER[outline]); out[ring, 3] = 255
    return out, (x0, y0)


def paste(dst, sp, origin):
    """Stamp an RGBA sprite onto dst at integer origin (opaque pixels only)."""
    x0, y0 = origin
    ys, xs = np.nonzero(sp[..., 3])
    Y, X = ys + y0, xs + x0
    ok = (Y >= 0) & (Y < dst.shape[0]) & (X >= 0) & (X < dst.shape[1])
    dst[Y[ok], X[ok]] = sp[ys[ok], xs[ok]]
    return dst
