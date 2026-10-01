"""The master palette and its ramps, read from src/render/palette.ts (the single source of truth).

    from palette import MASTER, RAMPS, allowed_colors, hex2rgb

- MASTER   name -> '#rrggbb', in palette.ts order (56 colours).
- RAMPS    ramp name -> [colour names], dark to light, as `paletteRamps` lists them.
- CLASSES  asset class -> the ramps it may snap to (ADR 0002: characters never use the Arena's
           sky, glass, neon or foliage ramps; scenes and icons may use everything).
- allowed_colors(spec) resolves a manifest entry's `palette` (a class name, or
  {"ramps": [...]} / {"colors": [...]}) to the list of hex colours a snap may pick.

A colour that sits in several ramps (coral is gym red and sunset; skyPeach is sky and fire) is
allowed whenever any of its ramps is.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TS = os.path.join(ROOT, "src", "render", "palette.ts")


def _block(src, start):
    i = src.index(start)
    return src[i:src.index("} as const satisfies", i)]


def _parse():
    src = open(TS).read()
    colours = {m.group(1): m.group(2).lower()
               for m in re.finditer(r"(\w+): '(#[0-9a-fA-F]{6})'", _block(src, "export const masterPalette"))}
    ramps = {}
    for m in re.finditer(r"(\w+): \[([^\]]*)\]", _block(src, "export const paletteRamps")):
        ramps[m.group(1)] = re.findall(r"'(\w+)'", m.group(2))
    return colours, ramps


MASTER, RAMPS = _parse()

ARENA_ONLY = ("sky", "glass", "neonCyan", "neonPink", "neonLime", "foliage")
CLASSES = {
    "character": [r for r in RAMPS if r not in ARENA_ONLY],
    "enemy": [r for r in RAMPS if r not in ("sky", "foliage")],
    "prop": [r for r in RAMPS if r not in ("sky",)],
    "icon": list(RAMPS),
    "scene": list(RAMPS),
}


def hex2rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def rgb2hex(c):
    return "#%02x%02x%02x" % tuple(int(v) for v in c[:3])


def allowed_names(spec=None):
    """Colour names a snap may pick for a manifest `palette` spec (None = every colour)."""
    if spec is None:
        return list(MASTER)
    if isinstance(spec, str):
        if spec not in CLASSES:
            raise ValueError(f"unknown palette class {spec!r}; one of {sorted(CLASSES)}")
        spec = {"ramps": CLASSES[spec]}
    names = []
    for ramp in spec.get("ramps", []):
        if ramp not in RAMPS:
            raise ValueError(f"unknown ramp {ramp!r}; one of {sorted(RAMPS)}")
        names += RAMPS[ramp]
    for name in spec.get("colors", []):
        if name not in MASTER:
            raise ValueError(f"unknown palette colour {name!r}")
        names.append(name)
    return [n for n in MASTER if n in set(names)]


def allowed_colors(spec=None):
    return [MASTER[n] for n in allowed_names(spec)]


NAME_OF = {v: k for k, v in MASTER.items()}

if __name__ == "__main__":
    print(len(MASTER), "colours,", len(RAMPS), "ramps")
    for c, ramps in CLASSES.items():
        print(f"  {c:10s} {len(allowed_names(c)):2d} colours")
