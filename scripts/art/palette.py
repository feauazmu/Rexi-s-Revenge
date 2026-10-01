"""The master palette, read from src/render/palette.ts (the single source of truth), plus the
subset Rexi's sprites may use and the proposed extension (see scripts/art/README.md).

    from palette import MASTER, REXI, hex2rgb
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TS = os.path.join(ROOT, "src", "render", "palette.ts")


def _parse():
    src = open(TS).read()
    block = src[src.index("export const masterPalette"):src.index("} as const satisfies Record<string, Color>")]
    return {m.group(1): m.group(2).lower() for m in re.finditer(r"(\w+): '(#[0-9a-fA-F]{6})'", block)}


MASTER = _parse()          # name -> '#rrggbb', 40 colours

# Ramps a character sprite may use (no sky, glass, neon or foliage: those are the Arena's).
REXI_NAMES = [
    "outline", "night", "robe", "robeSheen",                         # robe
    "grey1", "grey2", "grey3", "marble", "white",                    # trousers, tank top
    "skin1", "skin2", "skin3", "skin4", "skin5",                     # skin
    "leather1", "leather2", "leather3", "leather4", "hairLight",     # boots, hair, gavel wood
    "brass", "gold", "light",                                        # gavel rings, buckle
    "red1", "red2", "red3", "coral",                                 # hurt flash, mouth
]

# Proposed extension (not in palette.ts yet): see README "Palette". Empty = none needed.
EXTENSION = {}

REXI = {n: MASTER[n] for n in REXI_NAMES}
REXI.update(EXTENSION)
ALL = {**MASTER, **EXTENSION}


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


if __name__ == "__main__":
    print(len(MASTER), "master colours;", len(REXI), "for Rexi")
