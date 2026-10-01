"""Pixel text: sprites as rows of one-character palette codes, for reading and for hand fixes.

    uv run -q --with pillow --with numpy python scripts/art/pixtext.py FILE.png   # print it

'.' is transparent; every master-palette colour has one fixed code (CODES). Hand fixes to
generated art are written as pixel-text patches in code (see characters/rexi_master.py), so
every edit is reviewable text. A colour added to palette.ts later gets a spare character
automatically until it is given a fixed code here.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import MASTER, hex2rgb  # noqa: E402

FIXED = {
    # robe, greys, steel
    "k": "outline", "n": "night", "r": "robe", "u": "robeMid", "R": "robeSheen",
    "1": "grey1", "2": "grey2", "3": "grey3", "m": "marble", "w": "white",
    "4": "steel1", "5": "steel2", "6": "steel3",
    # stone
    "S": "stone1", "T": "stone2", "U": "stoneLight",
    # skin
    "a": "skin1", "b": "skin2", "c": "skin3", "f": "skinWarm", "d": "skin4", "e": "skin5",
    # leather and hair
    "L": "leather1", "M": "leather2", "N": "leather3", "O": "leather4", "h": "hairLight",
    # gym red
    "p": "red1", "q": "red2", "s": "red3", "v": "redLight", "t": "coral",
    # brass
    "y": "brass", "Y": "gold", "l": "light",
    # sky
    "A": "skyIndigo", "B": "skyPurple", "C": "skyViolet", "D": "skyMagenta", "E": "skyRose",
    "F": "skyOrange", "G": "skyPeach", "H": "sunYellow",
    # glass and neon
    "g": "glass1", "i": "glass2", "j": "glass3", "x": "neonCyan", "z": "neonTeal",
    "P": "neonPink", "W": "neonBlush", "X": "neonLime",
    # foliage
    "7": "leafDeep", "8": "leafShadow", "9": "leafMid", "o": "leaf", "K": "leafLight",
}
_SPARE = "IJVZ0!#$%&*+-/:;<=>?@^~"


def _codes():
    codes = {c: n for c, n in FIXED.items() if n in MASTER}
    spare = iter(ch for ch in _SPARE if ch not in codes)
    for name in MASTER:
        if name not in codes.values():
            codes[next(spare)] = name
    return codes


CODES = _codes()                                   # code -> colour name
CODE_OF = {n: c for c, n in CODES.items()}         # colour name -> code
RGB = {c: hex2rgb(MASTER[n]) for c, n in CODES.items()}
INV = {v: k for k, v in RGB.items()}


def to_text(sp):
    rows = []
    for y in range(sp.shape[0]):
        rows.append("".join(INV.get(tuple(int(v) for v in sp[y, x, :3]), "?") if sp[y, x, 3] else "."
                            for x in range(sp.shape[1])))
    return rows


def from_text(rows):
    h, w = len(rows), max(len(r) for r in rows)
    sp = np.zeros((h, w, 4), np.uint8)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in RGB:
                sp[y, x, :3] = RGB[c]; sp[y, x, 3] = 255
    return sp


def paint(sp, x0, y0, rows, clear="_"):
    """Stamp pixel text onto sp at (x0, y0): ' ' leaves a pixel, `clear` erases it."""
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            X, Y = x0 + x, y0 + y
            if not (0 <= X < sp.shape[1] and 0 <= Y < sp.shape[0]) or c == " ":
                continue
            if c == clear:
                sp[Y, X] = 0
            elif c in RGB:
                sp[Y, X, :3] = RGB[c]; sp[Y, X, 3] = 255
    return sp


def load(path):
    return np.asarray(Image.open(path).convert("RGBA")).copy()


if __name__ == "__main__":
    sp = load(sys.argv[1])
    print("    " + "".join(str(x % 10) for x in range(sp.shape[1])))
    for y, r in enumerate(to_text(sp)):
        print(f"{y:3d} {r}")
