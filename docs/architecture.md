# Architecture

Rexi's Revenge is a **headless, deterministic Game core** wrapped by thin **platform adapters**.
The core is the single source of truth; adapters only translate between the browser and the core.
Vocabulary follows [`CONTEXT.md`](../CONTEXT.md); art rules follow [ADR 0002](adr/0002-pixel-art-rules-and-pipeline.md) (pixel-art rules and the
art pipeline in `scripts/art/`, see "Art pipeline" below).

```
          browser events                                     pixels
 keyboard/mouse/touch ──► InputFrame ──► Game.tick() ──► GameView ──► render() ──► canvas
                          (platform)     (src/core)   │  (src/core)   (src/render)
                                                      └► GameEvent[] ──► audio (platform)
```

## Modules

| Path                | Role                                                                                                  | May import         |
| ------------------- | ----------------------------------------------------------------------------------------------------- | ------------------ |
| `src/core/`         | Game core: screen flow, Run simulation, tuning, seeded RNG. No DOM, clock or `Math.random`.           | `src/core` only    |
| `src/core/index.ts` | The core's **public interface**. Everything else imports the core from here.                          |                    |
| `src/core/run/`     | Private Run internals (physics, Rexi, Weapons, Crates, Enemies, projectiles, spawning, effects).      |                    |
| `src/core/tuning/`  | The tuning catalog: every balance number, one file per area.                                          |                    |
| `src/render/`       | Pure renderer: `GameView` → pixels on a 640×360 `Surface`. No DOM, no clock.                          | `src/core` (index) |
| `src/platform/`     | Browser adapters: shell + loop, viewport, fullscreen, keyboard/mouse, touch, storage, bitmaps, audio. | core, render       |
| `src/main.ts`       | Entry point: starts the shell.                                                                        |                    |
| `tests/`            | Vitest: core behavior, adapter pure logic, golden images. `tests/support/` has helpers.               |                    |
| `e2e/`              | Playwright smoke tests against the production build.                                                  |                    |

These boundaries are enforced: ESLint (`eslint.config.js`) bans DOM globals, clocks and `Math.random` in
`src/core` and `src/render`, bans cross-layer imports and deep imports into the core, and
`tsconfig.headless.json` typechecks core + renderer without DOM types.

## Seam 1: the Game core

```ts
const game = createGame({ seed, device?, fullscreenSupport?, storage?, overrides?: { tuning?, spawns? } });
const events = game.tick(inputFrame); // exactly one 1/60 s step
draw(game.view);                       // read-only snapshot, rebuilt lazily after each tick
game.pause();                          // shell: tab hidden / focus lost (no-op outside a Run)
game.reportFullscreen(active);         // shell: the browser entered or left fullscreen
```

- **`InputFrame`** (`src/core/input.ts`): device-agnostic intent. Held fields (move, jump, drop, aim, fire) and
  edge fields (weapon next/previous/slot, pause, menu, start) that are true for exactly one tick.
