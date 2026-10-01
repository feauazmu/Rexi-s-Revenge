/**
 * Power-ups: Receso (instant heal), and the timed Inmunidad Judicial, Creatina, Pre-entreno and
 * Día de Pierna, with their durations, HUD timers (view), started/ended events and Crate weights.
 */
import { describe, expect, it } from 'vitest';
import {
  DT,
  defaultTuning,
  POWER_UP_IDS,
  secondsToTicks,
  SPECIAL_WEAPON_IDS,
  type ScriptedSpawn,
  type GameEventType,
  type InputFramePatch,
  type ProjectileView,
  type TimedPowerUpId,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import {
  drive,
  driveEmptyArena,
  eventsOf,
  ON_REXI,
  powerUpCrate,
  runOf,
  type Driver,
} from '../support/driver';
import { holdStill } from '../support/fixtures';

const powerUps = defaultTuning.powerUps;
const mazo = defaultTuning.weapons['mazo-automatico'];
const onRexi = { y: ON_REXI.y };

/** A Maletín-cóptero that fires often and aims true, so papers keep reaching Rexi. */
const sharpshooter: ScriptedSpawn = { kind: 'maletin-coptero', x: 300, y: 60 };
const sharpshooterTuning = (paperDamage = 5): TuningOverrides => ({
  enemies: {
    'maletin-coptero': {
      fireIntervalMin: 0.5,
      fireIntervalMax: 0.5,
      aimError: 0,
      paperDamage,
      health: 100_000,
    },
  },
});
const atSharpshooter = { x: 312, y: 69 };

describe('Receso', () => {
  it('restores the tuned share of max health, at once', () => {
    const pickupTick = secondsToTicks(5);
    const game = drive({
      overrides: {
        spawns: [
          sharpshooter,
          powerUpCrate('receso', ON_REXI.x, { ...onRexi, atTick: pickupTick }),
        ],
        tuning: sharpshooterTuning(15),
      },
    });
    game.ticks(pickupTick);
    const hurt = runOf(game.view).rexi;
    const heal = Math.round(hurt.maxHealth * powerUps.receso.healShare);
    expect(hurt.health).toBeGreaterThan(0);
    expect(hurt.health).toBeLessThanOrEqual(hurt.maxHealth - heal);

    const events = game.ticks(1);
    expect(eventsOf(events, 'crate-picked')).toHaveLength(1);
    expect(eventsOf(events, 'rexi-healed')).toEqual([
      { type: 'rexi-healed', amount: heal, health: hurt.health + heal },
    ]);
  });

  it('never heals above max health', () => {
    const game = driveEmptyArena({
      overrides: { spawns: [powerUpCrate('receso', ON_REXI.x, onRexi)] },
    });
    const events = game.ticks(1);
    const { rexi } = runOf(game.view);
    expect(eventsOf(events, 'rexi-healed')).toEqual([
      { type: 'rexi-healed', amount: 0, health: rexi.maxHealth },
    ]);
    expect(rexi.health).toBe(rexi.maxHealth);
  });

  it('is instant: no timer and no started/ended events', () => {
    const game = driveEmptyArena({
      overrides: { spawns: [powerUpCrate('receso', ON_REXI.x, onRexi)] },
    });
    game.seconds(1);
    expect(runOf(game.view).rexi.powerUps).toEqual([]);
    expect(eventsOf(game.log, 'power-up-started')).toHaveLength(0);
    expect(eventsOf(game.log, 'power-up-ended')).toHaveLength(0);
  });
});

/** Ticks a timed Power-up collected on Run tick 0 stays active. */
const durationOf = (id: TimedPowerUpId) => secondsToTicks(powerUps[id].duration);

describe('Timed Power-ups', () => {
  it('start on pickup, count down in the view and end after their tuned duration', () => {
    const ticks = durationOf('inmunidad-judicial');
    const game = driveEmptyArena({
      overrides: { spawns: [powerUpCrate('inmunidad-judicial', ON_REXI.x, onRexi)] },
    });

    const first = game.ticks(1);
    expect(eventsOf(first, 'power-up-started')).toEqual([
      { type: 'power-up-started', powerUp: 'inmunidad-judicial', ticks, refreshed: false },
    ]);
    expect(runOf(game.view).rexi.powerUps).toEqual([
      { id: 'inmunidad-judicial', ticksLeft: ticks, totalTicks: ticks },
    ]);

    game.ticks(ticks - 1);
    expect(runOf(game.view).rexi.powerUps).toEqual([
      { id: 'inmunidad-judicial', ticksLeft: 1, totalTicks: ticks },
    ]);
    expect(eventsOf(game.log, 'power-up-ended')).toHaveLength(0);

    expect(eventsOf(game.ticks(1), 'power-up-ended')).toEqual([
      { type: 'power-up-ended', powerUp: 'inmunidad-judicial' },
    ]);
    expect(runOf(game.view).rexi.powerUps).toEqual([]);
    game.seconds(2);
    expect(eventsOf(game.log, 'power-up-ended')).toHaveLength(1);
  });

  it('restart at full duration when collected again while active', () => {
    const ticks = durationOf('creatina');
    const again = secondsToTicks(3);
    const game = driveEmptyArena({
      overrides: {
        spawns: [
          powerUpCrate('creatina', ON_REXI.x, onRexi),
          powerUpCrate('creatina', ON_REXI.x, { ...onRexi, atTick: again }),
        ],
      },
    });
    game.ticks(again + 1);
    expect(eventsOf(game.log, 'power-up-started').map((e) => e.refreshed)).toEqual([false, true]);
    expect(runOf(game.view).rexi.powerUps).toEqual([
      { id: 'creatina', ticksLeft: ticks, totalTicks: ticks },
    ]);

    game.ticks(ticks - 1);
    expect(eventsOf(game.log, 'power-up-ended')).toHaveLength(0);
    game.ticks(1);
    expect(eventsOf(game.log, 'power-up-ended')).toHaveLength(1);
  });

  it('run side by side, listed in pickup order', () => {
    const game = driveEmptyArena({
      overrides: {
        spawns: [
          powerUpCrate('creatina', ON_REXI.x, onRexi),
          powerUpCrate('inmunidad-judicial', ON_REXI.x, { ...onRexi, atTick: 30 }),
        ],
      },
    });
    game.ticks(31);
    expect(runOf(game.view).rexi.powerUps.map((p) => [p.id, p.ticksLeft])).toEqual([
      ['creatina', durationOf('creatina') - 30],
      ['inmunidad-judicial', durationOf('inmunidad-judicial')],
    ]);
  });

  it('freeze while the game is paused', () => {
    const game = driveEmptyArena({
      overrides: { spawns: [powerUpCrate('creatina', ON_REXI.x, onRexi)] },
    });
    game.ticks(10);
    game.pause();
    game.seconds(30);
    expect(runOf(game.view).rexi.powerUps[0]?.ticksLeft).toBe(durationOf('creatina') - 9);
  });
});

/** Rexi hits on the sharpshooter, collected in windows of Run ticks. */
function hitsDuring(game: Driver, ticks: number): number {
  return eventsOf(game.ticks(ticks, { aim: atSharpshooter }), 'rexi-hit').length;
}

describe('Inmunidad Judicial', () => {
  it('blocks all damage while active; papers fly through Rexi', () => {
    const ticks = durationOf('inmunidad-judicial');
    const immune = drive({
      overrides: {
        spawns: [sharpshooter, powerUpCrate('inmunidad-judicial', ON_REXI.x, onRexi)],
        tuning: sharpshooterTuning(),
      },
    });
    const control = drive({ overrides: { spawns: [sharpshooter], tuning: sharpshooterTuning() } });

    expect(hitsDuring(control, ticks)).toBeGreaterThan(2);
    expect(hitsDuring(immune, ticks)).toBe(0);
    const { rexi } = runOf(immune.view);
    expect(rexi.health).toBe(rexi.maxHealth);
    expect(rexi.invulnerableTicks).toBe(0);
  });

  it('lets damage through again once it ends', () => {
    const game = drive({
      overrides: {
        spawns: [sharpshooter, powerUpCrate('inmunidad-judicial', ON_REXI.x, onRexi)],
        tuning: sharpshooterTuning(),
      },
    });
    game.ticks(durationOf('inmunidad-judicial') + 1, { aim: atSharpshooter });
    expect(hitsDuring(game, secondsToTicks(4))).toBeGreaterThan(0);
  });
});

describe('Creatina', () => {
  const target: ScriptedSpawn = { kind: 'maletin-coptero', x: 300, y: 60 };
  const tankyTarget: TuningOverrides = holdStill({
    enemies: { 'maletin-coptero': { health: 100_000, fireIntervalMin: 99, fireIntervalMax: 99 } },
  });

  it('multiplies Rexi’s damage for its duration, then damage is back to normal', () => {
    const ticks = durationOf('creatina');
    const game = drive({
      overrides: {
        spawns: [target, powerUpCrate('creatina', ON_REXI.x, onRexi)],
        tuning: tankyTarget,
      },
    });

    const boosted = eventsOf(game.holdFireToward(atSharpshooter, ticks / 60), 'enemy-hit');
    expect(boosted.length).toBeGreaterThan(5);
    const multiplier = powerUps.creatina.damageMultiplier;
    expect(multiplier).toBe(3);
    for (const hit of boosted) expect(hit.damage).toBe(mazo.damage * multiplier);

    game.ticks(1);
    // Gavels already in flight when it ended hit at normal strength.
    const after = eventsOf(game.holdFireToward(atSharpshooter, 2), 'enemy-hit');
    expect(after.length).toBeGreaterThan(5);
    for (const hit of after) expect(hit.damage).toBe(mazo.damage);
  });

  it('makes Enemies fall in a third of the hits', () => {
    const health = 30;
    const tuning: TuningOverrides = holdStill({ enemies: { 'maletin-coptero': { health } } });
    const hitsToDestroy = (spawns: ScriptedSpawn[]) => {
      const game = drive({ overrides: { spawns, tuning } });
      game.holdFireToward(atSharpshooter, 6);
      const destroyedAt = game.log.findIndex((e) => e.type === 'enemy-destroyed');
      expect(destroyedAt).toBeGreaterThan(-1);
      return eventsOf(game.log.slice(0, destroyedAt), 'enemy-hit').length;
    };

    expect(hitsToDestroy([target])).toBe(health / mazo.damage);
    expect(hitsToDestroy([target, powerUpCrate('creatina', ON_REXI.x, onRexi)])).toBe(
      Math.ceil(health / (mazo.damage * powerUps.creatina.damageMultiplier)),
    );
  });
});

/** Runs one tick at a time (holding `input`) until an event of `type` happens; fails after 10 s. */
function untilEvent(game: Driver, type: GameEventType, input: InputFramePatch = {}): void {
  for (let i = 0; i < secondsToTicks(10); i++) {
    if (eventsOf(game.ticks(1, input), type).length > 0) return;
  }
  throw new Error(`No ${type} within 10 s`);
}

/**
 * Measured speed (px/s) of the newest projectile of `owner` over the next few ticks, holding
 * `input`: the displacement it actually covers, not the velocity it carries.
 */
function measuredSpeed(game: Driver, owner: 'rexi' | 'enemy', input: InputFramePatch = {}): number {
  const newest = () =>
    runOf(game.view)
      .projectiles.filter((p) => p.owner === owner)
      .reduce<ProjectileView | undefined>((a, p) => (a && a.id > p.id ? a : p), undefined);
  const before = newest();
  if (!before) throw new Error(`No ${owner} projectile in flight`);
  const ticks = 5;
  game.ticks(ticks, input);
  const after = runOf(game.view).projectiles.find((p) => p.id === before.id);
  if (!after) throw new Error(`Projectile ${before.id} did not survive ${ticks} ticks`);
  return Math.hypot(after.x - before.x, after.y - before.y) / (ticks * DT);
}

describe('Pre-entreno', () => {
  const scale = powerUps['pre-entreno'].enemyTimeScale;
  const preEntreno = powerUpCrate('pre-entreno', ON_REXI.x, onRexi);
  /** The sharpshooter, held in place and harmless enough to survive a long volley. */
  const steadyShooter = holdStill(sharpshooterTuning(1));
  const paperSpeed = defaultTuning.enemies['maletin-coptero'].paperSpeed;

  it('slows Enemy time to a fraction of normal', () => {
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
  });

  it('slows Enemy attacks to its time scale while it lasts', () => {
    const ticks = durationOf('pre-entreno');
    const fired = (spawns: ScriptedSpawn[]) =>
      eventsOf(
        drive({ overrides: { spawns, tuning: steadyShooter } }).ticks(ticks, {
          aim: atSharpshooter,
        }),
        'enemy-fired',
      ).length;

    const normal = fired([sharpshooter]);
    expect(normal).toBeGreaterThan(10);
    expect(Math.abs(fired([sharpshooter, preEntreno]) - normal * scale)).toBeLessThanOrEqual(1);
  });

  it('moves Enemies as if only the scaled time had passed', () => {
    const drifter: ScriptedSpawn = { kind: 'maletin-coptero', x: 300, y: 60 };
    const tuning: TuningOverrides = { powerUps: { 'pre-entreno': { enemyTimeScale: 0.5 } } };
    const enemyAfter = (spawns: ScriptedSpawn[], ticks: number) => {
      const game = drive({ seed: 3, overrides: { spawns, tuning } });
      game.ticks(ticks);
      const enemy = runOf(game.view).enemies[0];
      if (!enemy) throw new Error('The Enemy is gone');
      return enemy;
    };

    const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);
    const slowed = enemyAfter([drifter, preEntreno], 120);
    const halfTime = enemyAfter([drifter], 60);
    const fullTime = enemyAfter([drifter], 120);
    expect(distance(halfTime, drifter)).toBeGreaterThan(5);
    expect(distance(fullTime, halfTime)).toBeGreaterThan(1);
    // Half-size steps integrate the eased drift a hair differently: same place within 0.1 px.
    expect(distance(slowed, halfTime)).toBeLessThan(0.1);
  });

  it('slows Enemy projectiles in flight', () => {
    const shooter = (spawns: ScriptedSpawn[]) => {
      const game = drive({ overrides: { spawns, tuning: steadyShooter } });
      untilEvent(game, 'enemy-fired');
      return game;
    };
    expect(measuredSpeed(shooter([sharpshooter]), 'enemy')).toBeCloseTo(paperSpeed, 3);
    expect(measuredSpeed(shooter([sharpshooter, preEntreno]), 'enemy')).toBeCloseTo(
      paperSpeed * scale,
      3,
    );
  });

  it('leaves Rexi at full speed: he runs and his shots fly as fast as ever', () => {
    const game = drive({
      overrides: { spawns: [sharpshooter, preEntreno], tuning: steadyShooter },
    });
    const startX = runOf(game.view).rexi.x;
    game.seconds(1, { move: 1, aim: atSharpshooter });
    expect(runOf(game.view).rexi.x - startX).toBeCloseTo(defaultTuning.rexi.runSpeed, 6);

    game.holdFireToward(atSharpshooter, 0.05);
    const fire = { aim: atSharpshooter, fire: true };
    expect(measuredSpeed(game, 'rexi', fire)).toBeCloseTo(mazo.projectileSpeed, 3);
    expect(runOf(game.view).rexi.powerUps.map((p) => p.id)).toEqual(['pre-entreno']);
  });

  it('Enemies and their projectiles are back to normal speed once it ends', () => {
    const game = drive({
      overrides: { spawns: [sharpshooter, preEntreno], tuning: steadyShooter },
    });
    // Collected on Run tick 0, it is active through tick `duration - 1` and ends on the next.
    game.ticks(durationOf('pre-entreno') + 1, { aim: atSharpshooter });
    expect(eventsOf(game.log, 'power-up-ended')).toEqual([
      { type: 'power-up-ended', powerUp: 'pre-entreno' },
    ]);
    untilEvent(game, 'enemy-fired', { aim: atSharpshooter });
    expect(measuredSpeed(game, 'enemy', { aim: atSharpshooter })).toBeCloseTo(paperSpeed, 3);
  });
});

