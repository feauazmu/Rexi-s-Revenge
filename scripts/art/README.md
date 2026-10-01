# Art pipeline

The tool behind [ADR 0002](../../docs/adr/0002-pixel-art-rules-and-pipeline.md): it turns image-model edits into true pixel art on the master palette, animates it in code, and exports it as palette-indexed TypeScript that the renderer draws. It generalises the version C prototype (Refs #9), a port of manus-garden's `Art/tools/` and `Art/anim/`. The research behind it is in [docs/research/ai-pixel-art-pipelines.md](../../docs/research/ai-pixel-art-pipelines.md).

The game renders at **640×360**. Rexi is about 64 px tall, and everything else is sized against him.

## Setup

The pipeline is Python 3 with Pillow and NumPy, run through [`uv`](https://docs.astral.sh/uv/), which fetches the dependencies on first use. Generation also needs the creation-tool CLI (`~/.local/bin/creation-tool`, or set `CREATION_TOOL`) with an OpenRouter key. The game build and CI need none of this: they consume only the exported TypeScript.

```sh
npm run art -- <command> [--root DIR] [...]   # = uv run -q --with pillow --with numpy python scripts/art/art.py
npm run art:test                              # the pipeline's own tests (pytest)
```

## Commands

| Command                        | What it does                                                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `budget`                       | Spent, cap and remaining: the CREDITS.md running total plus every ledger row not yet credited.                                                                                                       |
| `templates [NAME…]`            | Builds the manifest's `templates` (reference images on the model's grid) into `<root>/templates/`.                                                                                                   |
| `gen NAME [options]`           | One generation (see below). Writes `<root>/raw/NAME.png` and its JSON sidecar, and appends the cost to `art/ledger.tsv`.                                                                             |
| `credit`                       | Folds `art/ledger.tsv` into CREDITS.md: the "Art pipeline" table, the Budget row and the recomputed running total. Existing line items are kept. Run it after every generation session, then commit. |
| `clean [SHEET…]`               | Raw render → grid → palette snap → sprites (see "Cleaning").                                                                                                                                         |
| `bake [PART…]`                 | RotSprite pre-rotations with pivots (see "Parts").                                                                                                                                                   |
| `export [MODULE…] [--out DIR]` | TypeScript sprite modules (see "Export").                                                                                                                                                            |
| `preview [--scale N]`          | Contact sheets of every sheet, part and animation, plus `index.html`, in `<root>/build/preview/`.                                                                                                    |
| `audit [--strict]`             | Palette and pixel-rule lint; exits 1 on errors (see "Audit").                                                                                                                                        |
| `holes [-v] [FILE…]`           | Report of enclosed transparent holes (white that the cleaner cut out).                                                                                                                               |
| `build [--strict]`             | `clean`, `bake`, `export`, `preview`, `audit`.                                                                                                                                                       |
| `pixtext FILE`                 | Prints a sprite as pixel text (one code per palette colour).                                                                                                                                         |

Shortcuts: `npm run art:budget`, `art:build`, `art:audit`, `art:preview`.

## Art roots

An art root is a directory with a `sheets.json` manifest. `--root` defaults to `art/`, the production root. `reference/manu-pipeline/` is the version C prototype, kept as a second root so its outputs stay reproducible.

```
<root>/sheets.json      the manifest: templates, sheets, parts, exports, audit
<root>/prompts/*.txt    one prompt file per generation; _style.txt is the shared pixel-art preamble
<root>/templates/       reference images built by `templates` (git-ignored in art/: rebuild them)
<root>/raw/             full-size renders (git-ignored in art/) and their JSON sidecars (committed)
<root>/grid/            each render resampled to its art grid, 1 cell = 1 px, not yet snapped, plus
                        pitches.json: all `clean` needs, so a fresh clone rebuilds the art
<root>/sprites/         cleaned sprites (a sheet's `out` may name another folder)
<root>/parts/           baked rotations with pivots.json
<root>/frames/          animation frames and anim.json, written by a character script
<root>/build/           previews and reports (git-ignored)
```

## Workflow

1. **Decide the asset and its anchor.** A character pose edits copies of the master. A master is a lineup next to a proven sprite. An Enemy or prop fills empty size boxes next to Rexi. An icon fills a grid of icon cells. A scene is drawn as tiles of a draft.
2. **Write the template entry** in `sheets.json` → `templates`, and run `npm run art -- templates`. Open the `_1x.png` to check the size anchor and the guides.
3. **Write the prompt** in `<root>/prompts/NAME.txt`. Start from `_style.txt` (the sheet's `"style": true` prepends it), then describe only what changes. Name every slot ("1) … 2) …") and say what must stay identical.
4. **Add the sheet entry** (`prompt`, `refs`, `kind`, `names`, …) and check the call without spending: `npm run art -- gen NAME --dry-run`.
5. **Generate:** `npm run art -- gen NAME`. Look at `raw/NAME.png`. If it misses, write a new prompt or template and generate as `NAME_v2`; never overwrite a render. Then run `npm run art -- credit`.
6. **Clean, preview, audit:** `npm run art -- build`. Fix the `names` order if `clean` reports a count mismatch, and add `post` fixes. Keep or fill holes by seed (see `holes -v`).
7. **Animate in code** (characters): a script in `scripts/art/characters/` composes frames from the master and the key poses, adding IK limbs, breathing, blinks and effects, and writes `<root>/frames/`. Hand fixes are pixel-text patches in that script.
8. **Export** to TypeScript and wire the module into the renderer, in the art pass that owns that area.
9. **Commit** the prompt, sidecar, grid, sprites, frames, manifest, exported module and CREDITS.md together.

## Conventions

- **Grid:** Gemini (`google/gemini-3.1-flash-image`, at 2K 16:9 = 2752×1536) draws on a grid about 240 cells wide at any size. So templates are drawn at 1 cell = 1 art pixel on a 240×135 grid and upscaled nearest-neighbour by 2752/240 ≈ 11.47. A render cleans at that pitch.
- **Backgrounds:** use flat white for sprites (flood-filled away), `"background": "green"` for pure #00FF00 chroma keying (ask for a 2–3 px white buffer around each sprite), and `"background": "none"` for opaque scenes.
- **One character per sheet**, 3–4 copies in a row. The extra copies are free extra samples: pick the best.
- **Names:** sprites are named in reading order (rows by bottom edge, then left to right). `null` skips a size anchor or a reject.
- **Canvases:** `char` sheets put each sprite on a fixed `canvas` with the soles on row `feet` and the torso (or its template slot, `slots`) on column `cx`. `icon` sheets centre on a fixed `canvas`.
- **Palette classes** (`palette.py`): `character` (no sky, glass, neon or foliage ramps), `enemy` (no sky or foliage), `prop` (no sky), `icon` and `scene` (everything). A `sprite` sheet defaults to `prop`, so an Enemy sheet sets `"palette": "enemy"`. A sheet may instead give `{"ramps": [...]}` or `{"colors": [...]}`. The prototype pins its 26 original colours.
- **Facing:** draw facing right. Facing left is a mirror, plus code that moves asymmetric details. Rexi's sleeve is on his **right** arm, so facing right it is on the far (aiming) arm, and facing left on the near arm (`characters/rexi_common.py`, `TATTOO_SIDE`).
- **Money:** one image per call. `gen` refuses any call that would pass the $10 cap (`ledger.py` has the per-model estimates). Every render gets a new name, so the record stays complete.

## Manifest (`sheets.json`)

```jsonc
{
  "templates": {
    "rexi_x4": { "type": "editsheet", "sprite": "sprites/rexi/master.png", "n": 4 },
    "rexi_master_lineup": {
      "type": "lineup",
      "anchor": "…",
      "draft": "templates/rexi_draft_1x.png",
      "n": 3,
      "height": 64,
    },
    "enemy_slots": {
      "type": "slotsheet",
      "anchor": "sprites/rexi/master.png",
      "n": 3,
      "box": [48, 36],
      "ground": null,
    },
    "icon_cells": { "type": "icongrid", "n": 11, "cell": 16, "anchor": "sprites/icons/mazo.png" },
    "pose_run": {
      "type": "poseguide",
      "poses": [
        {
          "head": [3, 42],
          "neck": [2, 47],
          "hip": [0, 71],
          "kneeN": [7, 84],
          "footN": [13, 99],
          "kneeF": [-4, 85],
          "footF": [-12, 96],
          "twotone": true,
        },
      ],
    },
    "arena_draft": {
      "type": "draft",
      "image": "../reference/arena.png",
      "size": [640, 360],
      "palette": "scene",
    },
    "arena_tiles": {
      "type": "scene_tiles",
      "draft": "templates/arena_draft_1x.png",
      "step": [200, 113],
    },
  },
  "sheets": {
    "rexi_keys_run": {
      "kind": "char", // sprite | char | icon | scene
      "prompt": "prompts/rexi_keys_run.txt",
      "style": true,
      "refs": ["templates/rexi_x4.png", "templates/pose_run.png"],
      "palette": "character", // or {"ramps": [...]} / {"colors": [...]}
      "names": ["rexi/run_contact", "rexi/run_down", null, "rexi/run_pass"],
      "canvas": [48, 72],
      "feet": 69,
      "cx": 22,
      "slots": 4,
      "headlock": { "master": "sprites/rexi/master.png", "cut": 20 },
      "fill_holes": true,
      "keep_white": true,
      "post": {
        "rexi/run_pass": {
          "shorten": 2,
          "recolor": { "#000000": "#1e1834" },
          "holes": { "keep": [[10, 40]] },
        },
      },
    },
    "arena": {
      "kind": "scene",
      "background": "none",
      "tiles": [["arena_r0c0", "arena_r0c1", "arena_r0c2"], ["…"]],
      "tile_step": [200, 113],
      "crop": [0, 0, 640, 360], // or "fit": [640, 360] for a single render
      "layers": {
        "sky": { "ramps": ["sky"] },
        "far": { "sheet": "arena_far" },
        "ground": { "rows": [290, 360] },
        "props": { "mask": "masks/arena_props.png" },
      },
    },
  },
  "parts": {
    "rexi_arm": {
      "src": "sprites/rexi/arm.png",
      "pivot": [5, 7],
      "angles": { "from": -90, "to": 90, "step": 22.5 },
    },
  },
  "exports": {
    "rexi": {
      "sprites": ["frames/**/*.png"],
      "format": "rle",
      "out": "src/render/art/generated",
      "data": { "anims": "frames/anim.json", "armPivots": "parts/rexi_arm/pivots.json" },
    },
    "icons": {
      "sprites": ["sprites/icons/*.png"],
      "format": "rows",
      "out": "src/render/art/generated",
    },
  },
  "audit": { "frames/**/*.png": "character" },
}
```

Other sheet options: `pitch` (skip detection), `min_px`, `row_gap`, `col_gap` and `row_tol` (slicer), `recolor` (sheet-wide), `seal` (canvas sides that are a crop line). Keys starting with `_` are ignored.

## Cleaning

`clean.py`, built on `pixelize.py`, which is manus-garden's method unchanged:

1. Pitch and phase from the edge-energy comb (the 240-cell prior first).
2. The median of each cell's centre.
3. Background keyed out.
4. Pale guide and halo cells dropped. A pure-white cell is kept only if `keep_white`, and a dropped one keeps its colour for the hole fill.
5. CIELAB nearest-colour snap to the sheet's palette class.
6. Lone pixels removed, then recursive XY-cut slicing.

The grid is cached in `grid/` before snapping, so a palette change re-snaps for free.

**Scenes and layers.** A scene is one opaque picture: one render (`fit` resamples it exactly to the target size by majority vote, adding no new colours), or `tiles` reassembled every `tile_step` cells with the seam in the middle of each overlap. `layers` then cut it into parallax layers. A layer can combine:

- `sheet`: take the pixels from another scene entry, e.g. an edit that removed the foreground and filled in behind it;
- `rows`: `[y0, y1)`;
- `mask`: a PNG whose opaque pixels are kept;
- `ramps` / `colors`: keep only those colours.

Outputs are `<name>.png` and `<name>_<layer>.png`.

## Parts

`bake.py` writes `parts/<name>/<angle>.png` and `pivots.json`, which records where the pivot landed in each rotated sprite. RotSprite (`rotsprite.py`) does Scale2x three times, a nearest rotation at 8×, then a mode downsample, so no new colours appear. Angles turn from the nearest multiple of 90°, which is an exact `rot90`. The game mirrors the set for the other facing: 9 angles give 16 directions.

## Animation in code

`ik.py` has the two-bone IK solver and the limb rasteriser (a width profile per joint, 3-band ramp shading lit from the upper left, a 1 px outline). A character script reuses the master's head, torso and clothes pixel for pixel. It takes the lower body from pose-edited keys placed by their template slot and head match, or draws IK limbs, then adds breathing, blinks, recoil and effects. Rexi's prototype rig (`characters/rexi_rig.py`) is the worked example:

- 64 px Rexi, 120×100 frames with the soles on row 89;
- idle 8, run 6, run-back 6, jump 4, hurt 4, shoot 4 and aim 16 frames;
- the aiming arm pre-rotated into 9 angles and mirrored.

## Export

`export_ts.py` writes one module per `exports` entry. The sprites are keyed by their path relative to the matched files' common folder (`'idle/00'`):

```ts
// format "rows": readable, for small sprites and icons (codes: pixtext.py)
const K = { k: P.outline, c: P.skin3 /* … */ };
export const sprites = { mazo: defineSprite(K, ['..kk..' /* … */]) } satisfies Record<
  string,
  SpriteDef
>;
// format "rle": compact, for frames and scene layers (decoder: src/render/sprite-data.ts)
export const sprites = {
  'idle/00': decodeSprite({ width: 120, height: 100, colors: ['outline' /* … */], data: '…' }),
} satisfies Record<string, SpriteDef>;
export const anims = {/* frames/anim.json */} as const;
```

The run-length format is byte pairs `(palette index, run length − 1)`, row-major, in base64, where index 0 is transparent. `tests/render/sprite-data.test.ts` decodes a fixture written by this exporter (`tests/fixtures/art/rexi-idle.json`), so Python and TypeScript cannot drift. An export refuses partial alpha and off-palette colours.

## Audit

`audit.py` checks every sheet output, baked part and `audit` glob:

- **Errors:** partial alpha, a colour not in `src/render/palette.ts`, a colour outside the asset's class.
- **Warnings:** lone pixels, and a weak outline (under 70% of the silhouette edge is dark ink; scenes are exempt).

It also lists the palette colours used. The renderer side has its own check in `tests/render/palette.test.ts`.

## The version C prototype (`reference/manu-pipeline/`)

The prototype's six sheets are in its `sheets.json`. `npm run art -- clean --root reference/manu-pipeline` rebuilds `clean/` byte for byte from `grid/`, and `npm run art:test` asserts it. Then:

```sh
uv run -q --with pillow --with numpy python scripts/art/characters/rexi_master.py   # hand pass -> master_side.png
uv run -q --with pillow --with numpy python scripts/art/characters/rexi_export.py   # frames/, parts/, build/rexi-c-sheet.png
npm run art -- preview --root reference/manu-pipeline
npm run art -- audit --root reference/manu-pipeline
```

`characters/rexi_templates.py` holds the prototype's own templates and pose guides, which the generic builders in `templates.py` grew out of.

**Sleeve correction (#31).** The prototype was drawn with the sleeve on the near arm, which is his left arm facing right. The rig now follows CONTEXT.md:

- Facing right, the near arm is plain (`detattoo`), and the aiming arm, his right arm, wears a continuous lion-to-courthouse sleeve in pixel text.
- Facing left, the mirrored near arm (now his right) keeps the master's sleeve.
- The hurt keys' own near arm is detattooed too.

The prompt files describe the right-arm sleeve. The sidecars keep each prompt as it was sent. The aiming arm also gained its missing 1 px outline (found by the audit).

### Lessons (on top of manus-garden's)

- **Flash does not keep the 240-cell grid on its own.** With a lone figure, it drew a 128 px Rexi on a 480-cell grid, then a 98 px one on the right grid. A lineup held both the grid and the height: Manu (78 px, on the 240 grid, copied to `work/`) as the density anchor, three draft copies, and head-top and ground lines.
- **Do not pass a whole character sheet to an edit:** it redraws the sheet. A crop of the one view you need works.
- **"Raise the near arm" raised the far arm.** Name arms as the character's left and right, plus near and far, in every prompt.
- **The model drew the stretched air poses' legs 10–15 px too long.** Deleting the most redundant trouser rows (`shorten`) fixes this without resampling.
- **The robe snapped to outline black.** The hand pass moves its inside to `night`. With the 56-colour palette, `robeMid` gives the folds a step of their own.

## Files

| File                                  | Role                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `art.py`                              | The CLI.                                                                                                |
| `project.py`                          | Art roots, the manifest and its validation, Prettier-compatible JSON output.                            |
| `palette.py`                          | The master palette and ramps, read from `src/render/palette.ts`, and the palette classes.               |
| `ledger.py`, `gen.py`                 | Budget, ledger and CREDITS.md folding; one generation under the cap.                                    |
| `templates.py`, `template_specs.py`   | Template builders and the manifest's `templates` section.                                               |
| `pixelize.py`, `clean.py`, `holes.py` | Grid reconstruction, palette snap, slicing, scenes, hole fill.                                          |
| `rotsprite.py`, `bake.py`             | RotSprite and the parts bake.                                                                           |
| `ik.py`                               | Two-bone IK and outlined, ramp-shaded limbs.                                                            |
| `export_ts.py`                        | The TypeScript export (rows and RLE).                                                                   |
| `preview.py`, `audit.py`              | Contact sheets; palette and pixel-rule lint.                                                            |
| `pixtext.py`, `reduce.py`             | Pixel text (one fixed code per colour); exact 2:1 reduction.                                            |
| `characters/`                         | Rexi's prototype: shared setup, templates, hand pass, rig and exports.                                  |
| `tests/`                              | pytest: ledger and cap, grid recovery, snap, fit, RotSprite, IK, audit, export, prototype reproduction. |