- **`GameEvent`** (`src/core/events.ts`): discriminated union on `type`.
- **`GameView`** (`src/core/view.ts`): everything needed to draw, including `tick` for animation phase.
- **Determinism**: same seed + same input frames (and the same `pause()` / `reportFullscreen()` calls
  between ticks) ⇒ identical event log and view. All randomness goes through
  seeded `Rng` streams: the gameplay `rng` in `RunContext` (seeded with the Game's seed), plus the effects
  and Quip streams, each seeded from it with `deriveSeed(seed, stream)`; entity ids come from a counter. The streams and the
  id counter belong to the **Game**, not the Run: they carry on across Runs, so a Game's second Run
  differs from its first. Determinism is per Game (seed + every input frame since `createGame`); to replay
  one Run exactly, replay the whole Game that led to it.
- **Overrides**: `tuning` is deep-merged over `defaultTuning` (unknown keys throw). `spawns` replaces
  the spawn Director and automatic Crate drops entirely (empty list = empty Arena) — this is how tests stage
  scenarios. A spawn is an Enemy (`{ kind: 'maletin-coptero', x, y }`) or a Crate
  (`{ kind: 'crate', contents, x, y? }`, `y` defaulting to just above the screen).
- **Storage**: `StoragePort` (string get/set). The core owns keys and formats (`src/core/preferences.ts`:
  "Cómo jugar" seen, music muted; `src/core/high-scores.ts`: the top 10) and wraps the port with
  `resilientStorage`, so even a throwing port only loses persistence.
- **High scores** (`src/core/high-scores.ts`, public through the index): the top 10 of
  `{ initials, score, enemiesDestroyed, ticksSurvived }`, highest score first, ties keep the earlier entry
  above, a Run that scored nothing never qualifies (`highScoreRank`, `insertHighScore`). Stored as JSON
  `{ version: 1, entries }` under `high-scores`; anything malformed or of another version loads as an
  empty table. `view.highScores` always holds the current table. `src/platform/storage.ts` wraps `localStorage` with an in-memory fallback.

### Screen flow

`src/core/game.ts` owns the state machine over `ScreenKind` (`src/core/view.ts`):
`title` → `how-to-play` (only until the persisted flag is set) → `run` ⇄ `paused` → `title` (Salir);
`run` (ended) → `verdict` → `title`.
Each tick runs exactly one screen's logic, so the tick that changes screens does not also step the Run.

- Title and Cómo jugar accept `start` once `view.startReady` (a guard against double presses,
  `tuning.screens.startGuard`).
- Pausing (`pause` edge, or `game.pause()` from the shell) freezes the Run entirely: it is not stepped.
  The pause menu (`pauseMenuItems(fullscreenSupport)`, see [Fullscreen](#fullscreen)) reads `menu` edges (each move emits `menu-moved`); `pause`/`back` resume. "Silenciar música" toggles
  `view.musicMuted`, persists it and emits `mute-toggled`.
- **Run end**: the ended Run stays on the `run` screen for the defeat beat (`tuning.screens.defeatBeat`;
  `view.defeatAge` counts it), then the Veredicto (`view.verdict`, `src/core/verdict.ts`) shows its stats over
  the frozen Run. It ignores input while the stats are read out (`tuning.screens.verdictGuard`). `verdict.ts` owns the Veredicto's tick (`stepVerdict`:
  initials entry, its events, signing, leaving); the Game hands it a `record` callback that saves the table. A top-10 Run (`verdict.rank`) signs 3 initials with menu
  navigation only (up/down: letter, wrapping A–Z; left/right/back: move; confirm: next letter, then sign), so
  keyboard and touch share it. Signing saves the table and emits `high-score-recorded`; then, after `tuning.screens.startGuard`,
  `start` returns to the Title (`view.startReady`). Entries start from the initials signed last this session.
- `view.screenAge` counts ticks on the current screen (entry animations); `view.tick` keeps running while
  paused so menus can animate.
- A new screen: add it to `ScreenKind`, handle it in `stepScreen`, and add its drawer to the renderer's
  `screens` record and its touch controls mode to `TOUCH_MODES` (`src/render/touch/layout.ts`; `menu` for
  any screen that reads `menu` edges). The typecheck fails until you do.

Inside a Run, one tick runs the subsystems in order (`src/core/run/run.ts`):
effects → Power-up timers → spawning → Rexi → Crates → Weapons → Enemies → projectiles, then the Run tick and the ramp
clock advance. That sequence is the Run's `simulate` step; a Hit-stop (checked first) or pause skips it
whole. Subsystems share a `RunContext` (`tuning`, `rng`, `state`, `emit`, `nextId`). Crates run before Weapons, so a Weapon picked up this tick
can fire this tick.

### Weapons and the inventory

`src/core/run/weapons/inventory.ts` holds the HA3 rules. The Mazo Automático (`DEFAULT_WEAPON`) is always
carried with unlimited ammo. A collected special Weapon is added with `pickupAmmo` and selected, or, if
already carried, topped up to at most `maxAmmo` without changing the selection. Each trigger pull spends
one ammo (a whole Lluvia de Sellos fan is one); at zero the Weapon leaves the inventory and the Mazo is
selected. Slots follow `WEAPON_IDS`: number key N selects entry N − 1 if carried; next/previous cycle the
carried Weapons in that order, wrapping. Cooldowns are per Weapon, so switching never skips one.

Projectile behaviors are options of `spawnProjectile` (`src/core/run/projectiles.ts`), so a Weapon
composes them instead of writing motion code: `gravity` (arcs), `homing` (steer toward the target, optionally
for a limited time), `bounce` (off the ground and one-way
platforms, landing from above), `thrust` (accelerate along the heading to a top speed), `trailInterval`
(cosmetic smoke puffs) and `blast`. A projectile with a `blast` is explosive: it detonates when it hits its
target (after its impact `damage`), lands with no bounces left (on the ground; bouncing projectiles and falling
bombs — `blast` with `gravity` — also land on one-way platform tops), or its
lifetime runs out — never when it leaves the screen. `detonate` (`src/core/run/explosives.ts`) emits
`explosion` (owner, projectile kind, preset size, center, radius), plays the blast's explosion preset and deals
splash damage (`Blast`: `damage` at the center, linear falloff to `edge` × `damage` at `radius`, measured to the
nearest point of each target's hitbox). The splash hurts what the owner fights: Rexi's blasts hurt every Enemy
in reach and never Rexi; Enemy blasts hurt only Rexi (respecting his invulnerability). A blast with `damage: 0`
is a harmless burst. Weapons build theirs from `SplashTuning` with `splashBlast`.
Mancuernas (`gravity` + `bounce` + `blast`) and Código Penal (`thrust` + `trailInterval` + `blast`) are
built this way.

### Crates

`src/core/run/crates/system.ts` drops Crates on a seeded timer (`tuning.crates`), lets them fall at the
parachute speed through `stepBody` (so they land wherever bodies land: the ground or a one-way platform), starts their lifetime on landing,
marks the last `blinkTime` as `blinking` in the view, and removes them on expiry or when Rexi touches one.
It never looks inside a Crate: `src/core/run/crates/contents.ts` derives the possible contents from
`SPECIAL_WEAPON_IDS` and `POWER_UP_IDS`, rolls them with the weights in `tuning.crates.weights` (Receso's
weight is multiplied by `recesoBoost.weightMultiplier` while Rexi's health is at most
`recesoBoost.belowHealth` of max), and on pickup hands Weapons to the inventory and Power-ups to the
Power-up system. The renderer (`src/render/layers/crates.ts`) shows the contents' icon on a
family-colored Crate and picks the blink cadence.

### Spawn Director and the ramp clock

The Director (`src/core/run/director.ts`) sends Enemies continuously, HA3-style, from the ramp table in
`src/core/tuning/director.ts`:

- `steps`: the ramp steps, rows of `{ from, onScreenCap, spawnInterval, fireRate }`; the ramp step whose `from`
  (seconds of ramp clock) last passed applies.
- `growth`: escalation never ends. Past the last ramp step, with `p = ln(1 + t / timeScale)` (`t` = seconds
  since it started), the fire rate rises by `growth.fireRate × p`, the spawn interval is divided by
  `1 + growth.spawnPace × p` and the on-screen cap rises by `growth.onScreenCap × p` (rounded down).
  Logarithmic growth has no plateau and no cliff: about one ramp step's worth in the first minute, then ever
  slower, and the cap is a soft one that keeps creeping up. `rampAt(director, seconds)` (exported from the
  core) is the lookup.
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

### Power-ups

`src/core/run/power-ups/` holds one file per Power-up plus the system. A `PowerUpDef` is either
**instant** (`apply(ctx)` runs once on pickup: Receso heals through `healRexi`, emitting `rexi-healed`) or
**timed**. A Power-up is timed exactly when its tuning entry in `tuning.powerUps` has a `duration`
(`TimedPowerUpId`); the catalog's type enforces the matching def kind.

- The system (`system.ts`) owns timed Power-ups: on pickup it stores `{ ticksLeft, totalTicks }` in
  `RexiState.powerUps` and emits `power-up-started` (`refreshed: true` when an active one is picked up
  again, which restarts it at full duration); each tick it counts them down and emits `power-up-ended`.
  One collected on Run tick T is active for the rest of T and the next `duration − 1` ticks. Pausing
  freezes them with the Run.
- The view lists them in pickup order as `RexiView.powerUps` (`id`, `ticksLeft`, `totalTicks`); the HUD
  draws one framed icon + seconds-left row per entry under the Weapon slot, with a bar that drains
  over `totalTicks` (the icon blinks in the last 2 s).
- **Effects live where they apply.** Each timed Power-up's file exports an effect hook built on
  `isPowerUpActive(rexi, id)` (`active.ts`), and the subsystem it changes calls that hook:
  `hasInmunidadJudicial` in `canHurtRexi` (all damage blocked; Enemy projectiles fly through),
  `rexiDamageMultiplier` in `damageEnemy` (Creatina, applied when a hit lands, so it covers every
  Weapon and splash), `enemyTimeScale` in `stepEnemies` and `stepProjectiles` (Pre-entreno), and
  `applyFlightThrust` / `stopAtFlightCeiling` around Rexi's body step in `stepRexi` (Día de Pierna).
- **Enemy time** (Pre-entreno): `stepEnemies` hands behaviors `DT * enemyTimeScale(ctx)`, so
  movement and attack cooldowns slow together; Enemy projectiles fly, home and age out (`ttl`) on
  the same scaled time. Rexi, his projectiles, Crates, the Director and the ramp clock keep real
  time. `enemy.age` and `projectile.age` still count ticks (animation only).
- **Flight** (Día de Pierna): while it is active and jump is held, thrust (stronger than gravity)
  pushes Rexi up until he climbs at `riseSpeed`; he stops at `ceiling` (hovering there while jump
  stays held), falls normally on release and when it ends. On touch the jump button drives it,
  since the core only sees the held `jump`. `RexiView.flying` is true on thrusting ticks.
- The renderer reads `RexiView.powerUps` for looks: Inmunidad's glow (`layers/rexi.ts`), and in
  `layers/power-up-effects.ts` Pre-entreno's cool tint over the slowed world (a world layer under
  Rexi) with speed lines behind him, and Día de Pierna's boot jets (from `flying`). Each flickers
  in its last 2 s.

Combat rules (`src/core/run/projectiles.ts`, `src/core/run/rexi.ts`): Rexi's projectiles hurt Enemies;
Enemy projectiles (`owner: 'enemy'`, spawned from an Enemy's `update` with `spawnProjectile`) hurt Rexi.
A hit emits `rexi-hit` and starts the hurt reaction (`RexiView.hurtTicks`) and the invulnerability window
(`RexiView.invulnerableTicks`); while it lasts, Enemy projectiles fly through him. Projectiles are removed on a
hit, at the ground (unless they bounce), off-screen or when their lifetime runs out. A projectile spawned with `homing`
steers: each tick it turns toward the nearest live Enemy (Rexi, for Enemy projectiles) by at most `turnRate`,
keeping its speed, for its whole flight (Citaciones Teledirigidas) or only its first `duration` seconds (the Banca
Artillada's rockets, which add `thrust` and a harmless `blast` burst). Instant Weapons resolve their hits inside `fire` instead of
spawning projectiles: Sentencia Firme casts a ray to the screen edge or the ground, calls `damageEnemy` on
every Enemy along it (nearest first) and leaves a fading trace with `traceBeam`. An Enemy projectile with a `blast`
(the Archivador Artillado's drawer, the Banca Artillada's rockets) explodes like Rexi's (see "Weapons and the inventory"), but its splash hurts
only Rexi. Behaviors that telegraph an attack report it through their optional `pose(memory, tuning)`, which
becomes `EnemyView.pose` (`attack: 'windup'` with `windup` rising 0..1), so the renderer can animate the telegraph. When Rexi's health reaches zero the Run emits
`run-ended` (score, Enemies destroyed, ticks survived) in that same tick, sets `RunView.ended` and stops
advancing (it can no longer be paused); the Game then plays the defeat beat and opens the Veredicto (see Screen flow).

### Combat feedback (effects)

Hit flash, explosions, debris and screen shake are simulated in the core (`src/core/run/effects/`)
so they are deterministic and testable through the view (`RunView.effects`, `EnemyView.hitFlash`).
They are cosmetic: they draw from their own `Rng` stream (seeded with `deriveSeed(seed, …)`), never
from the gameplay `rng`, and gameplay never reads them — tuning effects can't change how a Run plays.

- Verbs for other subsystems: `flashEnemy` (called by `damageEnemy` on every hit), `shatterEnemy`
  (on destruction: debris + the kind's explosion preset), `explode(ctx, at, 'small' | 'large')` and
  `addShakeTrauma` for explosive Weapons or Rexi getting hurt, and `traceBeam(ctx, from, to)` for beam
  Weapons (`RunView.effects.beams`, each with an `intensity` that falls from 1 as it fades; the renderer
  draws it as runs of rectangles in `src/render/effects/beam.ts`).
- Particles live in a bounded pool (`tuning.effects.maxParticles`, oldest dropped first) and are
  culled when their life ends or they leave the screen; debris settles on the ground, rests, then blinks out.
- Screen shake is trauma-based: events add trauma (0..1), it decays linearly, and the view's
  `effects.shake` is `maxOffset × scale × trauma² × noise(t)` rounded to whole pixels
  (`tuning.effects.shake.scale = 0` disables it). The renderer clamps it to the Arena's bleed
  (`ARENA_BLEED`, 12 px; see "Seam 2"), so the screen edge never uncovers the letterbox.
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
director draws from its own seeded stream (`deriveSeed(seed, QUIP_STREAM)` in `game.ts`), so talking
never changes gameplay randomness. Events: `quip-started`, then `hit-stop-started` (`ticks` frozen, from
the next tick) in the same tick, `hit-stop-ended` on the last frozen tick (or when a new Quip
restarts it, or the Run is abandoned during it), `quip-character` (one per
visible character, for the blip) and `dialogue-closed`; the view exposes `run.hitStop` and
`run.dialogue`. The typewriter's `revealRate` (its speed between pauses) is set so that, with the
clause and sentence pauses, the Quip catalog reveals at about 40 chars/s on average (the spec's rate;
`tests/core/quip-director.test.ts` measures it over every Quip).

Units: tuning values are seconds, pixels and px/s; the core converts to ticks with `secondsToTicks`.
Positions are game coordinates (640×360); boxes use their top-left corner.

**Resolution history.** The game ran at 480×270 until the art-quality pass (#24, #32) moved it to
640×360 so sprites can carry more detail. The move was one scale step: every spatial tuning value
(positions, sizes, hitboxes, speeds, accelerations, gravity, jump speed, ranges, splash radii,
platforms, spawn and altitude bands) was multiplied by 4/3 and rounded to the nearest whole pixel
(half-pixel offsets such as Rexi's shoulder kept at .5); time values did not change. Gravity and
jump speed were rounded so a full jump stays 4/3 as high (about 78 px), and the platform
reachability tests still hold. The catalog holds the resulting literal numbers, not a multiplier.

**Sprite sizes.** Every sprite is drawn at 640×360 scale (#26–#29). The Enemies, projectiles and
debris are pipeline art (#27): each Enemy's sprite fills its real hitbox, placed by its hitbox
offset from the exported art layout (`placeBody`). The icons are 16×16 (#29). Rexi is redrawn (#26): 64 px tall, with a 22×60 hitbox
(`tuning.rexi`) whose shoulder matches the drawn arm and whose `muzzleReach` (38 px) is the
Mazo Automático's tip. Shots of every Weapon leave from there; the shorter held looks (the
dumbbell, the book) draw their muzzle flash at their own tip (`rexiArt.arms[...].reach`).

## Seam 2: the renderer

`createRenderer(bitmapFactory, { titleIllustration? }).render(surface, view)` draws one full frame.
It dispatches on `view.screen` through a `Record<ScreenKind, …>` of drawers; menu screens live in
`src/render/screens/` (shared panel, keycap, outlined-text and dimmer helpers in `ui.ts`). The Title draws
`titleIllustration` (`public/title.png`, decoded by the platform; snapped to the master palette by
`scripts/art/characters/rexi_refs.py title`) when given, else a code-drawn backdrop,
then, in the left column over the illustration's empty sky, the logo, the top 10 (`high-scores.ts`, a
solid dark panel), the start prompt on a dark plate and the outlined credits line; Rexi stays uncovered on
the right. `verdict.ts` draws the defeat beat (the frozen Run dims
in two dither steps under the HUD, with a banner) and the Veredicto (a court record over the dimmed Run:
stats counting up, a stamp with the outcome, the ruling and the signature line; the court seal,
the gavel and the wax seal are pipeline sprites from `src/render/art/generated/record.ts`). Menu screens,
the HUD (`src/render/hud/`), Crates and the Dialogue Box frame draw with master-palette colors only;
the Weapon and Power-up icons are 16×16 pipeline sprites (`src/render/art/generated/icons.ts`) shared
by the HUD, the Crates and Cómo jugar. Frames, plates, the parachute and the stamps are hand-authored
palette data drawn in code (shared frame helpers in `src/render/frame.ts`: `fillCutRect`, `drawPlate`
for the dark plates of the HUD and the share card, `drawCornerBrackets`), not pipeline art: #29
uses the pipeline only where generated art helps (icons, the court record).

- **Determinism rule**: the renderer only uses `Surface.fillRect` (integer-snapped solid rectangles) and
  `Surface.drawBitmap` (unscaled pre-rasterized bitmaps at integer positions). No paths, arcs, gradients or
  canvas text. That makes output pixel-identical in browsers and in Node.
- **Sprites are palette-indexed data** (ADR 0002): `defineSprite(palette, rows)` is a palette-indexed
  pixel grid; `decodeSprite` (`sprite-data.ts`) turns the art pipeline's compact run-length data into
  the same `SpriteDef`. The `SpriteBank` rasterizes each sprite once on first use through the
  platform's `BitmapFactory`. Characters, Enemies, projectiles, icons, the Arena and the court
  record are exported pipeline art; frames, plates, Crates, the parachute, stamps, the crosshair
  and the touch controls are small hand-authored palette data, and effects are code.
- Layers are listed back to front in `src/render/renderer.ts`: `WORLD_LAYERS` are drawn offset by the
  screen shake (clamped to `ARENA_BLEED`: the Arena's four layers extend 12 px past every screen
  edge, mirrored about it, so a shaken frame shows more Arena instead of the letterbox),
  `SCREEN_LAYERS` stay fixed: the HUD (`src/render/hud/`), then the Dialogue Box
  (`src/render/dialogue/`), then the crosshair. When paused, the world layers and the frozen Dialogue
  Box are drawn without HUD and crosshair, dimmed with a checkerboard, then the HUD and the pause menu
  go on top.
- Hit flash is generic: `drawEnemies` wraps a hit Enemy's drawer in `silhouetteContext`, which turns
  rectangles and sprites into a white silhouette, so Enemy drawers need no flash code.
- Enemy drawers read `EnemyView.pose` for what the behavior wants shown: `facing` (null when the
  behavior leaves it to the drawer, e.g. the Maletín-cóptero faces Rexi), the `attack` phase
  (`idle`, `windup` to telegraph, `firing`) and `windup`, the telegraph's progress 0..1 (e.g. the
  Archivador Artillado's drawer sliding out of the bay). It is the only telegraph channel.
- Animation phase comes from `view.tick`, `enemy.age`, `projectile.age` — never from a clock.
- **Rexi** (`src/render/rexi/`) is pipeline art (`scripts/art/characters/rexi.py`, exported to
  `src/render/art/generated/rexi.ts`; `art.ts` wraps it). `pose.ts` picks the body frame from
  `RexiView` and the Run tick through the pipeline's animation table: idle (breath, blink), the
  8-frame run (reversed when backpedaling), rise/apex/fall from `vy` and the landing squat from
  `landedTicks`, the hurt frames over `hurtTicks`, the red blink over `invulnerableTicks` (every
  color mapped onto the red ramp, so it stays on the palette), and the shot's recoil and muzzle
  flash from `shotAge` (3 frames over one Mazo Automático fire interval). `layers/rexi.ts` draws
  the body frame with its soles on the hitbox's bottom row, then the aiming arm, pre-rotated with
  RotSprite into 9 angles (`arm.ts` picks one of 16 directions; facing left mirrors), at the
  frame's shoulder, holding the current Weapon's look from `held-weapons.ts` (a
  `Record<WeaponId, …>`, so a new Weapon must add its held look there), then the robe's lapel over
  the arm's root and the muzzle flash. Inmunidad Judicial outlines the whole figure; Día de
  Pierna's jets fire from the frame's boot soles (`bootsOf`, `layers/power-up-effects.ts`).
  Rexi's sleeve tattoo (right upper arm, shoulder to elbow; CONTEXT.md) is on whichever part is
  his right arm for the facing. Facing right the camera sees his right side: the near arm wears
  it and he aims with the far arm. Facing left the near arm is plain and the aiming arm wears it.
  So the body frames come in both facings, not just mirrored, and the arm comes inked and plain.
  The Dialogue Box portrait (`src/render/art/generated/rexi-portrait.ts`) flexes his inked right
  arm too.

## Palette

`masterPalette` (`src/render/palette.ts`) is the game's one curated palette: 56 named colors in the
style of a 16-bit palette (ADR 0002). `paletteRamps` lists them as ramps, dark to light: robe,
grey (trousers, smoke, marble, tank top), skin, hair, leather (boots, benches, the Ledges'
mahogany), red (gym), brass (the Ledges' lip and fittings), stone (plaza, courthouse), steel (guns,
rotors, casings), sky, glass, neonCyan, neonPink, neonLime, fire and foliage. The swatch golden
`palette-swatches` shows every color. The art pipeline reads both from this file
(`scripts/art/palette.py`) and snaps each asset to the ramps of its class (characters never use
sky, glass, neon or foliage).

- **Rules**: draw only with `masterPalette` colors, named (`masterPalette.skin3`), never hex
  literals. No blending or alpha: the renderer must put exact palette colors on screen.
  `masterPalette.outline` (pure black) is for outlines only.
- **Ramps are hue-shifted**: shadows lean purple/blue, highlights lean warm yellow. To shade a
  material, step along its ramp (base, one step down for shadow, one up for light). Never darken
  or lighten a color by hand. Ramps share colors on purpose (`coral` is the gym-red highlight and
  a sunset band; `leather3` is the brass shadow; `skyPeach` and `sunYellow` are both sunset and
  fire), which keeps the count down and the scene unified. The steps added for the art pass:
  `robeMid` (robe folds), `skinWarm` (muscle midtone), `steel1`–`steel3`, `stoneLight`,
  `redLight` (gym red and the fire's ember), `skyViolet`, `skyPeach`, `sunYellow`, `leafDeep`,
  `leafMid`, `leafLight`, `neonTeal`, `neonBlush` and `neonLime`.
- **Checking**: `src/render/palette-audit.ts` finds off-palette colors in rendered pixels
  (`findOffPaletteColors`) or sprite definitions (`findOffPaletteSpriteColors`), each with its
  nearest palette color. Tests use `expectOnPalette` and `loadGoldens` from `tests/support/palette.ts`.
  `tests/render/palette.test.ts` checks every exported pipeline sprite module and **every golden
  frame** (#30), the Title over its illustration included: an off-palette pixel anywhere fails with
  a report naming the color, where it first appears and its nearest palette color.
  `tests/render/ui-palette.test.ts` also draws the HUD, Crates, Dialogue Box frame, touch controls,
  pause menu and Veredicto alone over a palette color, and `tests/render/arena.test.ts` checks the
  Arena's sprites and rectangles.
- **Consistency pass (#30)**: every asset was reviewed side by side in the goldens and on a
  sheet of every Enemy shot drawn over each part of the Arena (sky bands, marble courthouse,
  night skyline, glass tower, Boissons, plaza). Outline weight is 1 px black everywhere (Rexi,
  Enemies, projectiles, icons, ledges), the key light comes from the upper left on every
  sprite against the backlit sunset, and the saturated sunset scene matches the saturated
  characters, so none of those needed changes. Readability did: the Caminadora's bullet
  tracer (thin dotted pixels lost over the orange sunset band) is now an unbroken 2 px
  white-hot streak, the Banca's rocket (a dark body lost over the skyline and the blue glass)
  gets a bigger exhaust with a white-hot core, and the crosshair (light strokes lost over the
  marble) is now fully outlined. Rexi, the Enemies, papers and drawers read everywhere thanks
  to their outlines. The title illustration was snapped to the palette (`rexi_refs.py title`).
- **A new color**: first try the nearest ramp step (`nearestPaletteColor` suggests one). If no
  step works, ask the owner, with a mock-up showing why. An accepted color gets a semantic name,
  goes into a ramp in `paletteRamps` in luminance order, and the swatch golden is updated. The
  palette stays at 56 colors or fewer, each name short enough for its swatch label (the palette
  test enforces both).

## Art pipeline

Gameplay art is generated pixel art made through `scripts/art/` (ADR 0002; workflow, commands and
manifest format in [`scripts/art/README.md`](../scripts/art/README.md)). It is a Python tool run
with `uv`, outside the game build: the game only ever sees the TypeScript it exports.

- **Art roots**: a directory with a `sheets.json` manifest, prompt files, templates, raw renders
  (with JSON sidecars), their reconstructed grids, and the cleaned sprites. `art/` is the
  production root; `reference/manu-pipeline/` is the version C prototype, kept reproducible
  (`npm run art:test` rebuilds its sprites from its grids and compares them byte for byte).
- **Flow**: `templates` (reference images on the model's 240-cell grid, size anchor inside) →
  `gen` (one edit through the creation-tool, refused past the $10 cap: CREDITS.md running total +
  uncredited `art/ledger.tsv` rows + the call's estimate) → `clean` (grid reconstruction, palette
  snap to the asset's class, slicing, canvases, hole fill; scenes from tiles, split into layers) →
  `bake` (RotSprite angles with pivots) → character scripts (code animation from the master,
  `scripts/art/characters/`) → `export` (palette-indexed TypeScript, pixel-text rows or run-length
  data) → `preview` (contact sheets) → `audit` (palette, alpha, outline). `credit` folds the ledger
  into CREDITS.md.
- **Contract with the renderer**: exported modules import `masterPalette`/`defineSprite` or
  `decodeSprite` and export `sprites` (plus animation tables and pivots as `as const` data). The
  run-length format is fixed by `src/render/sprite-data.ts`; `tests/render/sprite-data.test.ts`
  decodes a fixture written by the Python exporter, so the two cannot drift.
- Each area of the art pass (#24) swaps its code-drawn sprites for an exported module. Wired so
  far:
  - **Rexi and his Dialogue Box portrait** (#26).
  - **The icons and the court record ornaments** (#29, `exports.icons`, `exports.record`; their
    hand pass is in `scripts/art/ui/`).
  - **The Arena** (#28), `src/render/art/generated/arena.ts`: four 640×360 layers (sky, far
    skyline, buildings, plaza) from nine tile edits and one fix-up edit, assembled by `clean`
    and split by the hand-pass script `scripts/art/scenes/arena.py`; five clouds and two Ledges
    from a props sheet. The Ledges (#34) are redrawn by `scripts/art/scenes/ledges.py` from the
    props sheet's stone ledges as polished mahogany (leather ramp) with a brass lip for the
    walkable top and brass fittings underneath, keeping the outline and silhouette, so they stand
    out over the marble, the sunset sky and the glass alike. `src/render/layers/arena.ts` draws
    sky → drifting clouds → far → buildings → plaza → signs → platforms. The lettering (gym billboard, name plate, Boissons
    neon and chalkboard) is code (`arena-signs.ts`), because the image model cannot letter at
    1:1; the tile edits left those faces blank. Ambient animation (cloud drift, billboard bulbs,
    neon flicker) is a pure function of the Run tick.

## Brand art: logo, icons and share preview

`src/render/brand/` holds the art that represents the game outside a Run, all drawn in code with
master-palette colors only (a test in `tests/golden/brand.golden.test.ts` checks the sprites).

- **Logo** (`logo.ts`): built once into one sprite (`LOGO`, 236×92). REXI'S (chrome) over REVENGE
  (sunset gold) in custom letterforms (`logo-glyphs.ts`, a coarse 10-row grid upscaled 2× / 3× with
  EPX, `mask.ts`), each with a 2 px black outline, an extrusion down and to the right and a shine
  band; a gavel crossing behind (`gavel.ts`, rasterized from shapes at any angle) and a dumbbell
  underline. `drawLogo(surface, sprites, x, y, tick)` adds a shine sweep and a twinkle every
  `SHINE_PERIOD` ticks as small overlay sprites; the Title drives it with `screenAge`.
- **Icons** (`icons.ts`): the favicon (a gavel on the 45° pixel lattice, crisp at 16, 32 and 48 px)
  and the app icon art (48×48: the gavel over a striped sun, opaque).
- **Share card** (`share-card.ts`): the link preview at game pixel density (600×315, a window into
  the 640×360 title illustration): the title
  illustration, the logo with its twinkle and the tagline (`strings.share`).
- **Files**: `npm run share-preview` (`scripts/share-preview/`) renders these in Node with the game's
  renderer and writes `public/favicon.ico`, `favicon-{16,32,48}.png`, `apple-touch-icon.png` (180),
  `icon-{192,512}.png` (manifest) and `og-image.png` (the card at 2×, nearest-neighbor, 1200×630).
  `index.html` links them, with the Spanish description and Open Graph / Twitter tags; the image URL is
  absolute (`https://feauazmu.github.io/Rexi-s-Revenge/og-image.png`). `tests/content/share-preview.test.ts`
  checks the tags, that every referenced file exists, and that the committed images match the renderer:
  after changing the logo, icons, card or `public/title.png`, re-run `npm run share-preview`.
  At 640×360 (#29) the logo and the card were checked again: `npm run share-preview` reproduces the
  committed files unchanged.

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

`src/platform/shell.ts` creates the 640×360 canvas, applies `computeViewport`, and runs a
`requestAnimationFrame` loop. `computeViewport` takes a scaling mode; either way the image is centered
with black letterbox/pillarbox bars, its offsets are snapped to device pixels, and the canvas keeps its
640×360 backing store with nearest-neighbor display (`image-rendering: pixelated`), so only its CSS size
changes:

- `integer` (the default, used on desktop): the largest whole device-pixel scale that fits, never below 1
  (2× at 720p, 3× at 1080p, 4× at 1440p), so every game pixel is a perfect square.
- `fit` (used for the `touch` device kind): the largest fractional scale that fits, so the game fills the
  height (or width) of the screen. On an iPhone in landscape the browser bars leave less than 360 CSS px,
  where whole factors would drop from 3× to 2× and cover about half the screen. At DPR 2–3 the uneven
  pixel widths are a fraction of a physical pixel and not visible.

It also takes safe-area insets: the image is fitted and centered in the container minus them, with
offsets still relative to the whole container. Installed on an iPhone home screen
(`apple-mobile-web-app-capable`, `black-translucent` status bar, `viewport-fit=cover`), the page draws
under the status bar and notch; the shell reads `env(safe-area-inset-*)` from the computed padding of a
hidden `.safe-area-probe` element on every layout (resize, rotation), so the notch and home indicator
never cover the Arena, HUD or touch controls. Elsewhere the insets are zero.

`screenToGame` / `screenToGameUnclamped` map pointer and touch points through the resulting `cssScale` and
offsets, so mouse aiming and the touch adapter need no per-mode cases. `createFixedStepper`
converts frame times into whole ticks (clamped to 5 per frame), so speed is identical at 60/120/144 Hz.
Each tick samples the device's input adapter once (edges are consumed by the first sample).
On `blur` or `visibilitychange` to hidden it calls `game.pause()`. It mirrors `view.screen` to
`#app[data-screen]`, which the smoke tests poll (also `data-device`, `data-orientation` and
`data-touch-controls`).
Fullscreen wiring lives in `attachFullscreen(game, root, { device, support, onChange })` (see
[Fullscreen](#fullscreen)); the shell attaches it once, passes each tick's events to its `handle` and
`dispose`s it on `stop()`.
`ShellOptions.onEvents` receives every tick's events — the audio engine plugs in there (`src/main.ts`).
`Shell.view` exposes the Game's view so adapters can read their starting state (the persisted mute).
`src/main.ts` decodes the title illustration (`loadTitleIllustration`, from the base URL) before starting
the shell and passes it as `ShellOptions.titleIllustration`; if it cannot be loaded, the Title uses its
code-drawn backdrop.

### Fullscreen

The fullscreen support is chosen once at startup (`src/platform/fullscreen.ts`, pure
`chooseFullscreenSupport` like the device chooser) and passed to the Game as `GameOptions.fullscreenSupport`
(UI only, never gameplay): `toggle` when the Fullscreen API is available and the game is not installed
(display mode `standalone`/`fullscreen`, or iOS's `navigator.standalone`); `install-hint` on iOS/iPadOS
(an iPhone/iPad/iPod user agent, or a touch "Macintosh", which is how iPadOS reports itself) without the
Fullscreen API and not installed, which covers every iPhone browser since all are WebKit; else `none`.
`?fullscreen=toggle|install-hint|none` overrides it. Known edge: `(display-mode: fullscreen)` also matches a
browser tab already in F11 fullscreen, so a page loaded that way shows no toggle until it is reloaded outside it.

- **Title hint**: with `install-hint`, the Title footer shows "Pantalla completa: Compartir → Añadir a inicio"
  between the start prompt and the credits line; the pause menu has no fullscreen item.
- **Pause menu**: `pauseMenuItems(support)` lists Continuar, Silenciar música, Pantalla completa (only with
  `toggle`) and Salir; navigation wraps over that list. The item draws an on/off box from `view.fullscreen`.
- **Request**: choosing Pantalla completa emits `fullscreen-toggle-requested` with the desired state
  (`!view.fullscreen`). The Game does not change `fullscreen` itself.
- **Controller**: `attachFullscreen` (in `src/platform/fullscreen.ts`) does the browser side for the shell.
  Its `handle(events)` turns each request into `requestFullscreen()` / `exitFullscreen()` (on the next tick,
  inside the browser's transient user-activation window of the key press or touch); refusals are ignored.
- **First touch**: on touch devices with `toggle`, the first `touchend` on the page (the Title tap) requests
  fullscreen inside the handler, so it counts as a user gesture; once per page load, whatever the outcome.
  Desktop enters fullscreen only through the pause menu.
- **Landscape lock**: whenever a touch device enters fullscreen (first touch or the pause menu), the
  controller then calls `screen.orientation.lock('landscape')` (Android; desktop and iOS refuse), so tilting the phone
  mid-Run doesn't freeze it behind the rotate prompt. Refusals are ignored; the browser releases the lock when
  the page leaves fullscreen. Both rules come from the pure `chooseFullscreenBehavior(device, support)`,
  which the controller passes to both entry paths.
- **Mirror**: on `fullscreenchange` (including leaving through the browser: Esc, the back gesture) and once
  at startup, the controller calls `game.reportFullscreen(active)`, which `view.fullscreen` reflects right
  away; after each change it calls `onChange`, so the shell redraws.

### Touch controls

The device kind is chosen once at startup (`src/platform/device.ts`): `touch` when the primary pointer is
coarse (`(pointer: coarse)`), else `desktop`; `?device=touch|desktop` overrides it. A touch device uses only
the touch adapter (no keyboard/mouse adapter, so a finger is never also a mouse click).

- **Layout** (`src/render/touch/layout.ts`): every control's position in game coordinates, plus
  `touchButtonAt`. The renderer draws from it and the adapter hit-tests against it, so they cannot drift.
  `TOUCH_MODES` gives each screen a mode: `tap` (Title, Cómo jugar: any touch is `start`), `play` (Run) or
  `menu` (pause menu, Veredicto initials entry, and any screen that navigates with `menu` edges). On
  touch devices the Veredicto shows a one-line hint (cruceta/deslizar, gold button) instead of keycaps.
- **Controller** (`src/platform/touch/controller.ts`): pure, no DOM. Fingers (pointer id + game point) in;
  `sample(view)` gives one `InputFrame` per tick and `overlay(view)` the `TouchOverlayView` to draw. A finger
  gets its role when it lands (button, stick, swipe) and keeps it until it lifts. `touch.ts` is the DOM side:
  pointer events with capture (multi-touch), converted with `screenToGameUnclamped`.
- **Stick math** (`src/platform/touch/stick.ts`): pure. Sticks float (the base appears under the thumb and
  is dragged along past the rim); radial dead zone of 20% rescaled from its edge; movement saturates at 60%
  deflection.
- **Play mode**: left half = move stick, right half = aim stick (aims from Rexi's shoulder and fires for as
  long as it is held, even resting inside the dead zone; only a push past the dead zone changes the aim, so a
  thumb at rest keeps firing along the last aim, or the way Rexi faces before any aim. It keeps its last
  direction when released; while it is idle Rexi faces where he walks). Jump button (bottom right of center), pause button (top right, under the score), and the HUD Weapon
  icon is a button: a tap is `weaponNext`.
- **Drop through platforms**: pull the move stick down past 60% deflection, within 45° of straight down
  (the keyboard's S/↓). The 45° cone means running with a downward slant never drops by accident, and it needs
  no extra button on a crowded screen.
- **Menu mode**: a d-pad (bottom left), confirm ✓ and back ✕ (bottom right), and swipes anywhere else
  (≥ 32 game px, dominant axis, on release) produce `menu` edges. This covers the pause menu and initials
  entry without the adapter knowing any menu's layout.
- **Overlay** (`src/render/touch/overlay.ts`): drawn last by `render(surface, view, overlay)`. Idle controls
  are dithered outlines so the Arena shows through (no alpha: determinism rule); held controls turn solid.
- **Portrait**: the shell hides the game canvas, freezes the game (pausing a Run) and draws the "Gira tu
  teléfono" prompt (`renderer.renderRotatePrompt`) on a separate 192×340 canvas, scaled like the game (same scaling mode).

**Manual check on a real phone** (emulation covers the rest in `e2e/touch.spec.ts`): open the site in
landscape → "Toca para empezar" → tap → Cómo jugar (touch) → tap → Run: move with the left stick, pull it
down on a ledge to drop, aim/fire with the right stick while jumping, tap the Weapon icon, pause and resume
with the pause and ✕ buttons; let Rexi die → Veredicto → enter initials with the d-pad/swipes and ✓ → Title.
Turn the phone upright mid-Run: the rotate prompt shows and the Run is paused.

## Audio

`src/platform/audio/` turns Game events into synthesized sound effects and plays the soundtrack. The
effects are code, like the art; the only audio file is the music loop, `public/music/theme.mp3`.

- **Synth** (`synth.ts`, pure): a small sfxr-style synthesizer. A `SynthPatch` is a few layers
  (square/saw/triangle/sine/noise, exponential pitch slide, steps, vibrato/tremolo, attack-hold-punch-decay
  envelope, swept state-variable filter, delay), mixed, optionally soft-clipped (`drive`) and normalized to
  `peak`. `renderPatch` renders it offline to samples; it is deterministic and tested in Node.
- **Presets** (`presets.ts`): the sound catalog, `SOUND_PRESETS[id]` = patch + voice rules (`maxVoices`,
  `priority`, `minGap`), `pitchJitter` and noise `variants`. Some presets wait for content later tickets
  add (the cannon).
- **Sound map** (`sound-map.ts`, pure): `soundForEvent(event)` → `{ sound, pan? }` or null. A
  `Record<GameEventType, …>` rule per event kind, plus `WEAPON_SOUNDS` (`Record<WeaponId, …>`),
  `ENEMY_FIRE_SOUNDS` (`Record<EnemyKind, …>`) and `EXPLOSION_SOUNDS` (by the Enemy's tuned `explosion`
  size). Explosions pan with the Enemy's x. An `explosion` event (any explosive projectile, Rexi's or an
  Enemy's) plays `EXPLOSION_SOUNDS[size]` for its blast's preset and pans with the blast's x.
- **Voice limiter** (`voices.ts`, pure): per-sound voice caps (the oldest voice of the same sound is
  stolen), a global cap (the oldest voice of the lowest priority is stolen; a new voice that matters less
  than everything playing is dropped) and a `minGap` that drops same-tick duplicates.
- **Engine** (`engine.ts`): creates the `AudioContext` only in a user gesture (`listenForAudioUnlock`
  keeps listening, so a context the browser suspends later resumes on the next gesture), renders every
  preset into an `AudioBuffer` once, and plays each cue as a buffer source → gain (→ panner) → effects bus.
  Mix: effects bus and music bus → master → compressor → speakers. "Silenciar música" (`mute-toggled`,
  and the persisted flag at start) fades only the **music bus**.
- **Music** (`music.ts`): `createMusicPlug({ track: MUSIC_TRACK, load })` starts fetching the MP3 at boot
  and returns the plug for `engine.connectMusic((context, musicBus) => …)`, which runs once audio is
  unlocked: it decodes the file and starts one `AudioBufferSourceNode` with `loop`, explicit `loopStart`
  and `loopEnd`, from `loopStart`. It is never stopped, so the music carries on across Title, Run, pause
  and Veredicto; mute fades the music bus. `MUSIC_LEVEL` balances the bus against the effects.
- **Music track** (`music-track.ts`, generated): file and loop points written by
  `scripts/music-loop/make-music-loop.ts`. The script decodes a generated clip (raw clips live in
  `reference/audio/`, outside the bundle), finds a bar-aligned loop (`loop-math.ts`, pure and tested:
  the longest bar count whose seam repeats, refined sample by sample), crossfades the seam, pads the body
  with 0.5 s of its own wrap-around audio on both sides (so the MP3 encoder delay, which browsers trim
  differently, cannot open a gap) and encodes the MP3 with LAME in WASM. Re-run it with
  `node scripts/music-loop/make-music-loop.ts reference/audio/music-candidate-2.mp3`; add `--analyze` to
  compare clips without writing anything.
- The shell mirrors the engine status to `#app[data-audio]` (`locked` → `running`, or `suspended`,
  `unavailable`), `#app[data-music]` (`on`/`muted`) and the soundtrack to `#app[data-music-track]`
  (`loading` → `playing`, or `failed`) for the smoke tests.

## Balance

Every balance number is in the tuning catalog (`src/core/tuning/`), so balancing is a data
change. `npm run balance` (`scripts/balance/`) measures it with **simulated play**: a scripted
player (`bot.ts`) plays real Runs through the public interface (input frames in, views out), from
the Title to the Veredicto, on fixed seeds, and `stats.ts` summarizes them. The bot plays like a
person with limits. It sees Enemy shots `reactionTicks` late, notices each one only with chance
`awareness`, decides every `decisionTicks` by simulating six move/jump plans against the shots'
predicted paths, aims with a wandering error and a partial lead, and may pick Weapons for the
situation. Three profiles set those limits: `casual`, `decent` (the one the balance targets) and
`expert`. Same seeds + same tuning = same numbers. `--tuning` tries overrides before you edit
the catalog, and `tests/scripts/balance.test.ts` keeps the harness honest.

**Target:** the median Run lasts about four minutes for the decent player, with skill showing
(casual about three minutes, expert five or more). The first minute should be a learning
stretch, and the difficulty should climb steadily rather than hit a cliff.

**Balance pass (#30)**, 100 seeds per profile, median survival (quartiles) and median score:

| Profile | Before                   | After                    |
| ------- | ------------------------ | ------------------------ |
| casual  | 2:37 (2:28–2:51), 7 250  | 3:07 (2:45–3:23), 8 700  |
| decent  | 3:00 (2:43–3:15), 10 150 | 3:50 (3:31–4:11), 14 750 |
| expert  | 3:50 (3:23–4:06), 14 600 | 5:08 (4:39–5:40), 21 850 |

- **Banca Artillada** (`tuning.enemies`): before, its rockets dealt 60–65 % of all damage the
  decent and expert players took. Most Runs ended within a minute of its arrival at about 2:00,
  so skill barely mattered (casual 2:37, expert 3:50). The rockets homed until about 0.25 s
  before impact, too late to outrun at Rexi's 160 px/s. Now they home for 0.5 s (was 1), so the
  last ~0.8 s of flight is straight and dodgeable. Volleys hold 3 rockets (was 4) every 6 s
  (was 5), and the first volley waits 4 s (was 3), so its arrival reads as a set piece. Rockets
  are now 35–40 % of the damage, in line with papers and bullets.
- **Ramp** (`tuning.director`): the middle ramp steps raise the fire rate more gently (1.05, 1.1,
  1.2, 1.3 at 1, 2, 3 and 4 minutes; was 1.1, 1.2, 1.3, 1.45), and the spawn interval eases from
  2.6 to 2.4, 2.2 and 2 s. The first minute is unchanged: an idle player still falls in 40–55 s.
  `growth` was unchanged then (it is endless now; see "Endless escalation" below).
- **Receso** (`tuning.crates.recesoBoost`): ×3 weight below 50 % health (was ×2 below 40 %),
  so collecting Crates while hurt pays off.
- **Mancuernas** (`tuning.weapons`): measured in play it dealt about 4 damage a throw and less
  damage per second than the Mazo Automático (5.3 against 6.6), which made picking it up a
  downgrade. It now throws every 0.75 s (was 0.94), with splash 6 over 44 px (was 4 over 37),
  and 18/36 ammo (was 15/30) to keep about 13 s of fire.
- **Unchanged, by measurement:** the other Weapons out-damage the Mazo while held (11–19
  damage/s against 6.6) and last 7–15 s each. Crate weights give 62 % Weapons, 38 % Power-ups,
  and about 40 % of drops are picked up. Quips trigger about 3.3–3.4 times a minute (chance 0.25,
  cooldown 4 s), and Hit-stop (0.5 s, the spec's value) takes about 3 % of Run time.

**Endless escalation (final review, #1).** `growth` was a step every minute up to hard limits
(cap 10, interval 1.2 s, fire rate 2, all reached by 11 minutes), so difficulty plateaued. It is now
logarithmic (see "Spawn Director and the ramp clock"), tuned to match the old steps for the first
minutes past 4:00: fire rate 1.3 → ~1.4 at 5:00 and ~1.65 at 10:00, interval 2 → ~1.9 s and ~1.65 s, cap
7 → 8 and 11, and still rising after that. The Archivador Artillado may now also enter from the top,
and the bot and the Quips draw from `deriveSeed` streams. 100 seeds per profile:

| Profile | Before (#30)             | After                    |
| ------- | ------------------------ | ------------------------ |
| casual  | 3:07 (2:45–3:23), 8 700  | 2:58 (2:39–3:20), 8 750  |
| decent  | 3:50 (3:31–4:11), 14 750 | 3:54 (3:29–4:24), 15 200 |
| expert  | 5:08 (4:39–5:40), 21 850 | 5:04 (4:25–5:36), 21 350 |

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
   It may spawn just outside the Arena: it must fly itself in. If the drawer needs to know which way it
   faces or when (and how far) it winds up and fires, add `pose(memory, tuning)` (it becomes `EnemyView.pose`).
5. Register it in `src/core/run/enemies/index.ts` (one line).
6. Make its art through the pipeline (`scripts/art/README.md`: a sheet in `art/sheets.json`, the hand
   pass and debris rectangles in `scripts/art/enemies.py`, exported to `src/render/art/generated/enemies.ts`),
   draw it in `src/render/enemies/<kind>.ts` (placed with `placeBody` by its `HITBOX` offset in `enemies.py`, plus code-driven
   rotors, flames and telegraphs) and register the drawer and its debris chunks in
   `src/render/enemies/index.ts`. The drawer also gets the `RunView` (e.g. to face
   Rexi).
7. Give it a firing sound in `ENEMY_FIRE_SOUNDS` (`src/platform/audio/sound-map.ts`); its explosion sound
   follows its tuned `explosion` size.
8. Test through the public interface: stage it with `overrides.spawns`, drive inputs, assert events/view.
   Test its Director arrival time by overriding `director` tuning. Add a golden if it has a look.

`Record<EnemyKind, …>` catalogs make the typecheck fail until steps 2, 3, 5, 6 and 7 are done.

### A Weapon

1. Add the id to `WEAPON_IDS` (and any new projectile kind to `PROJECTILE_KINDS`) in `src/core/ids.ts`.
   Its position is its inventory slot (number key).
2. Add its tuning entry in `src/core/tuning/weapons.ts`: an archetype interface extending
   `WeaponTuningBase` (pick or add one) `& AmmoTuning` (`pickupAmmo`, `maxAmmo`).
3. Give it a Crate weight in `tuning.crates.weights.weapons` (`src/core/tuning/crates.ts`). That alone makes
   it Crate content; the Crate system and inventory need no changes.
4. Implement `src/core/run/weapons/<id>.ts` exporting a `WeaponDef` whose `fire(shot, ctx)` spawns
   projectiles with `spawnProjectile`, composing its behavior options (`gravity`, `bounce`, `thrust`,
   `blast`, `trailInterval`; see "Weapons and the inventory"). The Weapon system already handles
   switching, trigger, cooldown, ammo and `weapon-fired`.
5. Register it in `src/core/run/weapons/index.ts`.
6. Draw new projectile kinds in `src/render/projectiles/<kind>.ts` and register them in
   `src/render/projectiles/index.ts`.
   Its sprite comes from the pipeline (`art/projectiles/`, exported to
   `src/render/art/generated/projectiles.ts`). One that turns with its heading or spins gets a
   RotSprite `parts` bake and is drawn with `drawAimed` or `drawTumbling`
   (`src/render/projectiles/turned.ts`, `tumble.ts`), like the law book and the dumbbell.
7. Make its 16×16 icon (also shown on Crates and in Cómo jugar) through the art pipeline: a cell in the
   `icon_cells` grid (`art/sheets.json`), then `templates` → `gen` → `clean icons` → the hand pass in
   `scripts/art/ui/icons.py finish` → `export icons` (`scripts/art/README.md`, "UI art"), and map the
   exported sprite in `weaponIcons` (`src/render/hud/weapon-icons.ts`). Draw its
   look in Rexi's fist (pixel text in `WEAPONS`, `scripts/art/characters/rexi.py`, rebuilt and
   exported, then mapped in `src/render/rexi/held-weapons.ts`), and add its Spanish name to
   `strings.weapons`.
8. Give it a firing sound in `WEAPON_SOUNDS` (`src/platform/audio/sound-map.ts`); most v1 Weapons already
   have a preset waiting in `src/platform/audio/presets.ts`.
9. Test it through a scripted Crate: `weaponCrate(id, ON_REXI.x, { y: ON_REXI.y })` from
   `tests/support/driver.ts` hands it to Rexi on the first tick.

### A Power-up

1. Add the id to `POWER_UP_IDS` in `src/core/ids.ts`.
2. Add its numbers to `src/core/tuning/power-ups.ts` (give it a `duration` — extend `TimedPowerUpTuning` —
   to make it timed) and its Crate weight to `tuning.crates.weights.powerUps`.
3. Implement `src/core/run/power-ups/<id>.ts` exporting its def and register it in
   `src/core/run/power-ups/index.ts`. Crates deliver it with no other change.
   - Instant: `{ id, kind: 'instant', apply(ctx) }`.
   - Timed: `{ id, kind: 'timed' }` — the system already handles the timer, events, view and HUD timer.
     Export an effect hook from the same file (`isPowerUpActive(ctx.state.rexi, id)` plus its tuning)
     and call it from the subsystem it changes, e.g. Pre-entreno scaling the `dt` the Enemy and
     Enemy-projectile steps use, or Día de Pierna adding thrust in `stepRexi`.
4. Make its 16×16 icon through the art pipeline, as for a Weapon (`scripts/art/ui/icons.py`, exported
   to `src/render/art/generated/icons.ts`), map it in `powerUpIcons` (`src/render/hud/power-up-icons.ts`)
   and add its Spanish name to `strings.powerUps`. A visible effect reads `run.rexi.powerUps` in the renderer
   (`src/render/layers/power-up-effects.ts`).
5. Give a timed one its start sound in `POWER_UP_START_SOUNDS` (`src/platform/audio/sound-map.ts`).
6. Test through a scripted Crate: `powerUpCrate(id, ON_REXI.x, { y: ON_REXI.y })` from
   `tests/support/driver.ts` hands it to Rexi on the first tick.

`Record<…Id, …>` catalogs (tuning, Crate weights, behavior, icons, names, start sounds) make the typecheck fail until
every step is done.

### A platform

Add `{ x, y, w }` (y = walkable top) to `arena.platforms` in `src/core/tuning/arena.ts`. Physics
(`src/core/run/physics.ts`) treats every platform as one-way and the renderer draws each as a mahogany
Ledge (the pipeline's 102 or 144 px Ledge, or its ends and repeated panels for any other width), so
no other code changes. Keep each one less than a full jump above the surface below it
(the layout tests in `tests/core/platforms.test.ts` check this).

### An event

Add an interface and one line to the `GameEvent` union in `src/core/events.ts`; emit it with `ctx.emit`.
Then decide its sound: a rule in `EVENT_SOUNDS` (`src/platform/audio/sound-map.ts`, null for silence) and a
row in the table test (`tests/platform/audio/sound-map.test.ts`); both fail to typecheck until you do.

### A sound

Add a preset to `SOUND_PRESETS` (`src/platform/audio/presets.ts`) and point an entry of the sound map at it.
Tune by ear in the dev server; the preset tests check it renders clean, click-free and within the mix levels.

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
- Title frames: pass `{ titleIllustration: await loadTitleIllustration() }` as `renderView`'s third
  argument to draw over `public/title.png`, as the browser does; without it, the code-drawn backdrop.
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
- Adapter logic is tested as pure functions (`viewport`, `fixed-step`, the `device`, fullscreen-support and
  fullscreen-behavior choosers, `keyboard-mouse` mapping, audio
  synth/sound map/voice limiter, touch `stick` math and the touch `controller`, which is driven with real
  views from `drive()`); the audio engine runs against a fake `AudioContext`.
- Touch goldens (`tests/golden/touch.golden.test.ts`) feed the controller's frames into the core and render
  the view with its overlay, as the shell does.
- Smoke tests (`e2e/`) run the production build in Chromium, on desktop and on an emulated phone.
  Each one plays a whole Run, from the Title to the Veredicto, signs it and returns to the Title.
  `page.clock` fakes `requestAnimationFrame`, so a minute of play runs as fast as it renders, and
  `?seed=1` fixes the Run. The phone test drags the aim stick with real touch input through CDP
  (`Input.dispatchTouchEvent`).

## Commands

| Command                 | What it does                                                      |
| ----------------------- | ----------------------------------------------------------------- |
| `npm run dev`           | Vite dev server (`/Rexi-s-Revenge/`); `?seed=N` fixes the seed    |
| `npm run typecheck`     | `tsc` for the project and the headless core/renderer              |
| `npm run lint`          | ESLint + Prettier check (`npm run format` fixes)                  |
| `npm test`              | Vitest: unit, core and golden tests                               |
| `npm run golden:update` | Re-render and overwrite golden PNGs                               |
| `npm run share-preview` | Re-render the favicons, app icons and link preview in `public/`   |
| `npm run balance`       | Simulated play over seeded Runs (see "Balance")                   |
| `npm run art -- <cmd>`  | The art pipeline (`scripts/art/README.md`; needs `uv`)            |
| `npm run art:test`      | The art pipeline's Python tests                                   |
| `npm run build`         | Production build to `dist/`                                       |
| `npm run smoke`         | Build, serve and run Playwright (`SMOKE_PORT` to change the port) |
| `npm run check`         | All of the above, as CI does                                      |

CI (`.github/workflows/ci.yml`) runs typecheck, lint, tests, build and smoke on every push and deploys
`main` to GitHub Pages.