describe('Día de Pierna', () => {
  const pierna = powerUps['dia-de-pierna'];
  const { arena } = defaultTuning;
  /** Rexi's `y` standing on the ground. */
  const groundTop = arena.groundY - defaultTuning.rexi.height;
  const jump = { jump: true };
  const legDay = () =>
    driveEmptyArena({ overrides: { spawns: [powerUpCrate('dia-de-pierna', ON_REXI.x, onRexi)] } });
  /** Highest point (smallest `y`) Rexi reaches over `ticks`, holding `input`. */
  const apex = (game: Driver, ticks: number, input: InputFramePatch) => {
    let top = Infinity;
    for (let i = 0; i < ticks; i++) {
      game.ticks(1, input);
      top = Math.min(top, runOf(game.view).rexi.y);
    }
    return top;
  };
  const normalJumpTop = apex(driveEmptyArena(), secondsToTicks(2), jump);

  it('holding jump flies Rexi far above a normal jump, up to the top of the Arena', () => {
    expect(groundTop - normalJumpTop).toBeLessThan(70);
    const game = legDay();
    expect(apex(game, secondsToTicks(2), jump)).toBe(pierna.ceiling);
    expect(runOf(game.view).rexi.flying).toBe(true);
  });

  it('climbs at its tuned rise speed once the jump’s kick has worn off', () => {
    const game = legDay();
    game.seconds(0.4, jump);
    const { rexi } = runOf(game.view);
    expect(rexi.y).toBeGreaterThan(pierna.ceiling);
    expect(rexi.vy).toBeCloseTo(-pierna.riseSpeed, 6);
  });

  it('sustains the flight for as long as jump is held: Rexi hovers at the top', () => {
    const game = legDay();
    game.seconds(2, jump);
    for (let i = 0; i < secondsToTicks(2); i++) {
      game.ticks(1, jump);
      const { rexi } = runOf(game.view);
      expect(rexi.y).toBe(pierna.ceiling);
      expect(rexi.grounded).toBe(false);
    }
  });

  it('releasing jump lets Rexi fall back under normal gravity', () => {
    const game = legDay();
    game.seconds(1, jump);
    game.ticks(1);
    const before = runOf(game.view).rexi;
    expect(before.flying).toBe(false);
    game.ticks(1);
    expect(runOf(game.view).rexi.vy - before.vy).toBeCloseTo(arena.gravity * DT, 6);
    game.seconds(2);
    expect(runOf(game.view).rexi.grounded).toBe(true);
  });

  it('ends after its duration; then holding jump is a normal jump again', () => {
    const game = legDay();
    game.ticks(durationOf('dia-de-pierna') + 1, jump);
    expect(eventsOf(game.log, 'power-up-ended')).toEqual([
      { type: 'power-up-ended', powerUp: 'dia-de-pierna' },
    ]);
    // Back down from the top (re-jumping on landing, as jump is still held) ...
    game.seconds(1.5, jump);
    expect(runOf(game.view).rexi.flying).toBe(false);
    // ... and from then on only as high as a normal jump.
    expect(apex(game, secondsToTicks(2), jump)).toBeCloseTo(normalJumpTop, 6);
  });

  it('does nothing until jump is held: Rexi stays on the ground', () => {
    const game = legDay();
    game.seconds(1, { move: 1 });
    const { rexi } = runOf(game.view);
    expect(rexi.grounded).toBe(true);
    expect(rexi.y).toBe(groundTop);
    expect(rexi.flying).toBe(false);
  });
});

