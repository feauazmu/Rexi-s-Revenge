"""Rexi for the game (#26): the production master, the rig, the body frames, the aiming-arm parts.

    uv run -q --with pillow --with numpy python scripts/art/characters/rexi.py master  # art/sprites/rexi/master.png
    uv run -q --with pillow --with numpy python scripts/art/characters/rexi.py build   # master + frames + parts

Built on the version C prototype (rexi_rig.py, reference/manu-pipeline), whose generated key poses
are re-snapped to the full character class in art/ (sheets.json), plus the new run keys
(rexi_run_v1). Every frame is layered from parts, never redrawn freehand (ADR 0002, rule 7):

  lower body  the robe's lower half, trousers and boots from a key pose, placed by its template
              slot and aligned to the master by matching the head;
  torso       the master's head, torso and robe pixel for pixel (no boiling); the hurt frames keep
              their key's own head and torso (a different expression and a lean);
  near arm    the master's near arm with its sleeve, cut out once and swung about the shoulder
              with RotSprite (run, jump, hurt), so the sleeve is the same pixels in every frame;
  aiming arm  not in the body frames: the far arm, cut from arm_forward_a, holding each Weapon,
              pre-rotated with RotSprite into 9 angles (parts/), drawn by the game at the frame's
              shoulder, with the robe's lapel cap over its root.

Facing (CONTEXT.md, the owner's correction in #26): the sleeve is on his RIGHT arm. Facing right
the camera sees his right side, so the near arm wears the sleeve and he aims with the far arm,
his plain left arm. Facing left the frame is mirrored: the near arm is now his left arm (plain)
and the aiming arm is his right arm (inked). So both the near arm and the aiming arm come in an
inked and a plain version, and the facing-left body frames are not plain mirrors.

Outputs (art/):
  frames/rexi/body/{right,left}/<frame>.png   body frames on the BODY canvas (no aiming arm)
  frames/rexi/cap.png                          the lapel over the aiming arm's root (facing right)
  frames/rexi/arm/<weapon>/{plain,inked}/<angle>.png
                                               the aiming arm and Weapon (facing right; the game
                                               mirrors it for facing left)
  frames/rexi/rexi.json                        canvas, anchors, per-frame shoulder and boots, the
                                               animation table and the arm pivots and muzzles
"""
import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rexi_common import ROOT  # noqa: E402
from pixtext import INV, RGB, from_text, paint, to_text  # noqa: E402
from project import write_json  # noqa: E402
from rotsprite import rotate  # noqa: E402
import rexi_master  # noqa: E402

ART = os.path.join(ROOT, "art")
SRC = os.path.join(ART, "sprites", "rexi", "src")
MASTER = os.path.join(ART, "sprites", "rexi", "master.png")
OUT = os.path.join(ART, "frames", "rexi")

# ---------------------------------------------------------------- geometry (master frame coords)
WORK = (120, 100)                  # working canvas while composing
BODY = (37, 20)                    # master frame (48x72) origin on the working canvas
FEET = 69                          # master frame row of the soles
TORSO_X = 23                       # master frame column of the torso centre (the hitbox centre line)
MASTER_LOCAL = (10, 5)             # the cleaned m34_b's (0, 0) inside the master frame
SLOT_W, SHEET_GROUND = 60, 100     # edit sheets: 4 slots of 60 cells, ground row 100
MASTER_BBOX_W, MASTER_H = 27, 65   # the master copy as pasted into every edit sheet
WAIST = 37                         # rows <= WAIST come from the torso layer, the rest from the key
KEY_MARGIN = 30                    # margin of the canvas a key pose is placed on
MARGIN = 24                        # margin of the body canvas while composing
PIVOT = (33, 20)                   # the aiming arm's shoulder pivot (facing right)
NEAR_PIVOT = (16, 21)              # the near arm's shoulder pivot
SHEAR_MAX = 15                     # near-arm swings up to this many degrees are shears, past it RotSprite
ROBE_LEFT = {y: (13 if y < 26 else 12) for y in range(17, 49)}   # robe edge behind the near arm
ANGLES = [-90, -67.5, -45, -22.5, 0, 22.5, 45, 67.5, 90]

SKIN = set("abcdef")
INK = set("ML")
ROBE = set("knurR")
BOOT = set("LMN")

SLOTS = {"key_contact": 0, "key_passing": 1, "key_jump": 2, "key_hurt": 3,
         "key_downA": 0, "key_contactB": 1, "key_downB": 2,
         "key_rise": 0, "key_fall": 1, "key_land": 2, "key_hurt2": 3,
         "key_upA": 0, "key_passingB": 1, "key_upB": 2, "key_passingB2": 3}

