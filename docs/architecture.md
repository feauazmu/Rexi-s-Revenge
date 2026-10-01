# Architecture

Rexi's Revenge is a **headless, deterministic Game core** wrapped by thin **platform adapters**.
The core is the single source of truth; adapters only translate between the browser and the core.
Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); art rules follow [ADR 0001](adr/0001-gameplay-art-drawn-in-code.md).

```
          browser events                                     pixels
 keyboard/mouse/touch ──► InputFrame ──► Game.tick() ──► GameView ──► render() ──► canvas
                          (platform)     (src/core)   │  (src/core)   (src/render)
                                                      └► GameEvent[] ──► audio (platform)
```

## Modules

| Path                | Role                                                                                        | May import         |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------ |
| `src/core/`         | Game core: screen flow, Run simulation, tuning, seeded RNG. No DOM, clock or `Math.random`. | `src/core` only    |
| `src/core/index.ts` | The core's **public interface**. Everything else imports the core from here.                |                    |
| `src/core/run/`     | Private Run internals (physics, Rexi, Weapons, Enemies, projectiles, spawning, effects).    |                    |
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
```

- **`InputFrame`** (`src/core/input.ts`): device-agnostic intent. Held fields (move, jump, drop, aim, fire) and
  edge fields (weapon next/previous/slot, pause, menu, start) that are true for exactly one tick.
- **`GameEvent`** (`src/core/events.ts`): discriminated union on `type`.
- **`GameView`** (`src/core/view.ts`): everything needed to draw, including `tick` for animation phase.
- **Determinism**: same seed + same input frames ⇒ identical event log and view. All randomness goes through
  the seeded `Rng` in `RunContext`; entity ids come from a counter.
- **Overrides**: `tuning` is deep-merged over `defaultTuning` (unknown keys throw). `spawns` replaces
  the spawn Director entirely (empty list = empty Arena) — this is how tests stage scenarios.
- **Storage**: `StoragePort` (string get/set). The core owns keys and formats; `src/platform/storage.ts`
  wraps `localStorage` with an in-memory fallback.

Inside a Run, one tick runs the subsystems in order (`src/core/run/run.ts`):
effects → spawning → Rexi → Weapons → Enemies → projectiles, then the Run tick and the ramp clock
advance. Subsystems share a `RunContext` (`tuning`, `rng`, `state`, `emit`, `nextId`).

### Spawn Director and the ramp clock

The Director (`src/core/run/director.ts`) sends Enemies continuously, HA3-style, from the ramp table in
`src/core/tuning/director.ts`:

- `stages`: rows of `{ from, onScreenCap, spawnInterval, fireRate }`; the row whose `from` (seconds of ramp
  clock) last passed applies. After the last row, `growth` keeps raising the cap and fire rate and shortening
  the interval every `growth.every` seconds, up to its limits.
- `roster`: one entry per Enemy kind (`Record<EnemyKind, RosterEntry>`): when it may start appearing
  (`from`), its relative `weight`, its own on-screen limit (`maxOnScreen`, null for none), and where it enters
  (`edges`: just outside the left/right edge within `minY..maxY`, or above the top). Behaviors then fly
  the Enemy into the Arena on their own.
- Every `spawnInterval` it picks a kind by weight among those allowed and sends it, unless the Arena is at
  the cap (that spawn is skipped). All picks use the seeded gameplay `rng`.
- `fireRate` scales Enemy attacks: behaviors run their attack cooldowns at `dt * enemyFireRate(ctx)`
  (`src/core/run/ramp.ts`).

The **ramp clock** (`RunState.rampTicks`, exposed as `RunView.rampTicks`) counts Run time excluding pause and
Hit-stop. It advances only inside the Run's `simulate` step (`advanceRampClock`), so anything that freezes
the simulation — the pause screen not stepping the Run, Hit-stop skipping `simulate` — leaves the ramp
where it was. Scripted spawns replace the Director's spawning, but the ramp clock and fire rate still run.

Combat rules (`src/core/run/projectiles.ts`, `src/core/run/rexi.ts`): Rexi's projectiles hurt Enemies;
Enemy projectiles (`owner: 'enemy'`, spawned from an Enemy's `update` with `spawnProjectile`) hurt Rexi.
A hit emits `rexi-hit` and starts the hurt reaction (`RexiView.hurtTicks`) and the invulnerability window
(`RexiView.invulnerableTicks`); while it lasts, Enemy projectiles fly through him. Projectiles are removed on a
hit, at the ground, off-screen or when their lifetime runs out. When Rexi's health reaches zero the Run emits
`run-ended` (score, Enemies destroyed, ticks survived) in that same tick, sets `RunView.ended` and stops
advancing. Until the Veredicto screen exists, the Game starts a new Run 2 s later.

### Combat feedback (effects)

Hit flash, explosions, debris and screen shake are simulated in the core (`src/core/run/effects/`)
so they are deterministic and testable through the view (`RunView.effects`, `EnemyView.hitFlash`).
They are cosmetic: they draw from their own `Rng` stream (seeded with `deriveSeed(seed, …)`), never
from the gameplay `rng`, and gameplay never reads them — tuning effects can't change how a Run plays.

- Verbs for other subsystems: `flashEnemy` (called by `damageEnemy` on every hit), `shatterEnemy`
  (on destruction: debris + the kind's explosion preset), `explode(ctx, at, 'small' | 'large')` and
  `addShakeTrauma` for explosive Weapons or Rexi getting hurt.
- Particles live in a bounded pool (`tuning.effects.maxParticles`, oldest dropped first) and are
  culled when their life ends or they leave the screen; debris settles on the ground, rests, then blinks out.
- Screen shake is trauma-based: events add trauma (0..1), it decays linearly, and the view's
  `effects.shake` is `maxOffset × scale × trauma² × noise(t)` rounded to whole pixels
  (`tuning.effects.shake.scale = 0` disables it).
- All numbers live in `src/core/tuning/effects.ts`; per-Enemy `explosion` and `debrisPieces` live in its
  Enemy tuning.

Units: tuning values are seconds, pixels and px/s; the core converts to ticks with `secondsToTicks`.
Positions are game coordinates (480×270); boxes use their top-left corner.

## Seam 2: the renderer

`createRenderer(bitmapFactory).render(surface, view)` draws one full frame.

- **Determinism rule**: the renderer only uses `Surface.fillRect` (integer-snapped solid rectangles) and
  `Surface.drawBitmap` (unscaled pre-rasterized bitmaps at integer positions). No paths, arcs, gradients or
  canvas text. That makes output pixel-identical in browsers and in Node.
- **Sprites are code** (ADR 0001): `defineSprite(palette, rows)` is a palette-indexed pixel grid; the
  `SpriteBank` rasterizes each sprite once on first use through the platform's `BitmapFactory`.
- Layers are listed back to front in `src/render/renderer.ts`: `WORLD_LAYERS` are drawn offset by the
  screen shake, `SCREEN_LAYERS` stay fixed: the HUD
  (`src/render/hud/`), then the crosshair (and later the Dialogue Box).
- Hit flash is generic: `drawEnemies` wraps a hit Enemy's drawer in `silhouetteContext`, which turns
  rectangles and sprites into a white silhouette, so Enemy drawers need no flash code.
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
`ShellOptions.onEvents` receives every tick's events — the audio engine plugs in there.

## How to add…

### An Enemy

1. Add the id to `ENEMY_KINDS` in `src/core/ids.ts`.
2. Add its numbers to `src/core/tuning/enemies.ts` (interface entry extending `EnemyTuningBase` + values,
   including its death `explosion` preset and `debrisPieces`).
3. Add its roster entry to `roster` in `src/core/tuning/director.ts` (start time, weight, own on-screen
   limit, entry edges and altitude band): this is how it joins the ramp.
4. Write its behavior in `src/core/run/enemies/<kind>.ts` with `defineEnemy({ kind, craft, init, update })`.
   Use the `dt` argument for all time-based motion (Pre-entreno scales Enemy time), count attack cooldowns
   down by `dt * enemyFireRate(ctx)` so the ramp raises its fire rate, and use `ctx.rng` for randomness.
   It may spawn just outside the Arena: it must fly itself in.
5. Register it in `src/core/run/enemies/index.ts` (one line).
6. Draw it in `src/render/enemies/<kind>.ts` (plus the debris chunk sprites it breaks into) and register
   the drawer and chunks in `src/render/enemies/index.ts`. The drawer also gets the `RunView` (e.g. to face
   Rexi).
7. Test through the public interface: stage it with `overrides.spawns`, drive inputs, assert events/view.
   Test its Director arrival time by overriding `director` tuning. Add a golden if it has a look.

`Record<EnemyKind, …>` catalogs make the typecheck fail until steps 2, 3, 5 and 6 are done.

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

### A platform

Add `{ x, y, w }` (y = walkable top) to `arena.platforms` in `src/core/tuning/arena.ts`. Physics
(`src/core/run/physics.ts`) treats every platform as one-way and the renderer draws each as a stone
ledge, so no other code changes. Keep each one less than a full jump above the surface below it
(the layout tests in `tests/core/platforms.test.ts` check this).

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
  `eventsOf`, `runOf`. `drive()` without `spawns` runs the real Director.
- `tests/support/fixtures.ts`: `holdStill(tuning)` keeps Enemies hovering where they were placed, for
  scenarios that aim at fixed points.
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
