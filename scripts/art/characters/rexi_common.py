"""Shared setup for Rexi's character scripts (the version C prototype, reference/manu-pipeline).

Importing this puts scripts/art on sys.path, so the character scripts use the pipeline library.

- PIPE         the prototype's art root (its sheets.json reproduces its sprites)
- REXI_COLORS  the 26-colour subset the prototype was snapped to (the 40-colour palette's robe,
               grey, skin, leather, brass and red ramps). Pinned in its sheets.json, so the
               committed frames stay reproducible after the palette grew to 56; the art pass
               may re-snap to the full "character" class instead (robeMid, skinWarm, steel).
- TATTOO_SIDE  "right": Rexi's sleeve is on his right arm (CONTEXT.md). Facing right the camera
               sees his left side, so the sleeve is on the far arm (the aiming arm); facing left
               it is on the near arm.
"""
import os
import sys

ART = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ART not in sys.path:
    sys.path.insert(0, ART)

from palette import ROOT  # noqa: E402

PIPE = os.path.join(ROOT, "reference", "manu-pipeline")
REXI_COLORS = [
    "outline", "night", "robe", "robeSheen",
    "grey1", "grey2", "grey3", "marble", "white",
    "skin1", "skin2", "skin3", "skin4", "skin5",
    "leather1", "leather2", "leather3", "leather4", "hairLight",
    "brass", "gold", "light",
    "red1", "red2", "red3", "coral",
]
TATTOO_SIDE = "right"
