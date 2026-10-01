# Rexi's Revenge

A comedic pixel-art arena shooter in the style of Heli Attack 3, played in the browser on desktop
and phone. Play it at <https://feauazmu.github.io/Rexi-s-Revenge/>.

Rexi, a very muscular judge, holds the plaza between the courthouse and the tower of
**Bufete & Pesas S.A.**: the crooked lawyers he once sentenced, now allied with a rival gym. Their
flying machines come at him without end. Survive as long as you can, grab the Crates that fall
from the sky, and listen to what Rexi has to say about it. The game speaks Spanish; only the
title stays in English.

## How to play

- **Survive.** Enemies fly in continuously and grow in number and strength with time. Rexi has
  one health bar and one life; the Run ends when it is empty.
- **Score.** Every destroyed Enemy is worth points, the heavier ones more: Maletín-cóptero 100,
  Archivador Artillado 300, Caminadora a Reacción 400, Banca Artillada 1500. The Veredicto
  screen shows your score, the _demandas desestimadas_ (Enemies destroyed) and the time
  survived, and a top-10 Run is signed with three initials. The table stays on your device.
- **Enemies.** The first minute brings only Maletín-cópteros, which fire papers. After about a
  minute come the Archivador Artillado, which drops drawers from above, and the Caminadora a
  Reacción, which strafes with machine-gun bursts. After about two minutes the Banca Artillada
  arrives, slow and tough, firing rocket volleys that home in for a moment and then fly straight.
- **Crates** drop every ten seconds or so. Touch one to collect it before it blinks out.
  - **Weapons** go into your inventory with their own ammo, and a Weapon you already carry is
    topped up. The Mazo Automático (rapid gavels) never runs out, and you go back to it when a
    Weapon is empty. The others: Lluvia de Sellos (a short-range fan of rubber stamps),
    Mancuernas (bouncing dumbbells that explode), Código Penal (a law-book rocket with splash),
    Citaciones Teledirigidas (homing subpoenas) and Sentencia Firme (a beam that pierces
    everything in its line).
  - **Power-ups:** Receso heals, Inmunidad Judicial makes you invulnerable, Creatina triples
    your damage, Pre-entreno slows the Enemies and their shots, and Día de Pierna lets you fly
    while you hold jump. The HUD shows how long each one has left. Receso turns up more often
    while you are badly hurt.
- **Quips.** Destroying an Enemy sometimes makes Rexi stop for a beat and say something, in a
  dialogue box at the bottom of the screen. Play goes on while it is showing. A Banca Artillada
  always gets one.

### Controls: desktop (keyboard and mouse)

| Action               | Keys                                   |
| -------------------- | -------------------------------------- |
| Move                 | A / D or ← / →                         |
| Jump                 | W, ↑ or Space                          |
| Drop through a ledge | S or ↓                                 |
| Aim                  | Mouse (360°)                           |
| Fire                 | Hold the left mouse button             |
| Switch Weapon        | Q / E, the mouse wheel, or 1–6         |
| Pause                | Esc or P                               |
| Menus and initials   | Arrow keys or WASD, Enter / Space, Esc |

### Controls: phone and tablet (landscape)

- **Move:** the left stick. Pull it straight down to drop through a ledge.
- **Aim and fire:** the right stick. Rexi fires while it is pushed and keeps the last aim.
- **Jump:** the red button. **Switch Weapon:** tap the Weapon icon in the HUD. **Pause:** the
  button at the top right.
- **Menus and initials:** the d-pad (or swipe), ✓ to confirm, ✕ to go back.
- Held upright, the phone shows "Gira tu teléfono" and pauses the Run.

To try the touch controls in a desktop browser, open the game with `?device=touch`.

The game pauses on its own when the tab is hidden or loses focus. The pause menu can mute the
music, and that choice is remembered.

## Development

