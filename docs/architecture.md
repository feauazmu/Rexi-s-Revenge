# Architecture

Rexi's Revenge is a **headless, deterministic Game core** wrapped by thin **platform adapters**.
The core is the single source of truth; adapters only translate between the browser and the core.
Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); art rules follow [ADR 0001](adr/0001-gameplay-art-drawn-in-code.md).

```
          browser events                                     pixels
 keyboard/mouse/touch ──► InputFrame ──► Game.tick() ──► GameView ──► render() ──► canvas
                          (platform)     (src/core)   │  (src/core)   (src/render)
                                                      └► GameEvent[] ──► audio, effects (platform)
```

## Modules

| Path                | Role                                                                                        | May import         |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------ |
| `src/core/`         | Game core: screen flow, Run simulation, tuning, seeded RNG. No DOM, clock or `Math.random`. | `src/core` only    |
| `src/core/index.ts` | The core's **public interface**. Everything else imports the core from here.                |                    |
| `src/core/run/`     | Private Run internals (physics, Rexi, Weapons, Enemies, projectiles, spawning).             |                    |
| `src/core/tuning/`  | The tuning catalog: every balance number, one file per area.                                |                    |
| `src/render/`       | Pure renderer: `GameView` → pixels on a 480×270 `Surface`. No DOM, no clock.                | `src/core` (index) |
| `src/platform/`     | Browser adapters: shell + loop, viewport scaling, keyboard/mouse, storage, bitmaps.         | core, render       |
| `src/main.ts`       | Entry point: starts the shell.                                                              |                    |
| `tests/`            | Vitest: core behavior, adapter pure logic, golden images. `tests/support/` has helpers.     |                    |
| `e2e/`              | Playwright smoke tests against the production build.                                        |                    |

These boundaries are enforced: ESLint (`eslint.config.js`) bans DOM globals, clocks and `Math.random` in
`src/core` and `src/render`, bans cross-layer imports and deep imports into the core, and
`tsconfig.headless.json` typechecks core + renderer without DOM types.

## Seam 1: the Game core

```ts
const game = createGame({ seed, device?, storage?, overrides?: { tuning?, spawns? } });
const events = game.tick(inputFrame); // exactly one 1/60 s step
draw(game.view);                       // read-only snapshot, rebuilt lazily after each tick
game.pause();                          // shell: tab hidden / focus lost (no-op outside a Run)
```

- **`InputFrame`** (`src/core/input.ts`): device-agnostic intent. Held fields (move, jump, aim, fire) and
  edge fields (weapon next/previous/slot, pause, menu, start) that are true for exactly one tick.
- **`GameEvent`** (`src/core/events.ts`): discriminated union on `type`.
- **`GameView`** (`src/core/view.ts`): everything needed to draw, including `tick` for animation phase.
- **Determinism**: same seed + same input frames ⇒ identical event log and view. All randomness goes through
  the seeded `Rng` in `RunContext`; entity ids come from a counter.
- **Overrides**: `tuning` is deep-merged over `defaultTuning` (unknown keys throw). `spawns` replaces
  automatic spawning entirely (empty list = empty Arena) — this is how tests stage scenarios.
- **Storage**: `StoragePort` (string get/set). The core owns keys and formats (`src/core/preferences.ts`:
  "Cómo jugar" seen, music muted) and wraps the port with `resilientStorage`, so even a throwing port
  only loses persistence. `src/platform/storage.ts` wraps `localStorage` with an in-memory fallback.

### Screen flow

`src/core/game.ts` owns the state machine over `ScreenKind` (`src/core/view.ts`):
`title` → `how-to-play` (only until the persisted flag is set) → `run` ⇄ `paused` → `title` (Salir).
Each tick runs exactly one screen's logic, so the tick that changes screens does not also step the Run.

- Title and Cómo jugar accept `start` once `view.startReady` (a 0.5 s guard against double presses).
- Pausing (`pause` edge, or `game.pause()` from the shell) freezes the Run entirely: it is not stepped.
  The pause menu (`PAUSE_MENU_ITEMS`) reads `menu` edges; `pause`/`back` resume. "Silenciar música" toggles
  `view.musicMuted`, persists it and emits `mute-toggled`.
- `view.screenAge` counts ticks on the current screen (entry animations); `view.tick` keeps running while
  paused so menus can animate.