# ---------------------------------------------------------------- hand-drawn pieces (pixel text)
# The sleeve on the near arm, from (10, 19): one continuous piece from the robe's armhole to the
# elbow. The lion's mane rings his face (eyes, nose and mouth in ink), closes under the chin and
# flows down into the courthouse's pediment, architrave and three columns; the steps end the
# sleeve at the elbow. Ink is leather2 on the lit side and leather1 where the arm turns away;
# the bare forearm gets a skin5 highlight and a skinWarm/skin3 shadow. The image model's version
# (rexi_sleeve_v1) inked the whole arm into a brown mass, so this is drawn by hand.
SLEEVE = (10, 19, [
    "     MML    ",  # 19 mane under the armhole
    "  kMMMdMML  ",  # 20
    " kMMMdddMML ",  # 21 mane ring around the face
    " kMMdedddML ",  # 22
    " kMMdLdLdMLf",  # 23 eyes
    " keMddeddMLc",  # 24
    " kMMdeLedMLc",  # 25 nose
    "kdMMMdLdMLc ",  # 26 mouth
    "keMMMMdMMLc ",  # 27 the mane closes under the chin
    "keMddMddMfc ",  # 28 strands flow down; pediment apex
    "kedMMMMMdfc ",  # 29 pediment
    "kMMMMMMMML  ",  # 30 architrave
    "keMdMdMdLc  ",  # 31 columns
    "keMdMdMdL   ",  # 32 columns
    "kMMMMMMLL   ",  # 33 steps: the sleeve ends at the elbow
    " kedddddfc  ",  # 34 bare forearm
    " kedddddfc  ",  # 35
    " kedddddfc  ",  # 36
    "  kedddfcc  ",  # 37
])
# The same arm without ink: his left arm, the near arm when he faces left. Deltoid and biceps
# shaded as a round mass lit from the upper left, a skin3 crease at the elbow.
PLAIN = (10, 19, [
    "     ddf    ",  # 19
    "  kedddfc   ",  # 20
    " kedddddfc  ",  # 21
    " keedddddfc ",  # 22
    " keeddddddcf",  # 23
    " keddddddfcc",  # 24
    " kedddddffcc",  # 25
    "keeddddddfc ",  # 26
    "keddddddffc ",  # 27
    "kedddddddfc ",  # 28
    "kedddddddfc ",  # 29
    "keddddddffc ",  # 30
    "kedddddffc  ",  # 31
    "kccddddfc   ",  # 32
    "kcccccccc   ",  # 33 the elbow crease
    " kedddddfc  ",  # 34
    " kedddddfc  ",  # 35
    " kedddddfc  ",  # 36
    "  kedddfcc  ",  # 37
])
# The sleeve on the aiming arm (his right arm when he faces left), on the arm sprite at 0 degrees
# (shoulder on the left, fist on the right), from the pivot + (2, -3): the visible upper arm, from
# the lapel to the elbow. The near arm's piece turned on its side (the shoulder end is the top):
# the lion's face ringed by its mane by the shoulder (eyes, nose, mouth), the pediment, the
# columns along the arm, and the steps at the elbow; the underside in leather1.
ARM_SLEEVE_AT = (2, -3)
ARM_SLEEVE = [
    "MMMMMMMMMMML",
    "MLddMMddddML",
    "MdeLLMMMMMML",
    "MLddMMddddML",
    "MMMMMMMMMMML",
    "LLLLLLLLLLLL",
]
BLINK = [(24, 11), (25, 11), (28, 11)]       # the eyes: closed with leather2 lids

# The Weapons as held: `front` sits in front of the fist (its first columns under the knuckles),
# `under` hangs below the fist. (dx, dy) are from the fist's top-left; `muzzle` is the shot's
# origin past the fist along the arm, px. Character palette only (ADR 0002, rule 3).
WEAPONS = {
    # Mazo Automático: the gavel's head is the barrel (brass rings, a light striking face).
    "mazo-automatico": dict(front=(3, -1, [
        "..kkk......kkk.",
        ".kOhOkkkkkkOhOk",
        ".kOOOyOOOOyOOOk",
        ".kNNNYNNNNYNNhk",
        ".kNNNyNNNNyNNOk",
        ".kMMMyMMMMyMMNk",
        ".kMMMkkkkkkMMMk",
        "..kkk......kkk.",
    ]), under=(1, 6, ["kOk", "kNk", "kMk", ".k."]), muzzle=17),
    # Lluvia de Sellos: a red rubber stamp, its wooden knob in the fist, the inked face forward.
    "lluvia-de-sellos": dict(front=(3, -2, [
        ".......kkkkk.",
        "......ktvvvsk",
        "kkkkkkkvsssq5",
        "kONNNMkvsssq5",
        "kNNNMMksssqq5",
        "kkkkkkksqqqp5",
        "......kqqppp5",
        ".......kkkkk.",
    ]), under=None, muzzle=15),
    # Citaciones Teledirigidas: a fat manila envelope edge-on, its red wax seal toward the front.
    "citaciones-teledirigidas": dict(front=(3, -1, [
        ".kkkkkkkkkkkk.",
        "kmmmmmmmmmmmmk",
        "kmUUUUUmmmmm3k",
        "kmUmmmUUvsmm3k",
        "kmmmmmmmssmm3k",
        "kUUUUUUUUUUU3k",
        "k33333333333Tk",
        ".kkkkkkkkkkkk.",
    ]), under=None, muzzle=16),
    # Sentencia Firme: a rolled parchment held like a rail gun, a red ribbon, its tip glowing.
    "sentencia-firme": dict(front=(3, 0, [
        ".kkkkkkkkkkkk..",
        "kmmmmvmmmmmmYlk",
        "kUUUUsUUUUUUYwl",
        "kTTTTqTTTTTTyYk",
        "kTTTTqTTTTTTylk",
        ".kkkkkkkkkkkk..",
    ]), under=None, muzzle=17),
    # Mancuernas: a dumbbell gripped by its bar, a steel plate above and below the fist.
    "mancuernas": dict(front=(0, -7, [
        "kkkkkkk",
        "k66665k",
        "k65554k",
        "k55544k",
        "k55444k",
        "kkkkkkk",
        "..k1k..",
        "..k1k..",
    ]), under=(0, 6, [
        "..k1k..",
        "..k1k..",
        "kkkkkkk",
        "k66665k",
        "k65554k",
        "k55544k",
        "k55444k",
        "kkkkkkk",
    ]), muzzle=8),
    # Código Penal: the red law book held by its spine, gold scales on the cover, pages beneath.
    "codigo-penal": dict(front=(2, -2, [
        "kkkkkkkkkkkk.",
        "kqtvvvvvvvvsk",
        "kqvvvYYvvvvsk",
        "kqvvYvvYvvvsk",
        "kqvvvYYvvvvsk",
        "kqssssssssssk",
        "kqwwwwwwwwwmk",
        "kkkkkkkkkkkk.",
    ]), under=None, muzzle=15),
}


