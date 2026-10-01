# Credits and asset provenance

Generated media for Rexi's Revenge. Per [ADR 0001](docs/adr/0001-gameplay-art-drawn-in-code.md), the images in `reference/` are concept references for the sprites drawn in code. They are kept out of the production bundle. The only generated image that ships is `public/title.png`.

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
| `public/title.png`                          | (derived)                     | `title-source.png` center-cropped to 16:9 and downscaled to 480×270 with `sips`; no extra generation                                                                                                                                                     | 0.0000     |

The first eight images met their brief on the first attempt. The sleeve correction (left-arm tattoo as a shoulder-to-elbow sleeve) regenerated the character sheet and the title source; the earlier versions are kept as `*-v1.png`.

## Budget

Shared cap for all generated media (images + music): **$5.00**

| Item                    | Cost (USD)                            |
| ----------------------- | ------------------------------------- |
| Images (12 generations) | 0.8115                                |
| Music                   | not yet generated                     |
| **Running total**       | **0.8115 of 5.00** (4.1885 remaining) |