describe('Power-ups in Crates', () => {
  it('every Power-up has a positive Crate weight', () => {
    expect(POWER_UP_IDS.length).toBeGreaterThanOrEqual(5);
    for (const id of POWER_UP_IDS)
      expect(defaultTuning.crates.weights.powerUps[id]).toBeGreaterThan(0);
  });

  it('splits drops roughly 60–65 % Weapons to 35–40 % Power-ups, Receso the most common', () => {
    const { weapons, powerUps } = defaultTuning.crates.weights;
    const sum = (weights: Readonly<Record<string, number>>) =>
      Object.values(weights).reduce((a, b) => a + b, 0);
    const weaponShare = sum(weapons) / (sum(weapons) + sum(powerUps));
    expect(weaponShare).toBeGreaterThanOrEqual(0.6);
    expect(weaponShare).toBeLessThanOrEqual(0.65);
    const [mostCommon] = Object.entries(powerUps).sort(([, a], [, b]) => b - a);
    expect(mostCommon?.[0]).toBe('receso');
    expect(Object.values(powerUps).filter((w) => w === powerUps.receso)).toHaveLength(1);
  });

  it('automatic drops carry Power-ups as well as Weapons', () => {
    const contents = eventsOf(drive({ seed: 4 }).seconds(240), 'crate-spawned').map(
      (e) => e.contents,
    );
    const kinds = new Set(contents.map((c) => c.kind));
    expect(kinds).toEqual(new Set(['weapon', 'power-up']));
  });

  it('Receso is more likely while Rexi’s health is low', () => {
    const recesoShare = (belowHealth: number) => {
      const contents = eventsOf(
        driveFrom({
          crates: {
            weights: {
              weapons: { ...noWeapons, 'lluvia-de-sellos': 1 },
              powerUps: { ...noPowerUps, receso: 1 },
            },
            // At full health Rexi counts as "low" only when the threshold is the whole bar.
            recesoBoost: { belowHealth, weightMultiplier: 50 },
          },
        }).seconds(300),
        'crate-spawned',
      ).map((e) => e.contents);
      expect(contents.length).toBeGreaterThan(20);
      return contents.filter((c) => c.kind === 'power-up').length / contents.length;
    };

    expect(recesoShare(1)).toBeGreaterThan(0.9);
    const normal = recesoShare(defaultTuning.crates.recesoBoost.belowHealth);
    expect(normal).toBeGreaterThan(0.2);
    expect(normal).toBeLessThan(0.8);
  });
});

/** Weights that keep every special Weapon out of Crates (override one back in). */
const noWeapons = Object.fromEntries(SPECIAL_WEAPON_IDS.map((id) => [id, 0]));
/** Weights that keep every Power-up out of Crates (override one back in). */
const noPowerUps = Object.fromEntries(POWER_UP_IDS.map((id) => [id, 0]));

/** Automatic Enemies off, automatic Crates on: only the Crate timer runs. */
function driveFrom(tuning: TuningOverrides): Driver {
  return drive({
    seed: 2,
    overrides: {
      tuning: {
        ...tuning,
        enemies: { 'maletin-coptero': { fireIntervalMin: 999, fireIntervalMax: 999 } },
      },
    },
  });
}
