---
status: accepted
supersedes: ADR-0001
---

# Pixel-art rules and pipeline

Gameplay art is generated pixel art made through the committed pipeline in `scripts/art/`, and the renderer draws it as palette-indexed sprite data. This supersedes [ADR 0001](0001-gameplay-art-drawn-in-code.md), which had every sprite drawn by hand in TypeScript. The owner compared three versions of Rexi (hand-authored, hybrid, and version C, a port of manus-garden's pipeline) and chose version C for all game art (#9, #24). Hand-coded sprites topped out below the professional bar we want at 640×360. Image models alone drift between frames and draw fake pixels. So these rules keep generated art consistent. They follow manus-garden's ADR 0003, which is the same approach proven on another game, adapted to a side-view arena shooter. The research behind them is in [docs/research/ai-pixel-art-pipelines.md](../research/ai-pixel-art-pipelines.md).

1. **Resolution and scale:** the game renders at **640×360** and is shown at an integer zoom with nearest-neighbour filtering only (2× at 720p, 3× at 1080p). One art pixel is always one game pixel. Nothing is scaled by a non-integer factor, in the game or in the pipeline.
2. **View:** characters are drawn in a **¾ side view** (Metal Slug style): they face right, with the head and chest turned a little toward the camera so both eyes show. They are drawn facing right and mirrored for facing left. Asymmetric details are moved in code so they stay on the correct side, for example Rexi's right-arm sleeve. Rexi is about 64 px tall, and every other sprite is sized against him.
3. **Palette:** one master palette of at most 56 colours (`src/render/palette.ts`), grouped into hue-shifted ramps (`paletteRamps`). Shadows lean purple-blue and highlights lean warm.
   - Every asset snaps to the ramps of its class (`scripts/art/palette.py`). Characters never use the Arena's sky, glass, neon or foliage ramps. Enemies may use neon but not sky or foliage. Props (Crates, plaza furniture, planters) may also use foliage, but not sky. Scenes and icons may use everything.
   - A new colour joins a ramp only when no step works, with a mock-up showing why. The palette grew from 40 to 56 for the art pass: a mid robe step, a warm skin midtone, and extra steel, sky, foliage, fire and neon steps.
4. **Pixels:** a **1 px outline** on characters, Enemies, props and icons. Scene layers are outlined only where a shape meets open sky.
   - No anti-aliasing and no gradients.
   - No partial alpha: every pixel is fully opaque or fully clear. An in-between tone is a checkerboard dither of two ramp steps.
   - No mixels: one pixel size everywhere.
5. **Generation:** never generate a frame freely. A new pose is always an **edit of copies of the master** against a pose guide, with a **size anchor inside the image being edited**. For a master, the anchor is a lineup with a proven sprite and height ticks. For Enemies and props, it is Rexi standing next to empty size boxes.
   - Never pass an oversized draft or a whole character sheet as a reference: the model copies it.
   - A wide scene is drawn as overlapping tiles. Each tile is an edit of the matching crop of a draft at the scene's exact pixel size.
   - Each generation is one image from a committed prompt file and committed templates. It is recorded with a JSON sidecar.
6. **Grid reconstruction:** a render is never used as is. The pipeline recovers its true pixel grid (pitch and phase from the edge-energy comb, cell-centre medians), keys out the background, snaps every cell to the palette in CIELAB and slices the sprites. The resampled grid is committed, so the art rebuilds from a fresh clone without the multi-megabyte renders.
7. **Animation is code.** Every frame reuses the master's pixels for the parts that do not move (head, torso, clothes), so nothing boils between frames.
   - Moving parts come from pose-edited key poses, or are redrawn per frame as **IK limbs** with ramp shading and an outline (`scripts/art/ik.py`).
   - Breathing, blinks, recoil, squash and effects are code.
   - Per-frame fixes are small pixel-text patches in code, so every hand edit is reviewable.
8. **Rotation is pre-baked.** Parts that turn (the aiming arm, spinning projectiles) are rotated offline with RotSprite into fixed angles, for example 9 angles from −90° to 90° mirrored into 16 directions. The game never rotates pixel art at runtime.
9. **Assets are data; the renderer stays deterministic.** The pipeline exports sprites as palette-indexed TypeScript (pixel-text rows, or compact run-length data decoded by `src/render/sprite-data.ts`) that become ordinary `SpriteDef`s. The renderer still only uses `fillRect` and unscaled `drawBitmap` at integer positions. No image files are decoded during gameplay, and output is pixel-identical in browsers and Node. The title illustration stays the one decoded image.
10. **Budget and provenance:** every generation goes through `npm run art -- gen`. It refuses a call that would push spent media past the $10 cap: the CREDITS.md running total, plus ledger rows not yet credited, plus the call's estimate. `npm run art -- credit` folds the ledger into CREDITS.md. Every shipped asset can be traced to its prompt, references, render, grid and code.
11. **Checks:** `npm run art -- audit` rejects partial alpha, off-palette colours and colours outside an asset's class. It also warns on weak outlines and lone pixels. Once the art is remapped, the renderer's golden palette check (`tests/render/palette.test.ts`) covers what reaches the screen.

## Consequences

- The workflow, commands and manifest format are in [`scripts/art/README.md`](../../scripts/art/README.md). The version C prototype stays reproducible as a second art root (`reference/manu-pipeline/`).
- The pipeline needs Python with `uv` (Pillow, NumPy) on the artist's machine. The game build and CI do not, because they consume only the exported TypeScript.
- Until each area is redrawn, the existing code-drawn sprites remain. They predate this ADR and the 56-colour palette.
  - Rexi is pipeline art since #26, wearing the sleeve on his right arm in every facing (facing right it is the near arm, and he aims with the far arm). The reference images `reference/rexi-character-sheet.png` and `reference/title-source.png` (and `public/title.png`) were regenerated with the right-arm sleeve in #26; the earlier versions are kept as `-v1` and `-v2`.
- A hand pass in a pixel editor remains allowed on top of the pipeline's output. It is recorded as pixel-text patches or committed sprite edits, never as untracked changes.
