"""Version C exports: animation frames, arm parts, the 4x contact sheet and the in-game mock.

    uv run -q --with pillow --with numpy python scripts/art/characters/rexi_export.py [ARENA_PNG ARENA_JSON]

Writes (all from rexi_rig.Rig, nothing hand-placed):
  reference/manu-pipeline/frames/<anim>/NN.png and anim.json   the frames (committed)
  reference/manu-pipeline/parts/arm_{inked,plain}_<angle>.png  the 9 RotSprite arm angles
  reference/manu-pipeline/build/rexi-c-sheet.png               4x contact sheet + character sheet
  reference/manu-pipeline/build/rexi-c-ingame.png              one frame over a 640x360 Arena, 2x
                                                               (only with ARENA_PNG ARENA_JSON)
Frames are 120x100, transparent, soles on row 89, facing right unless noted (aim also faces left).
The generic previews (npm run art -- preview --root reference/manu-pipeline) show them too.
"""
import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rexi_common import PIPE, ROOT  # noqa: E402
from project import write_json  # noqa: E402
from rexi_rig import Rig, CANVAS, FEET, BODY, PIVOT, ANGLES  # noqa: E402


RUN = [("key_contact", 0), ("key_downA", 1), ("key_passing", -1),
       ("key_contactB", 0), ("key_downB", 1), ("key_passing", -1)]
# key_passingB came back with both legs straight (no lift), so the cycle reuses key_passing:
# at 64 px the lifted leg reads the same on both sides.


def build(rig):
    """{anim: (fps, loop, [frames])}"""
    rest = rig.compose()
    breath = rig.compose(breath=1)
    blink = rig.compose(blink=True)
    run = [rig.compose(k, bob=b) for k, b in RUN]
    jump = [rig.compose("key_rise", shorten=12), rig.compose("key_jump"),
            rig.compose("key_fall", shorten=8), rig.compose("key_land", bob=3)]
    hurt = [rig.compose("key_hurt", own_upper=True), rig.compose("key_hurt2", own_upper=True)]
    shoot = [rig.compose(recoil=2, flash=2), rig.compose(recoil=1, flash=1), rig.compose(recoil=0), rest]
    aim = [rig.compose(angle=a) for a in ANGLES] + \
          [rig.compose(angle=a, facing=-1) for a in reversed(ANGLES[1:-1])]
    return {
        "idle": (6, True, [rest, rest, breath, breath, rest, rest, rest, blink]),
        "run": (12, True, run),
        "run-back": (12, True, run[::-1]),
        "jump": (6, False, jump),
        "hurt": (10, False, [hurt[0], hurt[1], hurt[1], hurt[0]]),
        "shoot": (15, False, shoot),
        "aim": (4, True, aim),
    }


def write_frames(anims, out):
    if os.path.exists(out):
        shutil.rmtree(out)
    meta = {"canvas": list(CANVAS), "baseline": FEET, "anims": {}}
    for name, (fps, loop, frames) in anims.items():
        os.makedirs(os.path.join(out, name), exist_ok=True)
        for i, f in enumerate(frames):
            Image.fromarray(f).save(os.path.join(out, name, f"{i:02d}.png"))
        meta["anims"][name] = {"fps": fps, "loop": loop, "frames": len(frames)}
    write_json(os.path.join(out, "anim.json"), meta)


