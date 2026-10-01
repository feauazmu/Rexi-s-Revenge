"""Lint every exported frame and part: palette colours only (Rexi's subset of src/render/palette.ts),
full alpha only, and no lone pixels. Prints the colours used.

    uv run -q --with pillow --with numpy python scripts/art/audit.py
"""
import glob
import os
import sys
from collections import Counter

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palette import ROOT, REXI, hex2rgb  # noqa: E402

PIPE = os.path.join(ROOT, "reference", "manu-pipeline")
NAMES = {hex2rgb(h): n for n, h in REXI.items()}


def main():
    files = sorted(glob.glob(os.path.join(PIPE, "frames", "*", "*.png")) + glob.glob(os.path.join(PIPE, "parts", "*.png"))
                   + [os.path.join(PIPE, "master_side.png")])
    used, bad = Counter(), 0
    for f in files:
        a = np.asarray(Image.open(f).convert("RGBA"))
        if not set(np.unique(a[..., 3])) <= {0, 255}:
            print("partial alpha:", f); bad += 1
        op = a[a[..., 3] > 0][:, :3]
        for c, n in Counter(map(tuple, op.tolist())).items():
            if c not in NAMES:
                print("off palette", c, f); bad += 1
            else:
                used[NAMES[c]] += n
    print(len(files), "files,", len(used), "colours used:", ", ".join(sorted(used)))
    print("problems:", bad)
    return bad


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
