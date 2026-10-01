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

| Path                | Role                                                                                             | May import         |
| ------------------- | ------------------------------------------------------------------------------------------------ | ------------------ |
| `src/core/`         | Game core: screen flow, Run simulation, tuning, seeded RNG. No DOM, clock or `Math.random`.      | `src/core` only    |
| `src/core/index.ts` | The core's **public interface**. Everything else imports the core from here.                     |                    |
| `src/core/run/`     | Private Run internals (physics, Rexi, Weapons, Crates, Enemies, projectiles, spawning, effects). |                    |
| `src/core/tuning/`  | The tuning catalog: every balance number, one file per area.                                     |                    |
| `src/render/`       | Pure renderer: `GameView` → pixels on a 480×270 `Surface`. No DOM, no clock.                     | `src/core` (index) |
| `src/platform/`     | Browser adapters: shell + loop, viewport scaling, keyboard/mouse, storage, bitmaps.              | core, render       |
| `src/main.ts`       | Entry point: starts the shell.                                                                   |                    |
| `tests/`            | Vitest: core behavior, adapter pure logic, golden images. `tests/support/` has helpers.          |                    |
| `e2e/`              | Playwright smoke tests against the production build.                                             |                    |

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

- **`InputFrame`** (`src/core/input.ts`): device-agnostic intent. Held fields (move, jump, drop, aim, fire) and
  edge fields (weapon next/previous/slot, pause, menu, start) that are true for exactly one tick.
- **`GameEvent`** (`src/core/events.ts`): discriminated union on `type`.
- **`GameView`** (`src/core/view.ts`): everything needed to draw, including `tick` for animation phase.
- **Determinism**: same seed + same input frames ⇒ identical event log and view. All randomness goes through
  the seeded `Rng` in `RunContext`; entity ids come from a counter.
- **Overrides**: `tuning` is deep-merged over `defaultTuning` (unknown keys throw). `spawns` replaces
  automatic spawning of Enemies and Crates entirely (empty list = empty Arena) — this is how tests stage
  scenarios. A spawn is an Enemy (`{ kind: 'maletin-coptero', x, y }`) or a Crate
  (`{ kind: 'crate', contents, x, y? }`, `y` defaulting to just above the screen).
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
effects → spawning → Rexi → Crates → Weapons → Enemies → projectiles. Subsystems share a `RunContext`
(`tuning`, `rng`, `state`, `emit`, `nextId`). Crates run before Weapons, so a Weapon picked up this tick
can fire this tick.

### Weapons and the inventory

`src/core/run/weapons/inventory.ts` holds the HA3 rules. The Mazo Automático (`DEFAULT_WEAPON`) is always
carried with unlimited ammo. A collected special Weapon is added with `pickupAmmo` and selected, or, if
already carried, topped up to at most `maxAmmo` without changing the selection. Each trigger pull spends
one ammo (a whole Lluvia de Sellos fan is one); at zero the Weapon leaves the inventory and the Mazo is
selected. Slots follow `WEAPON_IDS`: number key N selects entry N − 1 if carried; next/previous cycle the
carried Weapons in that order, wrapping. Cooldowns are per Weapon, so switching never skips one.

### Crates

`src/core/run/crates/system.ts` drops Crates on a seeded timer (`tuning.crates`), lets them fall at the
parachute speed through `stepBody` (so they land wherever bodies land: the ground or a one-way platform), starts their lifetime on landing,
marks the last `blinkTime` as `blinking` in the view, and removes them on expiry or when Rexi touches one.
It never looks inside a Crate: `src/core/run/crates/contents.ts` derives the possible contents from
`SPECIAL_WEAPON_IDS` and `POWER_UP_IDS`, rolls them with the weights in `tuning.crates.weights`, and on
pickup hands Weapons to the inventory and Power-ups to their `PowerUpDef.collect`
(`src/core/run/power-ups/`). The renderer (`src/render/layers/crates.ts`) shows the contents' icon on a
family-colored Crate and picks the blink cadence.