- A new screen: add it to `ScreenKind`, handle it in `stepScreen`, and add its drawer to the renderer's
  `screens` record (the typecheck fails until you do).

Inside a Run, one tick runs the subsystems in order (`src/core/run/run.ts`):
spawning → Rexi → Weapons → Enemies → projectiles. Subsystems share a `RunContext`
(`tuning`, `rng`, `state`, `emit`, `nextId`).

Units: tuning values are seconds, pixels and px/s; the core converts to ticks with `secondsToTicks`.
Positions are game coordinates (480×270); boxes use their top-left corner.

## Seam 2: the renderer

`createRenderer(bitmapFactory, { titleIllustration? }).render(surface, view)` draws one full frame.
It dispatches on `view.screen` through a `Record<ScreenKind, …>` of drawers; menu screens live in
`src/render/screens/` (shared panel, keycap, outlined-text and dimmer helpers in `ui.ts`). The Title draws
`titleIllustration` (a decoded 480×270 bitmap from the platform) when given, else a code-drawn backdrop.

- **Determinism rule**: the renderer only uses `Surface.fillRect` (integer-snapped solid rectangles) and
  `Surface.drawBitmap` (unscaled pre-rasterized bitmaps at integer positions). No paths, arcs, gradients or
  canvas text. That makes output pixel-identical in browsers and in Node.
- **Sprites are code** (ADR 0001): `defineSprite(palette, rows)` is a palette-indexed pixel grid; the
  `SpriteBank` rasterizes each sprite once on first use through the platform's `BitmapFactory`.
- Layers are listed back to front in `RUN_LAYERS` (`src/render/renderer.ts`). The HUD
  (`src/render/hud/`) is drawn above Rexi and below the crosshair. When paused, the Run is drawn without
  HUD and crosshair, dimmed with a checkerboard, then the HUD and the pause menu go on top.
- Animation phase comes from `view.tick`, `enemy.age`, `projectile.age` — never from a clock.

## Text: bitmap fonts, metrics and the strings catalog

All text is drawn with code-defined bitmap fonts (`src/render/text/`), never canvas text.

```ts
import { drawText, fonts, strings } from '../render'; // or './text', './strings' inside src/render

const { regular, large } = fonts; // regular: HUD, Dialogue Box. large: headings (regular at 2×)
regular.measure('¡Hola!');        // width in px (widest line for multi-line text)
regular.wrap(quip, 300);          // greedy word wrap → lines, each ≤ 300 px wide
regular.blockHeight(2);           // height in px of 2 lines
regular.missing(text);            // characters the font cannot draw ([] when all are covered)
drawText(dc, regular, strings.hud.score, x, y, { color, shadow?, align? });
```

- **Metrics are exact**: what `measure`/`wrap` report is exactly what `drawText` covers. Width = glyph
  widths + `letterSpacing` (1 px) between glyphs. `y` is the top of the cell; capitals sit on
  `font.baseline`. The regular cell is 12 px tall (accents over capitals, 7 px capitals, descenders) and
  `lineHeight` is 13 px. Digits are all 4 px wide so changing numbers don't jitter.
- `measure`, `wrap` and `drawText` throw on a missing glyph; content tests use `missing()` to catch it first.
  `drawText` does not wrap: call `font.wrap` and draw the lines (joined with `\n`).
- **Glyphs** live in `src/render/text/glyphs.ts` as `#`/`.` rows from the cap top. Accented letters are
  composed from a base glyph plus a mark (`COMPOSED`), so adding `à` is one line.
- **Strings catalog** (`src/render/strings.ts`): every player-facing string, in Spanish (the title
  "Rexi's Revenge" stays English). Add new UI copy there, never inline; numbers are formatted by the drawing
  code (`formatElapsed(ticks)` → `m:ss`). A test asserts every character in the catalog exists in the font.
- Quip-length check: a Quip fits when `fonts.regular.wrap(text, dialogueTextWidth).length <= 2`.

## Platform shell

