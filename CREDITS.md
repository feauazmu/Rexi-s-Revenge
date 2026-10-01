# Credits and asset provenance

Generated media for Rexi's Revenge. Per [ADR 0001](docs/adr/0001-gameplay-art-drawn-in-code.md), the images in `reference/` are concept references for the sprites drawn in code. They are kept out of the production bundle. The only generated image that ships is `public/title.png`.

All images were generated through OpenRouter with the creation-tool, using the default model `google/gemini-3.1-flash-image` (1376×768, 16:9, pixel-art style prompts). Each file in `reference/` has a JSON sidecar next to it with the full prompt, model, parameters and cost.

## Images

| File                                        | Model                         | Prompt summary                                                                                                                                                       | Cost (USD) |
| ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `reference/rexi-character-sheet.png`        | google/gemini-3.1-flash-image | Rexi turnaround (front, side, back), torn-sleeve robe over a tank top, light-brown hair, lion and courthouse tattoo on the left arm, tattoo and face-portrait insets | 0.0673     |
| `reference/enemy-maletin-coptero.png`       | google/gemini-3.1-flash-image | Briefcase helicopter with a tiny lawyer pilot, paper-sheet projectiles                                                                                               | 0.0673     |
| `reference/enemy-archivador-artillado.png`  | google/gemini-3.1-flash-image | Armored flying filing cabinet with jets, drops drawer bombs                                                                                                          | 0.0673     |
| `reference/enemy-caminadora-a-reaccion.png` | google/gemini-3.1-flash-image | Jet-powered treadmill with a machine gun, red and black gym colors                                                                                                   | 0.0673     |
| `reference/enemy-banca-artillada.png`       | google/gemini-3.1-flash-image | Bench-press gunship with twin rotors, barbell and rocket pods                                                                                                        | 0.0673     |
| `reference/arena.png`                       | google/gemini-3.1-flash-image | Sunset plaza, courthouse and B&P tower (its "JUEVES 2×1" billboard is reference only; in-game it is Boissons' cocktail promo)                                        | 0.0673     |
| `reference/icons-weapons-powerups.png`      | google/gemini-3.1-flash-image | Labeled icon sheet: 6 Weapons and 5 Power-ups                                                                                                                        | 0.0673     |
| `reference/title-source.png`                | google/gemini-3.1-flash-image | Rexi heroic pose with gavel, sunset plaza, empty upper-left sky for the logo; the character sheet was passed as a Reference image for consistency                    | 0.0679     |
| `public/title.png`                          | (derived)                     | `title-source.png` center-cropped to 16:9 and downscaled to 480×270 with `sips`; no extra generation                                                                 | 0.0000     |

No image was regenerated. Every first attempt met its brief.

## Budget

Shared cap for all generated media (images + music): **$5.00**

| Item                   | Cost (USD)                            |
| ---------------------- | ------------------------------------- |
| Images (8 generations) | 0.5389                                |
| Music                  | not yet generated                     |
| **Running total**      | **0.5389 of 5.00** (4.4611 remaining) |
