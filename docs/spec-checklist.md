# Spec checklist

Every user story in the v1 spec ([#1](https://github.com/feauazmu/Rexi-s-Revenge/issues/1)),
checked against the code and tests at the end of the art pass (#30). **Done** means the story
is implemented and a test covers it. **Done, amended** means it is implemented as a later owner
decision changed it (listed under "Amendments"). **Deferred** means it is knowingly left out
of v1.

Result: 89 of 90 stories are done (four as amended). One part of one story is deferred: the
dev-sandbox page in story 86.

Tests are named by file: `core/…`, `golden/…`, `render/…`, `platform/…`, `content/…` and
`scripts/…` live in `tests/`, and `e2e/…` holds the Playwright smoke tests against the
production build.

## Amendments since the spec

- **Resolution 640×360**, not 480×270 ([ADR 0002](adr/0002-pixel-art-rules-and-pipeline.md),
  #24, #32). Spatial tuning was scaled by 4/3 (see "Resolution history" in
  [architecture.md](architecture.md)).
- **Generated pixel art through a pipeline** ([ADR 0002](adr/0002-pixel-art-rules-and-pipeline.md)
  supersedes ADR 0001). Sprites are still palette-indexed data drawn by the deterministic
  renderer, and the title illustration is still the one decoded image.
- **The "JUEVES 2×1" promo** belongs to the Boissons cocktail bar on the plaza, and the
  Bufete & Pesas S.A. tower carries a gym billboard instead (owner comment on #1).
- **Rexi's tattoo** is one continuous shoulder-to-elbow sleeve on his **right** arm (owner
  comment on #1, then #26; see CONTEXT.md).
- **Budget** raised from $5 to $10 (owner comment on #1). Spent so far: $4.8732 (CREDITS.md).

## Starting and flow

| #   | Story                                                 | Status | Where                                                                 | Verified by                                                                                           |
| --- | ----------------------------------------------------- | ------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | One URL, nothing to install                           | Done   | Vite build deployed to GitHub Pages (`ci.yml`)                        | `e2e/smoke` (boots the production build)                                                              |
| 2   | Title with the logo and an illustration of Rexi       | Done   | `render/screens/title.ts`, `render/brand/logo.ts`, `public/title.png` | `golden/screens` (`title`, `title-logo-drop`), `e2e/smoke`                                            |
| 3   | Title shows the local top 10                          | Done   | `render/screens/high-scores.ts`                                       | `golden/screens` (`title-high-scores`)                                                                |
| 4   | Start prompt by device                                | Done   | `strings.titleScreen`                                                 | `golden/screens` (`title`, `title-touch`)                                                             |
| 5   | "Cómo jugar" before the first Run, controls by device | Done   | `render/screens/how-to-play.ts`, `core/game.ts`                       | `core/screens`, `golden/screens` (desktop, touch)                                                     |
| 6   | "Cómo jugar" skipped once seen                        | Done   | `core/preferences.ts`                                                 | `core/screens`, `e2e/smoke`                                                                           |
| 7   | Credits line on the Title                             | Done   | `strings.titleScreen.credits`                                         | `golden/screens`                                                                                      |
| 8   | Pause with Esc/P or an on-screen button               | Done   | `platform/keyboard-mouse.ts`, touch pause button                      | `core/screens`, `platform/keyboard-mouse`, `e2e/smoke`, `e2e/touch`                                   |
| 9   | Pause menu: Continuar, Silenciar música, Salir        | Done   | `core/pause-menu.ts`, `render/screens/pause-menu.ts`                  | `core/screens`, `golden/screens` (`pause-menu`), `e2e/smoke`                                          |
| 10  | Auto-pause on blur or a hidden tab                    | Done   | `platform/shell.ts`                                                   | `e2e/smoke`                                                                                           |
| 11  | Veredicto with score, demandas desestimadas, time     | Done   | `core/verdict.ts`, `render/screens/verdict.ts`                        | `core/verdict`, `golden/screens` (`verdict-*`, `defeat-beat`), `e2e/*` (whole Run)                    |
| 12  | Three initials for a top-10 Run, keyboard or touch    | Done   | `core/verdict.ts` (menu input only)                                   | `core/verdict`, `golden/screens`, `golden/touch` (`verdict-initials-touch`), `e2e/smoke`, `e2e/touch` |
| 13  | Back to the Title and a new Run quickly               | Done   | `core/game.ts`                                                        | `core/screens`, `e2e/*` (whole Run)                                                                   |

## Moving and shooting

| #   | Story                                     | Status | Where                                                         | Verified by                                           |
| --- | ----------------------------------------- | ------ | ------------------------------------------------------------- | ----------------------------------------------------- |
| 14  | Move with A/D or the arrows               | Done   | `platform/keyboard-mouse.ts`, `core/run/rexi.ts`              | `platform/keyboard-mouse`, `core/movement`            |
| 15  | Jump with W, Up or Space                  | Done   | same                                                          | `platform/keyboard-mouse`, `core/movement`            |
| 16  | Aim in 360° with the mouse                | Done   | screen → game mapping in `platform/keyboard-mouse.ts`         | `platform/keyboard-mouse`, `golden/rexi` (`rexi-aim`) |
| 17  | Hold the left button to fire              | Done   | `core/run/weapons/`                                           | `core/combat`, `e2e/smoke`                            |
| 18  | Switch Weapons with Q/E, the wheel or 1–6 | Done   | `platform/keyboard-mouse.ts`, `core/run/weapons/inventory.ts` | `platform/keyboard-mouse`, `core/inventory`           |
| 19  | Left virtual stick moves                  | Done   | `platform/touch/controller.ts`, `stick.ts`                    | `platform/touch-controller`, `platform/stick`         |
| 20  | Dedicated jump button                     | Done   | same, `render/touch/layout.ts`                                | `platform/touch-controller`, `golden/touch`           |
| 21  | Right stick aims and fires while held     | Done   | same                                                          | `platform/touch-controller`, `e2e/touch` (whole Run)  |
| 22  | Tap the Weapon icon to cycle              | Done   | same                                                          | `platform/touch-controller`                           |
| 23  | "Gira tu teléfono" in portrait            | Done   | `render/touch/rotate-prompt.ts`, `platform/shell.ts`          | `golden/touch` (`rotate-prompt*`), `e2e/touch`        |
| 24  | Arm and Weapon point where I aim          | Done   | `render/rexi/arm.ts` (16 directions, RotSprite)               | `render/rexi-arm`, `golden/rexi`                      |
| 25  | Idle, run, jump and hurt animations       | Done   | `render/rexi/pose.ts`                                         | `render/rexi-art`, `golden/rexi`                      |
| 26  | Ground floor and a few platforms          | Done   | `tuning.arena.platforms`, one-way physics                     | `core/platforms`, `golden/run` (`arena-platform`)     |

## Weapons and Crates

| #   | Story                                            | Status | Where                                          | Verified by                                                     |
| --- | ------------------------------------------------ | ------ | ---------------------------------------------- | --------------------------------------------------------------- |
| 27  | Mazo Automático, default and unlimited           | Done   | `core/run/weapons/`, `DEFAULT_WEAPON`          | `core/inventory`, `golden/run` (`run-firing`)                   |
| 28  | Lluvia de Sellos, short-range spread             | Done   | `core/run/weapons/lluvia-de-sellos.ts`         | `core/lluvia-de-sellos`                                         |
| 29  | Mancuernas, lobbed, bounce and explode           | Done   | `core/run/weapons/mancuernas.ts`               | `core/mancuernas`, `golden/explosive-weapons`                   |
| 30  | Código Penal, rocket with splash                 | Done   | `core/run/weapons/codigo-penal.ts`             | `core/codigo-penal`, `golden/explosive-weapons`                 |
| 31  | Citaciones Teledirigidas, homing                 | Done   | `core/run/weapons/citaciones-teledirigidas.ts` | `core/citaciones-teledirigidas`, `golden/precision-weapons`     |
| 32  | Sentencia Firme, piercing instant beam           | Done   | `core/run/weapons/sentencia-firme.ts`          | `core/sentencia-firme`, `golden/precision-weapons`              |
| 33  | Crates fall periodically                         | Done   | `core/run/crates/system.ts`                    | `core/crates`, `golden/run` (`crate-falling`)                   |
| 34  | Pick up a Crate by touching it                   | Done   | same                                           | `core/crates`                                                   |
| 35  | Crates blink before disappearing                 | Done   | same, `render/layers/crates.ts`                | `core/crates`, `golden/run` (`crate-blinking`)                  |
| 36  | Weapon added to the inventory, or ammo topped up | Done   | `core/run/weapons/inventory.ts`                | `core/inventory`                                                |
| 37  | Back to the Mazo when ammo runs out              | Done   | same                                           | `core/inventory`                                                |
| 38  | HUD shows the Weapon icon and ammo               | Done   | `render/hud/`                                  | `golden/run` (`run-hud`, `run-hud-sellos`), `render/ui-palette` |

## Power-ups

| #   | Story                                                | Status | Where                                                   | Verified by                                          |
| --- | ---------------------------------------------------- | ------ | ------------------------------------------------------- | ---------------------------------------------------- |
| 39  | Pre-entreno slows Enemies and their shots, not Rexi  | Done   | `core/run/power-ups/pre-entreno.ts`                     | `core/power-ups`, `golden/run` (`run-pre-entreno`)   |
| 40  | Receso restores health                               | Done   | `core/run/power-ups/receso.ts`                          | `core/power-ups`                                     |
| 41  | Inmunidad Judicial, invulnerable with a clear effect | Done   | `inmunidad-judicial.ts`, `render/layers/rexi.ts`        | `core/power-ups`, `golden/run` (`run-power-ups`)     |
| 42  | Día de Pierna, a jetpack boost                       | Done   | `dia-de-pierna.ts`, `render/layers/power-up-effects.ts` | `core/power-ups`, `golden/run` (`run-dia-de-pierna`) |
| 43  | Creatina triples damage                              | Done   | `creatina.ts` (`rexiDamageMultiplier`)                  | `core/power-ups`                                     |
| 44  | Timed Power-ups show their time in the HUD           | Done   | `render/hud/`                                           | `golden/run` (`run-power-ups`)                       |

## Enemies and difficulty

| #   | Story                                                   | Status | Where                                           | Verified by                                                                         |
| --- | ------------------------------------------------------- | ------ | ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| 45  | Maletín-cóptero, the common light Enemy shooting papers | Done   | `core/run/enemies/maletin-coptero.ts`           | `core/maletin-coptero`, `golden/run` (`enemy-maletin-coptero`)                      |
| 46  | Archivador Artillado drops drawer bombs                 | Done   | `archivador-artillado.ts`                       | `core/archivador-artillado`, `golden/run`                                           |
| 47  | Caminadora a Reacción strafes with bursts               | Done   | `caminadora-a-reaccion.ts`                      | `core/caminadora-a-reaccion`, `golden/run`                                          |
| 48  | Banca Artillada, tanky, rocket volleys                  | Done   | `banca-artillada.ts`                            | `core/banca-artillada`, `golden/run` (`banca-windup`, `banca-volley`)               |
| 49  | Distinct silhouette, colors and movement per Enemy      | Done   | pipeline sprites (`render/enemies/`), behaviors | `render/enemy-art`, `golden/run` (one per kind)                                     |
| 50  | Enemies break apart with debris                         | Done   | `core/run/effects/`, `render/effects/`          | `core/effects`, `golden/effects`                                                    |
| 51  | Enemies flash when hit                                  | Done   | `silhouetteContext` in `render/enemies/`        | `core/effects`, `golden/effects` (`effects-hit-flash`)                              |
| 52  | Only Maletín-cópteros in the first minute               | Done   | `tuning.director` roster                        | `core/director`                                                                     |
| 53  | New kinds over time, rising cap and fire rate           | Done   | `tuning.director` stages and growth             | `core/director`, `scripts/balance` (`npm run balance`)                              |
| 54  | Enemy shots clearly visible and dodgeable               | Done   | `render/projectiles/`; balance pass (#30)       | `golden/run`, `core/enemy-fire`; simulated play in `docs/architecture.md` "Balance" |
| 55  | Brief invulnerability and a hurt animation              | Done   | `core/run/rexi.ts`, `render/rexi/pose.ts`       | `core/rexi`, `golden/rexi` (`rexi-hurt`), `golden/run` (`run-hurt`)                 |

## Quips and the Dialogue Box

| #   | Story                                                 | Status | Where                                  | Verified by                                      |
| --- | ----------------------------------------------------- | ------ | -------------------------------------- | ------------------------------------------------ |
| 56  | Rexi sometimes says a Quip on a kill                  | Done   | `core/quips/director.ts`               | `core/quip-director`, `core/quips`               |
| 57  | Pokémon-style box with portrait and name              | Done   | `render/dialogue/`                     | `golden/dialogue`, `render/dialogue`             |
| 58  | Typewriter text with a blip                           | Done   | director reveal, `dialogue-blip` sound | `core/quip-director`, `platform/audio/sound-map` |
| 59  | Short Hit-stop when a Quip triggers                   | Done   | `tuning.quips.hitStop`                 | `core/quips`                                     |
| 60  | Play continues; the box closes on its own             | Done   | director linger and close              | `core/quips`, `core/quip-director`               |
| 61  | Not on every kill, never overlapping                  | Done   | chance and cooldown                    | `core/quip-director`                             |
| 62  | A Banca Artillada always gets a Quip                  | Done   | `alwaysQuip: true`                     | `core/quip-director`, `core/quips`               |
| 63  | Legal Quips for Lawyer Craft, gym Quips for Gym Craft | Done   | `THEME_OF_CRAFT`                       | `core/quip-director`                             |
| 64  | No repeats until a theme's pool is used up            | Done   | `ShuffleBag`                           | `core/quip-director`                             |
| 65  | The four inside jokes, with setups                    | Done   | `core/quips/catalog.ts`                | `content/quips`                                  |
| 66  | Every Quip fits in two lines                          | Done   | font metrics                           | `content/quips`                                  |

## Score and high scores

| #   | Story                                | Status | Where                                        | Verified by                                |
| --- | ------------------------------------ | ------ | -------------------------------------------- | ------------------------------------------ |
| 67  | Points per Enemy, heavier worth more | Done   | `tuning.enemies[*].points`                   | `core/hud-stats`                           |
| 68  | HUD shows score, health and time     | Done   | `render/hud/`                                | `core/hud-stats`, `golden/run` (`run-hud`) |
| 69  | Top 10 saved across sessions         | Done   | `core/high-scores.ts`, `platform/storage.ts` | `core/high-scores`, `e2e/*` (whole Run)    |
| 70  | Works with storage blocked           | Done   | `resilientStorage`, in-memory fallback       | `core/high-scores`, `platform/storage`     |

## Audio and presentation

| #   | Story                                                   | Status        | Where                                           | Verified by                                                               |
| --- | ------------------------------------------------------- | ------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| 71  | 80s workout synth-rock loop, no audible seam            | Done          | `public/music/theme.mp3`, `scripts/music-loop/` | `scripts/loop-math`, `platform/audio/music`                               |
| 72  | Music keeps playing through the Veredicto and the Title | Done          | `platform/audio/music.ts` (never stopped)       | `platform/audio/music`, `e2e/smoke`                                       |
| 73  | Punchy synthesized sound effects                        | Done          | `platform/audio/presets.ts`, `sound-map.ts`     | `platform/audio/presets`, `platform/audio/sound-map`                      |
| 74  | Mute from the pause menu, remembered                    | Done          | `core/preferences.ts`, music bus                | `core/screens`, `e2e/smoke`                                               |
| 75  | Audio starts after the first interaction without errors | Done          | `listenForAudioUnlock`                          | `platform/audio/engine`, `e2e/smoke`                                      |
| 76  | Crisp integer scaling with letterboxing                 | Done          | `platform/viewport.ts`                          | `platform/viewport`, `e2e/smoke`                                          |
| 77  | Short screen shake on big explosions                    | Done          | trauma shake, Arena bleed (#30)                 | `core/effects`, `render/arena`, `golden/effects` (`effects-screen-shake`) |
| 78  | The Arena tells the premise at a glance                 | Done, amended | `render/layers/arena.ts`, `arena-signs.ts`      | `render/arena`, every Run golden                                          |
| 79  | Same speed on 60 Hz and high-refresh displays           | Done          | `platform/fixed-step.ts`                        | `platform/fixed-step`                                                     |

## Developer and maintainer

| #   | Story                                                            | Status                         | Where                                                    | Verified by                                         |
| --- | ---------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------- | --------------------------------------------------- |
| 80  | Headless, deterministic core at a fixed timestep with a seed     | Done                           | `src/core/`, ESLint boundaries, `tsconfig.headless.json` | `core/game` (determinism)                           |
| 81  | Typed core events                                                | Done                           | `core/events.ts`                                         | `core/*`, `platform/audio/sound-map`                |
| 82  | Renderer as a pure view → pixels function                        | Done, amended (640×360)        | `src/render/`                                            | `golden/*`                                          |
| 83  | Golden-image tests of key screens and moments                    | Done                           | `tests/golden/`                                          | 61 goldens, all palette-checked (`render/palette`)  |
| 84  | One tuning catalog for every balance number                      | Done                           | `src/core/tuning/`                                       | `core/*`; `scripts/balance` measures it             |
| 85  | Automated Quip catalog checks                                    | Done                           | —                                                        | `content/quips`, `core/quips`                       |
| 86  | Tuning overrides and scripted spawns for tests and a dev sandbox | Done; dev sandbox **deferred** | `GameOverrides` (`core/options.ts`)                      | used across `core/*`, `golden/*`, `scripts/balance` |
| 87  | CI typechecks, lints, tests, builds; main deploys to Pages       | Done                           | `.github/workflows/ci.yml`                               | CI                                                  |
| 88  | Browser smoke test on desktop and emulated mobile                | Done                           | `e2e/`                                                   | `e2e/smoke`, `e2e/touch` (a whole Run on each)      |
| 89  | Reference images in the repo, out of the bundle                  | Done, amended (pipeline art)   | `reference/`, `art/` (outside `src/` and `public/`)      | the build bundles only `src/` and `public/`         |
| 90  | Credits and licensing note with models and total spend           | Done                           | `CREDITS.md`                                             | `content/credits`                                   |

**Deferred: the dev sandbox (story 86).** The core accepts tuning overrides and scripted spawns,
and the tests, goldens and the balance harness all use them. What v1 does not ship is a page or
URL switch that loads those overrides in the browser: only `?seed=N` and `?device=` exist. It
can be added later without touching the core (for example, parse `?tuning=` in
`platform/shell.ts` behind `import.meta.env.DEV`).

## Out of scope (from the spec)

These stay out of v1: bosses and extra Arenas; the Enjambre de Citaciones and the Zeppelin de
Proteína; the Batido de Proteína and Doble Bíceps Weapons; online leaderboards and accounts;
gamepad support; languages other than Spanish; combo or multiplier scoring; settings beyond
muting the music; PWA or offline install.