# ---------------------------------------------------------------- small helpers
def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


def save(sp, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    Image.fromarray(sp).save(path)


def rgba(code):
    return np.array(RGB[code] + (255,), np.uint8)


def code_at(sp, x, y):
    if not (0 <= y < sp.shape[0] and 0 <= x < sp.shape[1]) or sp[y, x, 3] == 0:
        return "."
    return INV.get(tuple(int(v) for v in sp[y, x, :3]), "?")


def blit(dst, src, x0, y0):
    """Alpha-stamp src onto dst at integer (x0, y0), clipped."""
    h, w = src.shape[:2]
    ys, xs = np.nonzero(src[..., 3])
    X, Y = xs + x0, ys + y0
    ok = (X >= 0) & (Y >= 0) & (X < dst.shape[1]) & (Y < dst.shape[0])
    dst[Y[ok], X[ok]] = src[ys[ok], xs[ok]]
    return dst


def ring(sp, code="k"):
    """A 1 px outline around the sprite's silhouette (ADR 0002, rule 4)."""
    m = sp[..., 3] > 0
    r = np.zeros_like(m)
    r[1:] |= m[:-1]; r[:-1] |= m[1:]; r[:, 1:] |= m[:, :-1]; r[:, :-1] |= m[:, 1:]
    sp[r & ~m] = rgba(code)
    return sp


def despeckle(sp):
    """Drop lone pixels (no opaque 8-neighbour)."""
    a = sp[..., 3] > 0
    p = np.pad(a, 1)
    n = sum(p[1 + dy:1 + dy + a.shape[0], 1 + dx:1 + dx + a.shape[1]]
            for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - a
    out = sp.copy()
    out[a & (n == 0)] = 0
    return out


def flood(sp, seed, codes, box):
    """4-connected pixels whose code is in `codes`, from `seed`, inside box (x0, y0, x1, y1)."""
    x0, y0, x1, y1 = box
    m = np.zeros(sp.shape[:2], bool)
    todo = [seed]
    while todo:
        x, y = todo.pop()
        if not (x0 <= x < x1 and y0 <= y < y1) or m[y, x] or code_at(sp, x, y) not in codes:
            continue
        m[y, x] = True
        todo += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return m


def with_outline(sp, m):
    """Grow mask `m` by the outline pixels (k) that touch it."""
    g = m.copy()
    g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
    k = np.zeros_like(m)
    for y, x in zip(*np.nonzero(g & ~m)):
        k[y, x] = code_at(sp, x, y) == "k"
    return m | k


def fill_robe(sp, hole, robe_left):
    """Fill a hole the near arm left: night robe cloth from the robe's edge rightwards, its
    outline on the edge; transparent left of it."""
    for y, x in zip(*np.nonzero(hole)):
        left = robe_left.get(y)
        if left is None or x < left:
            sp[y, x] = 0
        else:
            sp[y, x] = rgba("k" if x == left else "n")
    return sp


def shift(sp, dx, dy):
    out = np.zeros_like(sp)
    return blit(out, sp, dx, dy)


# ---------------------------------------------------------------- the master
def master():
    """The prototype's hand pass (rexi_master.fix) on the re-snapped m34_b, on the 48x72 frame,
    plus the right-arm sleeve."""
    rows = rexi_master.fix(to_text(load(os.path.join(SRC, "m34_b.png"))))
    sp = from_text(rows)
    W, H = rexi_master.CANVAS
    frame = np.zeros((H, W, 4), np.uint8)
    ox, oy = rexi_master.OFFSET
    frame[oy:oy + sp.shape[0], ox:ox + sp.shape[1]] = sp
    x, y, patch = SLEEVE
    paint(frame, x, y, patch)
    save(frame, MASTER)
    return frame


# ---------------------------------------------------------------- the rig
class Rig:
    def __init__(self):
        self.pos = json.load(open(os.path.join(SRC, "positions.json")))
        self.master = load(MASTER)
        self.keys, self.offsets, self.near_cache, self.arm_cache = {}, {}, {}, {}
        self.torso, near_mask = self._torso()
        plain = self.master.copy()
        paint(plain, PLAIN[0], PLAIN[1], PLAIN[2])
        self.near = {True: self._cut(self.master, near_mask), False: self._cut(plain, near_mask)}
        self.arm, self.arm_pivot, self.cap, self.fist = self._arm()

    # ------------------------------------------------------------ master-derived parts
    def _near_mask(self, sp, seed, dx=0, dy=0):
        """The near arm (skin and ink, from the shoulder to the fist) plus its outline."""
        m = flood(sp, seed, SKIN | INK, (dx, 14 + dy, 28 + dx, 52 + dy))
        return with_outline(sp, m)

    def _torso(self):
        """The master without its near arm (the hole filled with robe) and without the far fist
        (the aiming arm replaces it). Returns (torso, near-arm mask)."""
        m = self.master.copy()
        for y in range(34, 47):
            for x in range(34, 40):
                if code_at(m, x, y) in SKIN | INK:
                    m[y, x] = 0
        mask = self._near_mask(self.master, (15, 28))
        fill_robe(m, mask, ROBE_LEFT)
        return m, mask

    def _cut(self, src, mask):
        out = np.zeros_like(src)
        out[mask] = src[mask]
        return out

    def near_arm(self, angle, inked):
        """The near arm swung by `angle` degrees about its shoulder (positive: the fist swings
        forward), on a master-frame-sized layer."""
        key = (angle, inked)
        if key not in self.near_cache:
            layer = self.near[inked]
            if angle == 0:
                self.near_cache[key] = layer
            elif abs(angle) <= SHEAR_MAX:
                # a small swing is a shear: whole rows slide, so the sleeve's 1 px linework stays
                # intact (RotSprite would resample it)
                out = np.zeros_like(layer)
                t = math.tan(math.radians(angle))
                for y in range(layer.shape[0]):
                    dx = int(round((y - NEAR_PIVOT[1]) * t)) if y > NEAR_PIVOT[1] else 0
                    blit(out, layer[y:y + 1], dx, y)
                self.near_cache[key] = out
            else:
                r, (px, py) = rotate(layer, angle, NEAR_PIVOT)
                out = np.zeros_like(layer)
                blit(out, r, int(round(NEAR_PIVOT[0] - px)), int(round(NEAR_PIVOT[1] - py)))
                self.near_cache[key] = out
        return self.near_cache[key]

    def _arm(self):
        """The aiming arm, straight out to the right, from arm_forward_a: (sprite, pivot, lapel
        cap, fist top-left). The arm is cut from skin and ink; its border (skin1 in the
        re-snapped key) becomes a 1 px outline."""
        src = load(os.path.join(SRC, "arm_forward_a.png"))
        lx, ly = MASTER_LOCAL
        ox, oy = 28, 13                          # arm sprite (0, 0) in master frame coords
        H, W = 24, 56
        arm = np.zeros((H, W, 4), np.uint8)
        for y in range(10, 22):
            for x in range(25, src.shape[1]):
                if src[y, x, 3] and code_at(src, x, y) in SKIN | INK:
                    arm[y + ly - oy, x + lx - ox] = src[y, x]
        border = arm[..., 3] > 0
        inner = border.copy()
        inner[1:] &= border[:-1]; inner[:-1] &= border[1:]; inner[:, 1:] &= border[:, :-1]; inner[:, :-1] &= border[:, 1:]
        for y, x in zip(*np.nonzero(border & ~inner)):
            if code_at(arm, x, y) in ("a", "b"):
                arm[y, x] = 0                     # the key's dark border: the outline goes here
        root = 25 + lx - ox                       # repeat the root column under the lapel cap
        for x in range(root - 5, root):
            arm[:, x] = arm[:, root]
        ring(arm)
        cap = np.zeros_like(self.master)          # the lapel over the arm's root
        for y in range(9, 22):
            for x in range(18, 25):
                if src[y, x, 3] and code_at(src, x, y) in ROBE:
                    cap[y + ly, x + lx] = src[y, x]
        fist = (54 - ox, 17 - oy)
        return arm, (PIVOT[0] - ox, PIVOT[1] - oy), cap, fist

    def arm_sprite(self, weapon, inked):
        """The aiming arm at 0 degrees holding `weapon`, optionally with the sleeve."""
        a = self.arm.copy()
        px, py = self.arm_pivot
        if inked:
            paint(a, px + ARM_SLEEVE_AT[0], py + ARM_SLEEVE_AT[1], [r.replace(".", " ") for r in ARM_SLEEVE])
        spec = WEAPONS[weapon]
        fl, ft = self.fist
        pad = 12                                   # room above, below and past the fist
        out = np.zeros((a.shape[0] + 2 * pad, a.shape[1] + pad, 4), np.uint8)
        blit(out, a, 0, pad)
        fist = out[:, :fl + 6].copy()
        fx, fy, rows = spec["front"]
        blit(out, from_text(rows), fl + fx, ft + fy + pad)
        blit(out, fist, 0, 0)                      # the knuckles stay in front of the Weapon
        if spec["under"]:
            ux, uy, rows = spec["under"]
            blit(out, from_text(rows), fl + ux, ft + uy + pad)
        return out, (px, py + pad)

    def arm_at(self, weapon, angle, inked):
        """(sprite, pivot) of the aiming arm rotated by `angle` (facing right), RotSprite from
        the nearer of 0 / +-90 degrees so each pass turns at most 45 degrees."""
        key = (weapon, angle, inked)
        if key not in self.arm_cache:
            base, pivot = self.arm_sprite(weapon, inked)
            near = 90 * round(angle / 90)
            b, p = rotate(base, near, pivot) if near else (base, pivot)
            r, p = rotate(b, angle - near, p) if angle != near else (b, p)
            ys, xs = np.nonzero(r[..., 3])
            y0, x0 = ys.min(), xs.min()
            self.arm_cache[key] = (r[y0:ys.max() + 1, x0:xs.max() + 1].copy(), (p[0] - x0, p[1] - y0))
        return self.arm_cache[key]

    def muzzle_reach(self, weapon):
        """Distance from the shoulder pivot to the muzzle along the arm, px."""
        return self.fist[0] - self.arm_pivot[0] + WEAPONS[weapon]["muzzle"]

    # ------------------------------------------------------------ key poses
    def key(self, name):
        """A key pose placed in master frame coords, on a 30 px margin canvas: the sprite, with
        its own near arm and far fist still in."""
        if name not in self.keys:
            p = self.pos[name]
            sp = rexi_master_hand_pass(load(os.path.join(SRC, name + ".png")))
            mx = SLOTS[name] * SLOT_W + SLOT_W // 2 - MASTER_BBOX_W // 2
            my = SHEET_GROUND - MASTER_H
            fx, fy = p["x"] - mx + MASTER_LOCAL[0], p["y"] - my + MASTER_LOCAL[1]
            H, W = self.master.shape[:2]
            frame = np.zeros((H + 2 * KEY_MARGIN, W + 2 * KEY_MARGIN, 4), np.uint8)
            blit(frame, sp, fx + KEY_MARGIN, fy + KEY_MARGIN)
            self.keys[name] = frame
        return self.keys[name]

    def head_offset(self, name):
        """(dx, dy) the key's head sits at relative to the master's, by best match."""
        if name not in self.offsets:
            frame = self.key(name)
            best = None
            for dy in range(-24, 10):
                for dx in range(-8, 8):
                    s = 0
                    for y in range(5, 17):
                        for x in range(18, 31):
                            if not self.master[y, x, 3]:
                                continue
                            Y, X = y + dy + KEY_MARGIN, x + dx + KEY_MARGIN
                            if frame[Y, X, 3] and (frame[Y, X, :3] == self.master[y, x, :3]).all():
                                s += 1
                    if best is None or s > best[0]:
                        best = (s, dx, dy)
            self.offsets[name] = best[1:]
        return self.offsets[name]

    def _strip_key(self, name, own_upper):
        """The key on a master-frame canvas, moved so its head matches the master's, without its
        own near arm (the master's is drawn instead) and without its far fist. Returns (sprite,
        (dx, dy) applied)."""
        frame = self.key(name)
        hx, hy = (0, 0) if own_upper else self.head_offset(name)
        M = KEY_MARGIN
        sp = shift(frame, -hx, -hy)
        # the key's near arm: seeded on its upper arm, near where the master's sits
        seed = next(((x + M, y + M) for y in range(24, 36) for x in range(10, 20)
                     if code_at(sp, x + M, y + M) in SKIN | INK), None)
        lean = (0, 0)
        if seed:
            mask = self._near_mask(sp, seed, M, M)
            lean = self._shoulder_shift(mask, M)
            fill_robe(sp, mask, {y + M: x + M + lean[0] for y, x in ROBE_LEFT.items()})
        for y in range(18, 54):                   # the far fist: the aiming arm replaces it
            for x in range(31, 44):
                if code_at(sp, x + M, y + M) in SKIN | INK:
                    sp[y + M, x + M] = 0
        sp = despeckle(sp)
        return sp, lean

    def _shoulder_shift(self, mask, margin):
        """Where a key's near arm sits relative to the master's: (dx, dy) between the mean of
        their top rows (the shoulder). `mask` is on a canvas with `margin`."""
        def top(m):
            ys, xs = np.nonzero(m)
            y0 = ys.min()
            sel = ys < y0 + 6
            return xs[sel].mean(), y0
        (mx, my), (kx, ky) = top(self._near_mask(self.master, (15, 28))), top(mask)
        return int(round(kx - margin - mx)), int(ky - margin - my)

    # ------------------------------------------------------------ composition
    def body(self, key=None, bob=0, breath=0, blink=False, shorten=0, swing=0, own_upper=False,
             lean=(0, 0), inked=True):
        """One body frame on the master frame canvas (48x72 plus margins; see _canvas), facing
        right. key: key pose for the lower body (None = the master's); bob: the upper body's rows
        down (+) or up (-); breath: inhale (head and shoulders up 1); shorten: rows removed from
        the key's legs (the model drew the stretched air poses' legs too long); swing: the near
        arm's angle; own_upper: keep the key's own head and torso (hurt), `lean` moving the near
        arm's shoulder with it; inked: the near arm wears the sleeve (facing right).
        Returns (sprite, shoulder) where shoulder is the aiming arm's pivot."""
        H, W = self.master.shape[:2]
        mg = MARGIN
        out = np.zeros((H + 2 * mg, W + 2 * mg, 4), np.uint8)
        torso = self.torso.copy()
        if breath:
            torso[0:22] = self.torso[1:23]
        if blink:
            for x, y in BLINK:
                if torso[y, x, 3]:
                    torso[y, x] = rgba("M")
        if key:
            sp, key_lean = self._strip_key(key, own_upper)
            if own_upper:
                lean = (key_lean[0] + lean[0], key_lean[1] + lean[1])
            M = KEY_MARGIN
            if shorten:
                sp = self._shorten(sp, shorten, top=WAIST + 4 + M)
            low = sp.copy()
            if not own_upper:
                for Y in range(low.shape[0]):
                    for X in range(low.shape[1]):
                        x, y = X - M, Y - M
                        if low[Y, X, 3] and y <= WAIST + bob:
                            # above the waist only the robe streaming out behind him survives
                            ty = min(max(y - bob, 0), H - 1)
                            behind = 0 <= x < W and torso[ty, x, 3]
                            if not (code_at(low, X, Y) in ROBE and x < 13 and y >= 28 and not behind):
                                low[Y, X] = 0
            blit(out, low, mg - M, mg - M)
        else:
            low = torso.copy()
            low[:WAIST + 1] = 0
            blit(out, low, mg, mg)
        if not own_upper:
            up = torso.copy()
            up[WAIST + 1:] = 0
            blit(out, up, mg, mg + bob)
        lx, ly = lean
        arm = self.near_arm(swing, inked)
        lift = 1 if breath else 0
        blit(out, arm, mg + lx, mg + bob + ly - lift)
        if swing:
            # the robe's torn armhole stays over the swung shoulder (and hides RotSprite's crumbs)
            before = out.copy()
            band = np.zeros_like(out)
            y0, y1 = mg + bob + ly - lift + 14, mg + bob + ly - lift + 21
            x0, x1 = mg + lx + 6, mg + lx + 26
            if own_upper:
                src = np.zeros_like(out)
                blit(src, low, mg - KEY_MARGIN, mg - KEY_MARGIN)
            else:
                src = np.zeros_like(out)
                blit(src, torso, mg, mg + bob - lift)
            band[y0:y1, x0:x1] = src[y0:y1, x0:x1]
            top = y0 + 5                          # above the arm's own top row: the torso only
            out[y0:top, x0:x1] = src[y0:top, x0:x1]
            for y, x in zip(*np.nonzero(band[..., 3])):
                if code_at(band, x, y) in ROBE:
                    out[y, x] = band[y, x]
                elif code_at(before, x, y) in ROBE | {"."}:
                    out[y, x] = band[y, x]
        out = despeckle(out)
        shoulder = (PIVOT[0] + lx + mg, PIVOT[1] + ly + bob + mg - (1 if breath else 0))
        cap_at = (lx + mg, ly + bob + mg - (1 if breath else 0))
        return out, shoulder, cap_at

    def _shorten(self, sp, n, top):
        """Remove n rows between `top` and the boots, the ones most like the row below them
        (manus-garden's pixelize.shorten); everything above slides down."""
        sp = sp.copy()
        for _ in range(n):
            ys = np.nonzero(sp[..., 3].any(1))[0]
            bot = ys.max() - 8
            best = None
            for y in range(top, bot):
                d = (np.abs(sp[y].astype(int) - sp[y + 1].astype(int)).sum(-1) > 0).sum()
                if best is None or d < best[0]:
                    best = (d, y)
            y = best[1]
            sp[1:y + 1] = sp[0:y].copy(); sp[0] = 0      # the body above moves down; the legs stay
        return sp


# ---------------------------------------------------------------- the animation set
# Body frames: name -> Rig.body arguments. The aiming arm is not in them (the game adds it).
# Run: an 8-frame cycle with no reused pose (contact, down, passing, up for each leg); the near
# arm swings against the near leg. Jump: rise, apex, fall, land. Hurt: two keys with their own
# head and torso. Idle: rest, inhale, blink.
BODY_FRAMES = {
    "rest": {},
    "breath": {"breath": 1},
    "blink": {"blink": True},
    "run_0": {"key": "key_contact", "swing": -12},
    "run_1": {"key": "key_downA", "bob": 1, "swing": -8},
    "run_2": {"key": "key_passing", "bob": -1, "swing": 0},
    "run_3": {"key": "key_upA", "bob": -2, "swing": 8},
    "run_4": {"key": "key_contactB", "swing": 12},
    "run_5": {"key": "key_downB", "bob": 1, "swing": 8},
    "run_6": {"key": "key_passingB", "bob": -1, "swing": 0},
    "run_7": {"key": "key_upB", "bob": -2, "swing": -8},
    "jump_0": {"key": "key_rise", "shorten": 12, "swing": 15},
    "jump_1": {"key": "key_jump", "swing": 30},
    "jump_2": {"key": "key_fall", "shorten": 8, "swing": 40},
    "jump_3": {"key": "key_land", "bob": 3, "swing": 10},
    "hurt_0": {"key": "key_hurt", "own_upper": True, "swing": -20},
    "hurt_1": {"key": "key_hurt2", "own_upper": True, "swing": -30},
}
RUN = [f"run_{i}" for i in range(8)]
# Animations: fps, loop and body frames. `shoot` and `aim` also move the aiming arm, which the
# game draws: shoot frames carry (recoil px, muzzle flash size 0..2) and run 3 frames at 25 fps,
# 0.12 s, the Mazo Automático's fire interval (tuning.weapons), so each shot plays it once.
ANIMS = {
    "idle": {"fps": 6, "loop": True, "frames": ["rest", "rest", "breath", "breath", "rest", "rest", "rest", "blink"]},
    "run": {"fps": 15, "loop": True, "frames": RUN},
    "run-back": {"fps": 15, "loop": True, "frames": RUN[::-1]},
    "jump": {"fps": 6, "loop": False, "frames": ["jump_0", "jump_1", "jump_2", "jump_3"]},
    "hurt": {"fps": 15, "loop": False, "frames": ["hurt_0", "hurt_1", "hurt_1", "hurt_0"]},
    "shoot": {"fps": 25, "loop": False, "frames": ["rest", "rest", "rest"], "recoil": [2, 1, 0], "flash": [2, 1, 0]},
    "aim": {"fps": 4, "loop": True, "frames": ["rest"] * 16},
}


def boots(sp, feet_row):
    """The two boots' sole centres (x, row under the sole): the two biggest 8-connected
    clusters of boot leather below the knees. One cluster (boots side by side) counts twice."""
    leather = np.zeros(sp.shape[:2], bool)
    for y in range(feet_row - 30, sp.shape[0]):
        for x in range(sp.shape[1]):
            leather[y, x] = code_at(sp, x, y) in BOOT
    seen = np.zeros_like(leather)
    clusters = []
    for y, x in zip(*np.nonzero(leather)):
        if seen[y, x]:
            continue
        todo, pts = [(x, y)], []
        while todo:
            cx, cy = todo.pop()
            if not (0 <= cx < sp.shape[1] and 0 <= cy < sp.shape[0]) or seen[cy, cx] or not leather[cy, cx]:
                continue
            seen[cy, cx] = True
            pts.append((cx, cy))
            todo += [(cx + dx, cy + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1) if dx or dy]
        clusters.append(pts)
    clusters = sorted((c for c in clusters if len(c) >= 6), key=len, reverse=True)[:2]
    if len(clusters) == 1:                    # boots side by side: split at the mean column
        mid = np.mean([p[0] for p in clusters[0]])
        clusters = [[p for p in clusters[0] if p[0] < mid], [p for p in clusters[0] if p[0] >= mid]]
    out = [(int(round(np.mean([p[0] for p in c]))), int(max(p[1] for p in c)) + 1) for c in clusters]
    return sorted(out)


def build(rig=None):
    """Writes OUT (see the module docstring); returns the data written to rexi.json."""
    rig = rig or Rig()
    composed = {}
    for name, args in BODY_FRAMES.items():
        for facing, inked in (("right", True), ("left", False)):
            composed[(name, facing)] = rig.body(**args, inked=inked)
    # crop every body frame to the union of their silhouettes (same box for both facings)
    union = np.zeros(composed[("rest", "right")][0].shape[:2], bool)
    for sp, _, _ in composed.values():
        union |= sp[..., 3] > 0
    ys, xs = np.nonzero(union)
    x0, y0, x1, y1 = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
    W, H = int(x1 - x0), int(y1 - y0)
    mg = MARGIN
    anchor = [int(TORSO_X + mg - x0), int(FEET + mg - y0)]
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    frames = {}
    for (name, facing), (sp, shoulder, cap_at) in composed.items():
        crop = sp[y0:y1, x0:x1]
        if facing == "left":
            crop = crop[:, ::-1]
        save(crop.copy(), os.path.join(OUT, "body", facing, name + ".png"))
        if facing == "right":
            frames[name] = {"shoulder": [shoulder[0] - int(x0), shoulder[1] - int(y0)],
                            "cap": [cap_at[0] - int(x0), cap_at[1] - int(y0)],
                            "boots": [list(b) for b in boots(crop, anchor[1])]}
    # the lapel cap, cropped, with its offset from the frame's cap origin
    cys, cxs = np.nonzero(rig.cap[..., 3])
    cap = rig.cap[cys.min():cys.max() + 1, cxs.min():cxs.max() + 1].copy()
    save(cap, os.path.join(OUT, "cap.png"))
    for f in frames.values():
        f["cap"] = [f["cap"][0] + int(cxs.min()), f["cap"][1] + int(cys.min())]
    # the aiming arm: every Weapon, plain and inked, 9 angles
    arms = {}
    for weapon in WEAPONS:
        arms[weapon] = {"reach": rig.muzzle_reach(weapon), "pivots": {}}
        for inked in (False, True):
            ink = "inked" if inked else "plain"
            arms[weapon]["pivots"][ink] = {}
            for a in ANGLES:
                sp, (px, py) = rig.arm_at(weapon, a, inked)
                key = f"{a:+06.1f}"
                save(sp, os.path.join(OUT, "arm", weapon, ink, key + ".png"))
                arms[weapon]["pivots"][ink][key] = [round(float(px), 2), round(float(py), 2)]
    data = {"canvas": [W, H], "anchor": anchor, "angles": ANGLES, "frames": frames,
            "anims": ANIMS, "arms": arms}
    write_json(os.path.join(OUT, "rexi.json"), data)
    return data


# The Dialogue Box portrait (40x40). sprites/rexi/portrait_draft.png, the edit's input, is the old
# code-drawn portrait (src/render/dialogue/rexi-portrait.ts before #26) mirrored, so the flexed
# arm is on the viewer's left, his RIGHT arm, and snapped to the palette. The edit
# (rexi_portrait_v1) redrew the face and shading; copy b is used, with two fixes in pixel text:
# the model inked the raised forearm too (the sleeve stops at the elbow, so it is bare skin
# again), and the tank top's white touching the bottom edge was keyed out as background.
PORTRAIT = os.path.join(ART, "sprites", "rexi", "portrait.png")
PORTRAIT_RECOLOR = {"S": "b", "T": "c", "D": "b"}   # stone1, stone2, skyMagenta -> skin2, skin3, skin2
PORTRAIT_FOREARM = (0, 12, [
    "  nedddcn",   # 12
    "  nedddcn",   # 13
    "  nedddcn",   # 14
    " neddddcbn",  # 15
    " neddddcbn",  # 16
    " neddddcbn",  # 17
    " neddddcbn",  # 18
])


def portrait():
    sp = load(os.path.join(SRC, "portrait_b.png"))
    x, y, rows = PORTRAIT_FOREARM
    paint(sp, x, y, rows)
    sp[sp[..., 3] == 0] = rgba("w")            # the tank top's keyed-out white (the only clear pixels)
    # skin shading the snap took to stone and magenta (grey cheeks, a grey ring at the neck)
    for src, dst in PORTRAIT_RECOLOR.items():
        sp[(sp[..., :3] == RGB[src]).all(-1)] = rgba(dst)
    save(sp, PORTRAIT)
    return sp


def rexi_master_hand_pass(sp):
    """The master's rule-based hand pass applied to a key: interior outline black in the robe
    becomes night, boot leather1 inside the boot becomes leather2 (rexi_rig.hand_pass)."""
    out = sp.copy()
    h, w = sp.shape[:2]
    for y in range(h):
        for x in range(w):
            c = code_at(sp, x, y)
            if c not in "kL":
                continue
            ns = [code_at(sp, x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if c == "k" and all(n in ROBE for n in ns):
                out[y, x] = rgba("n")
            elif c == "L" and "." not in ns and code_at(sp, x, y + 1) != "k" and y > h - 16:
                out[y, x] = rgba("M")
    return out


if __name__ == "__main__":
    step = sys.argv[1] if len(sys.argv) > 1 else ""
    if step == "master":
        for y, r in enumerate(to_text(master())):
            print(f"{y:3d} {r}")
    elif step == "portrait":
        portrait()
    elif step == "build":
        master()
        portrait()
        d = build()
        print(f"canvas {d['canvas']}, anchor {d['anchor']}, {len(d['frames'])} body frames x 2 facings, "
              f"{len(d['arms'])} Weapons x 2 x {len(ANGLES)} arm angles")
    else:
        sys.exit(__doc__)
