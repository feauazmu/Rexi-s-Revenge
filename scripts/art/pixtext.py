"""Pixel text: sprites as rows of one-letter palette codes, for reading and hand-fixing in code.

    uv run -q --with pillow --with numpy python scripts/art/pixtext.py FILE.png   # print it

Codes (Rexi's subset): '.' clear, then one letter per colour below. Hand fixes are written as
pixel-text patches (see rexi_parts.py), so every edit to the generated master is reviewable text.
"""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import REXI, hex2rgb  # noqa: E402

CODES = {
    "k": "outline", "n": "night", "r": "robe", "R": "robeSheen",
    "1": "grey1", "2": "grey2", "3": "grey3", "m": "marble", "w": "white",
    "a": "skin1", "b": "skin2", "c": "skin3", "d": "skin4", "e": "skin5",
    "L": "leather1", "M": "leather2", "N": "leather3", "O": "leather4", "h": "hairLight",
    "y": "brass", "Y": "gold", "l": "light",
    "p": "red1", "q": "red2", "s": "red3", "t": "coral",
}
RGB = {c: hex2rgb(REXI[n]) for c, n in CODES.items()}
INV = {v: k for k, v in RGB.items()}


def to_text(sp):
    rows = []
    for y in range(sp.shape[0]):
        rows.append("".join(INV.get(tuple(int(v) for v in sp[y, x, :3]), "?") if sp[y, x, 3] else "." for x in range(sp.shape[1])))
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