Combat rules (`src/core/run/projectiles.ts`, `src/core/run/rexi.ts`): Rexi's projectiles hurt Enemies;
Enemy projectiles (`owner: 'enemy'`, spawned from an Enemy's `update` with `spawnProjectile`) hurt Rexi.
A hit emits `rexi-hit` and starts the hurt reaction (`RexiView.hurtTicks`) and the invulnerability window
(`RexiView.invulnerableTicks`); while it lasts, Enemy projectiles fly through him. Projectiles are removed on a
hit, at the ground, off-screen or when their lifetime runs out. When Rexi's health reaches zero the Run emits
`run-ended` (score, Enemies destroyed, ticks survived) in that same tick, sets `RunView.ended` and stops
advancing (it can no longer be paused). Until the Veredicto screen exists, the Game returns to the Title 2 s later.

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

### Quips and Hit-stop

`src/core/quips/` holds the Quip catalog (`catalog.ts`, content rules in its header), a
`ShuffleBag` and the **Quip director** (`createQuipDirector`, exported from the core so tests can
drive it directly). The Run owns one director and calls it in this order every tick:

1. `quips.advance()` first, on every tick: it animates the Dialogue Box (slide, typewriter,
   linger, close) and consumes one tick of Hit-stop. While it returns true the Run skips all
   subsystems (effects and Crate timers included) and does not advance `state.tick`, so the ramp clock and time survived exclude
   Hit-stop. Jump and Weapon-switch presses made while frozen are applied on the first live tick.
2. After the subsystems, every `enemy-destroyed` of the tick goes to `quips.enemyDestroyed()`,
   unless Rexi died that tick (the Run ends without a Quip). An ended Run stops stepping, so a
   showing Dialogue Box stays frozen on screen. Pausing freezes the director too: the game simply
   stops stepping the Run.

Trigger rules: an Enemy whose tuning entry has `alwaysQuip: true` always triggers (replacing a
showing box); otherwise a Quip triggers only with no box showing, after `quips.cooldown` seconds
since the last box closed, and with `quips.chance`. Craft picks the theme (`THEME_OF_CRAFT`). The
director draws from its own seeded stream (`seed ^ QUIP_STREAM` in `game.ts`), so talking never
changes gameplay randomness. Events: `quip-started`, `quip-character` (one per visible character,
for the blip) and `dialogue-closed`; the view exposes `run.hitStop` and `run.dialogue`.

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
- Layers are listed back to front in `src/render/renderer.ts`: `WORLD_LAYERS` are drawn offset by the
  screen shake, `SCREEN_LAYERS` stay fixed: the HUD (`src/render/hud/`), then the Dialogue Box
  (`src/render/dialogue/`), then the crosshair. When paused, the world layers and the frozen Dialogue
  Box are drawn without HUD and crosshair, dimmed with a checkerboard, then the HUD and the pause menu
  go on top.
- Hit flash is generic: `drawEnemies` wraps a hit Enemy's drawer in `silhouetteContext`, which turns
  rectangles and sprites into a white silhouette, so Enemy drawers need no flash code.
- Animation phase comes from `view.tick`, `enemy.age`, `projectile.age` — never from a clock.
- **Rexi** (`src/render/rexi/`): body parts drawn facing right (`body.ts`) are composed per pose and
  mirrored for facing left; `pose.ts` picks the pose from `RexiView` (grounded/vx/vy, `hurtTicks`
  for the hurt pose, `invulnerableTicks` for the red blink, `shotAge`) and the Run tick. The aiming
  arm (`arm.ts`) is rasterized from shapes in 16 directions around `RexiView.shoulder`, holding the current Weapon's look from `held-weapons.ts` (a
  `Record<WeaponId, …>`, so a new Weapon must add its held look there).

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
- Quip-length check: a Quip fits when `fonts.regular.wrap(text, DIALOGUE_TEXT_WIDTH).length <=
DIALOGUE_MAX_LINES` (2), both exported from `src/render`. Quips are game content that drives
  typewriter timing, so they live in the core (`QUIPS`), not in the strings catalog.
- The Dialogue Box (`src/render/dialogue/`) lays out the whole Quip first and reveals characters
  on those lines (`revealedLines`), so words never jump lines while typing.

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
2. Add its numbers to `src/core/tuning/enemies.ts` (interface entry extending `EnemyTuningBase` + values,
   including its death `explosion` preset and `debrisPieces`).
3. Write its behavior in `src/core/run/enemies/<kind>.ts` with `defineEnemy({ kind, craft, init, update })`.
   Use the `dt` argument for all time-based motion (Pre-entreno scales Enemy time) and `ctx.rng` for randomness.
4. Register it in `src/core/run/enemies/index.ts` (one line).
5. Draw it in `src/render/enemies/<kind>.ts` (plus the debris chunk sprites it breaks into) and register
   the drawer and chunks in `src/render/enemies/index.ts`.
6. Test through the public interface: stage it with `overrides.spawns`, drive inputs, assert events/view.
   Add a golden if it has a look.

`Record<EnemyKind, …>` catalogs make the typecheck fail until steps 2, 4 and 5 are done.

### A Weapon

1. Add the id to `WEAPON_IDS` (and any new projectile kind to `PROJECTILE_KINDS`) in `src/core/ids.ts`.
   Its position is its inventory slot (number key).
2. Add its tuning entry in `src/core/tuning/weapons.ts`: an archetype interface extending
   `WeaponTuningBase` (pick or add one) `& AmmoTuning` (`pickupAmmo`, `maxAmmo`).
3. Give it a Crate weight in `tuning.crates.weights.weapons` (`src/core/tuning/crates.ts`). That alone makes
   it Crate content; the Crate system and inventory need no changes.
4. Implement `src/core/run/weapons/<id>.ts` exporting a `WeaponDef` whose `fire(shot, ctx)` spawns
   projectiles with `spawnProjectile` (the Weapon system already handles switching, trigger, cooldown,
   ammo and `weapon-fired`).
5. Register it in `src/core/run/weapons/index.ts`.
6. Draw new projectile kinds in `src/render/projectiles/<kind>.ts` and register them in
   `src/render/projectiles/index.ts`.
7. Draw its icon (at most 12×12; it is also shown on Crates) in `src/render/hud/weapon-icons.ts` and add
   its Spanish name to `strings.weapons`.
8. Test it through a scripted Crate: `weaponCrate(id, ON_REXI.x, { y: ON_REXI.y })` from
   `tests/support/driver.ts` hands it to Rexi on the first tick.

### A Power-up

1. Add the id to `POWER_UP_IDS` in `src/core/ids.ts`.
2. Add its numbers to the tuning catalog and its Crate weight to `tuning.crates.weights.powerUps`.
3. Implement `src/core/run/power-ups/<id>.ts` exporting a `PowerUpDef` whose `collect(ctx)` applies it, and
   register it in `src/core/run/power-ups/index.ts`. Crates deliver it with no other change.
4. Draw its icon (at most 12×12) in `src/render/hud/power-up-icons.ts`.

`Record<…Id, …>` catalogs (tuning, Crate weights, behavior, icons, names) make the typecheck fail until
every step is done.

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