def contact_sheet(anims, rig, path, K=4):
    W, H = CANVAS
    rows = [
        ("idle: rest, breath, blink  |  shoot: recoil + flash  |  hurt", [anims["idle"][2][0], anims["idle"][2][2],
                                                                        anims["idle"][2][7]] + anims["shoot"][2][:2] + anims["hurt"][2][:2]),
        ("run (12 fps)", anims["run"][2]),
        ("run, facing left (mirrored; the sleeve moves to the near arm, his right)", [rig.compose(k, bob=b, facing=-1) for k, b in RUN]),
        ("jump: rise, apex, fall, land", anims["jump"][2]),
        ("aim: 9 RotSprite angles facing right (-90..90)", anims["aim"][2][:9]),
        ("aim: 7 more facing left = 16 directions", anims["aim"][2][9:]),
    ]
    cols = max(len(r[1]) for r in rows)
    cw, ch = W * K, H * K
    gw = cols * cw
    ref = Image.open(os.path.join(ROOT, "reference", "rexi-character-sheet.png")).convert("RGBA")
    rh = round(ref.height * gw * 0.62 / ref.width)
    ref = ref.resize((round(gw * 0.62), rh), Image.LANCZOS)
    master = Image.open(os.path.join(PIPE, "master_side.png"))
    mk = rh // master.height
    label_h = 44
    sheet = Image.new("RGBA", (gw, rh + 30 + len(rows) * (ch + label_h)), (32, 32, 40, 255))
    sheet.alpha_composite(ref, (0, 0))
    m = master.resize((master.width * mk, master.height * mk), Image.NEAREST)
    sheet.alpha_composite(m, (ref.width + 40, 0))
    d = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=26)
    d.text((ref.width + 40 + m.width + 20, 20), f"master ({mk}x)\n48x72 frame, Rexi 64 px", fill=(230, 230, 230), font=font)
    y = rh + 30
    for label, frames in rows:
        d.text((8, y + 8), label, fill=(230, 230, 230), font=font)
        y += label_h
        for i, f in enumerate(frames):
            cell = Image.new("RGBA", (W, H), (58, 60, 78, 255))
            for xx in range(0, W, 8):         # faint checker so the frame bounds show
                for yy in range(0, H, 8):
                    if (xx + yy) // 8 % 2:
                        cell.paste((62, 64, 84, 255), (xx, yy, xx + 8, yy + 8))
            ImageDraw.Draw(cell).line([(0, FEET + 1), (W, FEET + 1)], fill=(90, 92, 110, 255))
            cell.alpha_composite(Image.fromarray(f))
            sheet.alpha_composite(cell.resize((cw, ch), Image.NEAREST), (i * cw, y))
        y += ch
    sheet.convert("RGB").save(path, optimize=True)


def ingame(rig, arena_png, arena_json, path):
    """An Arena frame (a 640x360 game screenshot; an older 480x270 one is scaled up by an exact
    nearest resample), Rexi at his true 64 px on the ground where the game spawned him (ARENA_JSON:
    his hitbox {x, y, w, h} in that frame's coordinates), aiming at a Maletin-coptero, then 2x."""
    a = Image.open(arena_png).convert("RGBA")
    k = 640 / a.width
    a = a.resize((640, 360), Image.NEAREST)
    r = json.load(open(arena_json))
    feet_x, ground = (r["x"] + r["w"] / 2) * k, (r["y"] + r["h"]) * k
    target = (450, 105)
    torso_cx = BODY[0] + 23                       # canvas column of the torso centre
    px, py = feet_x + (BODY[0] + PIVOT[0] - torso_cx), ground - (FEET - (BODY[1] + PIVOT[1]))
    ang = math.degrees(math.atan2(py - target[1], target[0] - px))
    ang = min(ANGLES, key=lambda s: abs(s - ang))
    f = Image.fromarray(rig.compose(angle=ang, recoil=1, flash=2))
    a.alpha_composite(f, (int(round(feet_x - torso_cx)), int(round(ground - FEET - 1))))
    a.resize((1280, 720), Image.NEAREST).convert("RGB").save(path, optimize=True)
    return ang


def main():
    rig = Rig()
    anims = build(rig)
    write_frames(anims, os.path.join(PIPE, "frames"))
    out = os.path.join(PIPE, "build")
    os.makedirs(out, exist_ok=True)
    contact_sheet(anims, rig, os.path.join(out, "rexi-c-sheet.png"))
    if len(sys.argv) > 2:
        print("in-game aim angle", ingame(rig, sys.argv[1], sys.argv[2], os.path.join(out, "rexi-c-ingame.png")))
    # the 9 unique arm angles as parts (inked and plain), for the record
    parts = os.path.join(PIPE, "parts")
    os.makedirs(parts, exist_ok=True)
    for a in ANGLES:
        for inked in (False, True):
            sp, (px, py) = rig.arm_at(a, inked)
            Image.fromarray(sp).save(os.path.join(parts, f"arm_{'inked' if inked else 'plain'}_{a:+06.1f}.png"))
    print({k: len(v[2]) for k, v in anims.items()})


if __name__ == "__main__":
    main()
