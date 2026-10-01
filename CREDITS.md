# Credits and asset provenance

Generated media for Rexi's Revenge. The images in `reference/` were made as concept references for the sprites drawn in code ([ADR 0001](docs/adr/0001-gameplay-art-drawn-in-code.md), now superseded by [ADR 0002](docs/adr/0002-pixel-art-rules-and-pipeline.md): game art is generated through `scripts/art/`, see "Art pipeline" below). They are kept out of the production bundle. The only generated image that ships is `public/title.png` (also inside the link preview `public/og-image.png`, composed in code). The logo and the site icons are drawn in code.

All images were generated through OpenRouter with the creation-tool, using the default model `google/gemini-3.1-flash-image` (1376×768, 16:9, pixel-art style prompts). Each file in `reference/` has a JSON sidecar next to it with the full prompt, model, parameters and cost.

## Images

| File                                        | Model                         | Prompt summary                                                                                                                                                                                                                                           | Cost (USD) |
| ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `reference/rexi-character-sheet-v1.png`     | google/gemini-3.1-flash-image | Rexi turnaround (front, side, back), torn-sleeve robe over a tank top, light-brown hair, lion and courthouse tattoo on the left arm, tattoo and face-portrait insets (superseded)                                                                        | 0.0673     |
| `reference/enemy-maletin-coptero.png`       | google/gemini-3.1-flash-image | Briefcase helicopter with a tiny lawyer pilot, paper-sheet projectiles                                                                                                                                                                                   | 0.0673     |
| `reference/enemy-archivador-artillado.png`  | google/gemini-3.1-flash-image | Armored flying filing cabinet with jets, drops drawer bombs                                                                                                                                                                                              | 0.0673     |
| `reference/enemy-caminadora-a-reaccion.png` | google/gemini-3.1-flash-image | Jet-powered treadmill with a machine gun, red and black gym colors                                                                                                                                                                                       | 0.0673     |
| `reference/enemy-banca-artillada.png`       | google/gemini-3.1-flash-image | Bench-press gunship with twin rotors, barbell and rocket pods                                                                                                                                                                                            | 0.0673     |
| `reference/arena.png`                       | google/gemini-3.1-flash-image | Sunset plaza, courthouse and B&P tower (its "JUEVES 2×1" billboard is reference only; in-game it is Boissons' cocktail promo)                                                                                                                            | 0.0673     |
| `reference/icons-weapons-powerups.png`      | google/gemini-3.1-flash-image | Labeled icon sheet: 6 Weapons and 5 Power-ups                                                                                                                                                                                                            | 0.0673     |
| `reference/title-source-v1.png`             | google/gemini-3.1-flash-image | Rexi heroic pose with gavel, sunset plaza, empty upper-left sky for the logo; the character sheet was passed as a Reference image for consistency (superseded)                                                                                           | 0.0679     |
| `reference/rexi-character-sheet.png`        | google/gemini-3.1-flash-image | Sleeve correction: edit of `rexi-character-sheet-v1.png` changing only the tattoo to a left-arm sleeve, shoulder to elbow, lion head and courthouse woven together. Second attempt; the back view's right arm was pasted back bare from v1 (see sidecar) | 0.0679     |
| (discarded)                                 | google/gemini-3.1-flash-image | First sleeve attempt of the character sheet: ink on both arms in the back view and past the elbow                                                                                                                                                        | 0.0679     |
| `reference/title-source.png`                | google/gemini-3.1-flash-image | Sleeve correction: edit of `title-source-v1.png` with the new character sheet as a second Reference, changing only the tattoo to a shoulder-to-elbow sleeve                                                                                              | 0.0684     |
| (discarded)                                 | google/gemini-3.1-flash-image | Title sleeve edit made before the character sheet was corrected (referenced the old sheet); superseded by the one above, not inspected for use                                                                                                           | 0.0684     |
| `public/title.png`                          | (derived)                     | `title-source.png` center-cropped to 16:9 and downscaled to 640×360 (high-quality smoothing, `@napi-rs/canvas`); no extra generation                                                                                                                     | 0.0000     |
| `public/og-image.png`                       | (derived)                     | `public/title.png` with the code-drawn logo and tagline over it, scaled 2× nearest-neighbor by `npm run share-preview`; no extra generation                                                                                                              | 0.0000     |

The first eight images met their brief on the first attempt. The sleeve correction (left-arm tattoo as a shoulder-to-elbow sleeve) regenerated the character sheet and the title source; the earlier versions are kept as `*-v1.png`.

**Sleeve side corrected later (owner, #31):** Rexi's sleeve is on his **right** arm, one continuous piece (a lion head whose mane flows into a columned courthouse; CONTEXT.md). The rows above describe what was asked at the time, so they still say left arm, and the character sheet and title images show it on the left. They stay as concept references; the pipeline's prompts and Rexi's rig use the right arm.

## Music

Generated through OpenRouter with the creation-tool and the default music model `google/lyria-3-clip-preview` (30.8 s clips, MP3 44.1 kHz stereo). Both raw clips and their JSON sidecars (full prompt, model, cost) are in `reference/audio/`, outside the bundle. The prompts asked for an instrumental, comedic 80s workout synth-rock track with a chiptune square-wave lead at a steady 140 BPM, so the loop could be cut on bars.

| File                                    | Model                       | Notes                                                                                                                                                                                         | Cost (USD) |
| --------------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `reference/audio/music-candidate-1.mp3` | google/lyria-3-clip-preview | Candidate 1: 140.0 BPM, RMS -14.3 dBFS, steady level; best 16-bar seam score 0.78 (100 ms window). Not used                                                                                   | 0.04       |
| `reference/audio/music-candidate-2.mp3` | google/lyria-3-clip-preview | Candidate 2: 140.0 BPM, RMS -14.3 dBFS, steady level, no intro or ending; best 16-bar seam score 0.88. **Used**                                                                               | 0.04       |
| `public/music/theme.mp3`                | (derived)                   | 16 bars (27.43 s) of candidate 2 from 0.366 s, 30 ms equal-power seam crossfade, 0.5 s wrap-around padding, peak -1 dBFS, LAME VBR q4 (~140 kbps) via `scripts/music-loop/make-music-loop.ts` | 0.0000     |

## Rexi version C prototype (manus-garden pipeline)

Sprite sources for the version C comparison (Refs #9), made with the pipeline in `scripts/art/` (see its README). Every call used `google/gemini-3.1-flash-image` at 2K (2752×1536, 16:9) and edited a template on the model's 240-cell grid. Raw renders, their JSON sidecars (full prompt, references, cost) and the prompts are in `reference/manu-pipeline/`. The sidecars keep each prompt exactly as sent; the prompt files were later corrected for the right-arm sleeve (#31), so a re-run asks for the right design. These are concept sources outside the bundle; nothing here ships. Version C cap: **$1.50**.

| #   | File (`reference/manu-pipeline/raw/`) | What it asked for                                                                                | Result                                                                                   | Cost (USD) | C total |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------- | ------- |
| 1   | `master_side_v1.png`                  | Redraw the 64 px draft (the sheet's side view, downscaled) in place                              | Drawn on a 480-cell grid: 128 px tall. Discarded (kept as the source of the 64 px draft) | 0.1027     | 0.1027  |
| 2   | `master_side_v2.png`                  | Same, with Manu (manus-garden) as a pixel-density anchor                                         | Right grid, but 98 px tall. Discarded                                                    | 0.1027     | 0.2053  |
| 3   | `master_side_v3.png`                  | Same on a coarser 160-cell grid, character sheet as reference 2                                  | Redrew the whole character sheet instead. Discarded                                      | 0.1027     | 0.3080  |
| 4   | `master_side_v4.png`                  | Lineup: Manu + 3 copies of the draft with head-top and ground lines, side-view crop as reference | 64–65 px, ¾ body. Copy b is the master's body                                            | 0.1027     | 0.4107  |
| 5   | `keys_v1.png`                         | 4 master copies + pose guide: run contact, run passing, jump, hurt                               | All four used                                                                            | 0.1021     | 0.5128  |
| 6   | `arm_v1.png`                          | 2 master copies with the arm straight out                                                        | Raised the far arm (no tattoo): used as the aiming arm, tattoo added in code             | 0.1015     | 0.6143  |
| 7   | `keys_run_b.png`                      | Rest of the run: down, contact (other side), down (other side), passing (other side)             | First three used; the passing came back with straight legs                               | 0.1028     | 0.7171  |
| 8   | `keys_air.png`                        | Jump rise, fall, landing squat, hard hurt                                                        | All four used; rise and fall legs drawn too long, shortened in code                      | 0.1027     | 0.8198  |
| 9   | `master_34_v5.png`                    | Owner feedback: turn head and chest toward the camera (Metal Slug ¾), both eyes, toothy grin     | Copy b's head is the master's head                                                       | 0.1021     | 0.9219  |

Version C total: **0.9219 of 1.50**. All later steps (grid cleanup, palette snap, hand pass, rig, RotSprite, exports) are code and cost nothing.

## Art pipeline

Generations made with `scripts/art` (see its README), folded in from `art/ledger.tsv` by `npm run art -- credit`. Raw renders and their JSON sidecars are in each art root's `raw/`.

<!-- art-ledger:start -->

| #   | Time                | Root  | Name               | Model                         | Cost (USD) | Note |
| --- | ------------------- | ----- | ------------------ | ----------------------------- | ---------- | ---- |
| 1   | 2026-10-01T13:23:25 | `art` | `enemy_maletin`    | google/gemini-3.1-flash-image | 0.1022     |      |
| 2   | 2026-10-01T13:23:55 | `art` | `enemy_archivador` | google/gemini-3.1-flash-image | 0.1022     |      |
| 3   | 2026-10-01T13:24:15 | `art` | `enemy_caminadora` | google/gemini-3.1-flash-image | 0.1022     |      |
| 4   | 2026-10-01T13:24:37 | `art` | `enemy_banca`      | google/gemini-3.1-flash-image | 0.1022     |      |
| 5   | 2026-10-01T13:25:05 | `art` | `projectiles`      | google/gemini-3.1-flash-image | 0.1017     |      |
| 6   | 2026-10-01T13:25:33 | `art` | `enemy_banca_v2`   | google/gemini-3.1-flash-image | 0.1023     |      |
| 7   | 2026-10-01T13:27:12 | `art` | `enemy_banca_v3`   | google/gemini-3.1-flash-image | 0.1023     |      |
| 8   | 2026-10-01T13:27:34 | `art` | `projectiles_v2`   | google/gemini-3.1-flash-image | 0.1017     |      |

<!-- art-ledger:end -->

## Budget

Shared cap for all generated media (images + music): **$10.00** (raised from $5.00 by the owner)

| Item                                  | Cost (USD)                             |
| ------------------------------------- | -------------------------------------- |
| Images (12 generations)               | 0.8115                                 |
| Music (2 generations)                 | 0.0800                                 |
| Rexi version C images (9 generations) | 0.9219                                 |
| Art pipeline (8 generations)          | 0.8169                                 |
| **Running total**                     | **2.6303 of 10.00** (7.3697 remaining) |

The image subtotal is summed from the unrounded costs in the JSON sidecars (and the post-processing note for the discarded sheet attempt), so it can differ by $0.0001 from the sum of the rounded table rows.