You need Node 24 or later. The art pipeline also needs [`uv`](https://docs.astral.sh/uv/), but
the build and CI do not.

```sh
npm install
npx playwright install chromium   # once, for the smoke tests
npm run dev                       # http://localhost:5173/Rexi-s-Revenge/ (?seed=N fixes the Run)
```

| Command                 | What it does                                                                 |
| ----------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`           | Vite dev server                                                              |
| `npm run typecheck`     | `tsc` for the project, then again for the headless core and renderer         |
| `npm run lint`          | ESLint and the Prettier check (`npm run format` fixes formatting)            |
| `npm test`              | Vitest: core behavior, adapters, content checks and golden images            |
| `npm run golden:update` | Re-render the golden images (see below)                                      |
| `npm run build`         | Production build to `dist/`                                                  |
| `npm run smoke`         | Build, serve and run the Playwright smoke tests (`SMOKE_PORT` sets the port) |
| `npm run check`         | All of the above, as CI runs it                                              |
| `npm run balance`       | Simulated play: bots play seeded Runs and report survival and score (below)  |
| `npm run share-preview` | Re-render the favicons, app icons and link-preview image in `public/`        |
| `npm run art -- <cmd>`  | The art pipeline ([`scripts/art/README.md`](scripts/art/README.md))          |
| `npm run art:test`      | The art pipeline's Python tests                                              |

[docs/architecture.md](docs/architecture.md) describes the module layout, the two seams (the
headless Game core and the pure renderer), and how to add Enemies, Weapons, Power-ups, events,
sounds and golden tests. [CONTEXT.md](CONTEXT.md) is the domain vocabulary, and
[docs/adr/](docs/adr/) records the decisions. [docs/spec-checklist.md](docs/spec-checklist.md)
maps every user story in the spec to where it is implemented and tested.

### Golden images

The renderer is deterministic: it draws only integer rectangles and pre-rasterized palette
sprites. So the tests in `tests/golden/` drive the real Game core with fixed seeds and scripted
spawns, render each frame in Node and compare it pixel for pixel against the PNGs in
`tests/golden/__goldens__/`. Every golden must also use only master-palette colors.

1. Make the visual change.
2. Run `npm test`. A mismatch fails and writes `<name>.actual.png`, `.expected.png` and
   `.diff.png` to `test-results/golden/` (CI uploads them as the `golden-diffs` artifact).
3. If the change is intended, run `npm run golden:update`, look at the new PNGs, and commit
   them with the change. Goldens are never written automatically, and a missing golden fails.

If you change the logo, the icons, the share card or `public/title.png`, run
`npm run share-preview` as well. A test checks that the committed files match the renderer.

### Art pipeline

The game art is generated pixel art made reproducible by a Python pipeline in `scripts/art/`
([ADR 0002](docs/adr/0002-pixel-art-rules-and-pipeline.md)). Each sprite starts as an
image-model edit made from committed prompts and templates. The pipeline then rebuilds the true
pixel grid, snaps every cell to the master palette (`src/render/palette.ts`, 56 colors in
hue-shifted ramps) and slices the sprites. Rotations are pre-baked with RotSprite, animation is
done in code, and everything is exported as palette-indexed TypeScript in
`src/render/art/generated/`. The game never decodes an image during play; the title
illustration is the one bundled picture. Generation goes through a budget ledger capped at $10,
and [CREDITS.md](CREDITS.md) records every generated asset, its model and the total spend.
Commands and the workflow are in [`scripts/art/README.md`](scripts/art/README.md).

### Balance

All balance numbers live in the tuning catalog, `src/core/tuning/`, one file per area. To
change the game's difficulty you edit data, never code. `npm run balance` measures the result:
three scripted players (casual, decent and expert, which differ in reaction time, awareness,
aim and Weapon sense) play the same seeded Runs through the core's public interface. It reports
the median and quartiles of survival time and score, the Crate pickup rate, Quips per minute
and what dealt the damage. Try an override before you edit the catalog:

```sh
npm run balance -- --seeds 100 --profile decent --tuning '{"quips":{"chance":0.3}}'
```

The target is a median Run of about four minutes for the decent player (see "Balance" in
[docs/architecture.md](docs/architecture.md)).

### Deploy

CI (`.github/workflows/ci.yml`) runs the typecheck, lint, tests, build and smoke tests on every
push and pull request. A green push to `main` uploads `dist/` and deploys it to GitHub Pages.
The Vite base path is `/Rexi-s-Revenge/`, and `dev` and `preview` use it too, so every mode
matches production. Nothing else is needed: there is no backend, and high scores stay in each
player's browser.