`src/platform/shell.ts` creates the canvas, applies `computeViewport` (largest integer device-pixel scale,
letterboxed, snapped to device pixels), and runs a `requestAnimationFrame` loop. `createFixedStepper`
converts frame times into whole ticks (clamped to 5 per frame), so speed is identical at 60/120/144 Hz.
Each tick samples the keyboard/mouse adapter once (edges are consumed by the first sample).
On `blur` or `visibilitychange` to hidden it calls `game.pause()`. It mirrors `view.screen` to
`#app[data-screen]`, which the smoke tests poll.
`ShellOptions.onEvents` receives every tick's events — the audio engine plugs in there.

## How to add…

### An Enemy

1. Add the id to `ENEMY_KINDS` in `src/core/ids.ts`.
2. Add its numbers to `src/core/tuning/enemies.ts` (interface entry extending `EnemyTuningBase` + values).
3. Write its behavior in `src/core/run/enemies/<kind>.ts` with `defineEnemy({ kind, craft, init, update })`.
   Use the `dt` argument for all time-based motion (Pre-entreno scales Enemy time) and `ctx.rng` for randomness.
4. Register it in `src/core/run/enemies/index.ts` (one line).
5. Draw it in `src/render/enemies/<kind>.ts` and register the drawer in `src/render/enemies/index.ts`.
6. Test through the public interface: stage it with `overrides.spawns`, drive inputs, assert events/view.
   Add a golden if it has a look.

`Record<EnemyKind, …>` catalogs make the typecheck fail until steps 2, 4 and 5 are done.

### A Weapon

1. Add the id to `WEAPON_IDS` (and any new projectile kind to `PROJECTILE_KINDS`) in `src/core/ids.ts`.
2. Add its tuning entry in `src/core/tuning/weapons.ts` (pick or add an archetype interface extending
   `WeaponTuningBase`).
3. Implement `src/core/run/weapons/<id>.ts` exporting a `WeaponDef` whose `fire(shot, ctx)` spawns
   projectiles with `spawnProjectile` (the Weapon system already handles trigger, cooldown and `weapon-fired`).
4. Register it in `src/core/run/weapons/index.ts`.
5. Draw new projectile kinds in `src/render/projectiles/<kind>.ts` and register them in
   `src/render/projectiles/index.ts`.
6. Draw its HUD icon in `src/render/hud/weapon-icons.ts` and add its Spanish name to `strings.weapons`.

### An event

Add an interface and one line to the `GameEvent` union in `src/core/events.ts`; emit it with `ctx.emit`.

### A golden-image test

```ts
const game = drive({
  seed: 1,
  overrides: { spawns: [{ kind: 'maletin-coptero', x: 320, y: 70 }] },
});
game.seconds(0.5, { aim: { x: 332, y: 79 } });
await expectGolden('my-scene', renderView(game.view));
```

- Build views only by driving the real core (`tests/support/driver.ts`), never by hand.
- Run `npm run golden:update` to create/replace PNGs in `tests/golden/__goldens__/`, inspect them, and commit.
  Missing goldens fail; they are never written automatically.
- On mismatch the test fails and writes `<name>.actual|expected|diff.png` to `test-results/golden/`
  (CI uploads them as the `golden-diffs` artifact).

## Testing conventions

- Test external behavior through a seam: input frames in → events/view out; view in → pixels out.
  Never import from `src/core/run/` or mutate internals.
- `tests/support/driver.ts`: `drive()` / `driveEmptyArena()`, `ticks`, `seconds`, `holdFireToward`,
  `eventsOf`, `runOf`.
- Renderer building blocks without a view (font metrics, the font specimen golden) are tested directly
  (`tests/render/`, `renderPart` in `tests/support/render-node.ts`).
- Adapter logic is tested as pure functions (`viewport`, `fixed-step`, `keyboard-mouse` mapping).

## Commands

| Command                 | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Vite dev server (`/Rexi-s-Revenge/`); `?seed=N` fixes the seed    |
| `npm run typecheck`     | `tsc` for the project and the headless core/renderer              |
| `npm run lint`          | ESLint + Prettier check (`npm run format` fixes)                  |
| `npm test`              | Vitest: unit, core and golden tests                               |
| `npm run golden:update` | Re-render and overwrite golden PNGs                               |
| `npm run build`         | Production build to `dist/`                                       |
| `npm run smoke`         | Build, serve and run Playwright (`SMOKE_PORT` to change the port) |
| `npm run check`         | All of the above, as CI does                                      |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build and smoke on every push and deploys
`main` to GitHub Pages.
