/**
 * Archivador Artillado: a flying filing cabinet (Lawyer Craft) that patrols high and drops
 * drawer bombs on Rexi, which blow up on the ground or a platform.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  SCREEN_WIDTH,
  secondsToTicks,
  type EnemyView,
  type GameEvent,
  type ProjectileView,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';
import { holdStill } from '../support/fixtures';

const archivador = defaultTuning.enemies['archivador-artillado'];
const rexiTuning = defaultTuning.rexi;
const { groundY, platforms } = defaultTuning.arena;
const invincible: TuningOverrides = { rexi: { maxHealth: 1_000_000_000 } };

/** Left edge that puts the cabinet's center right above Rexi at his spawn point. */
const ABOVE_REXI_X = rexiTuning.spawnX + rexiTuning.width / 2 - archivador.width / 2;

function archivadorAt(
  x: number,
  y: number,
  options: { tuning?: TuningOverrides; seed?: number } = {},
): Driver {
  const { tuning = invincible, seed = 1 } = options;
  return drive({
    seed,
    overrides: { spawns: [{ kind: 'archivador-artillado', x, y }], tuning },
  });
}

/** Archivador tuning overrides merged with `extra`. */
type ArchivadorOverrides = NonNullable<
  NonNullable<TuningOverrides['enemies']>['archivador-artillado']
>;

function withArchivador(
  overrides: ArchivadorOverrides,
  extra: TuningOverrides = invincible,
): TuningOverrides {
  return { ...extra, enemies: { ...extra.enemies, 'archivador-artillado': overrides } };
}

const enemyOf = (game: Driver): EnemyView | undefined => runOf(game.view).enemies[0];
const drawersOf = (game: Driver): ProjectileView[] =>
  runOf(game.view).projectiles.filter((p) => p.kind === 'drawer');

/** Samples the only Enemy's view once per tick for `seconds`. */
function track(game: Driver, seconds: number): EnemyView[] {
  const samples: EnemyView[] = [];
  for (let t = 0; t < secondsToTicks(seconds); t++) {
    game.ticks(1);
    const enemy = enemyOf(game);
    if (enemy) samples.push(enemy);
  }
  return samples;
}

/** Ticks one at a time until `type` is emitted; returns the tick count and that tick's events. */
function untilEvent(game: Driver, type: GameEvent['type'], maxTicks = 60 * 30) {
  for (let tick = 1; tick <= maxTicks; tick++) {
    const events = game.ticks(1);
    if (events.some((e) => e.type === type)) return { tick, events };
  }
  throw new Error(`No ${type} event within ${maxTicks} ticks`);
}

/** A gap between drops, in ticks, matches `seconds` to within a tick. */
function expectGap(gap: number, seconds: number): void {
  expect(Math.abs(gap - secondsToTicks(seconds))).toBeLessThanOrEqual(1);
}

describe('Archivador Artillado patrol', () => {
  it('patrols edge to edge at its patrol speed, turning back at the margins', () => {
    // Far from Rexi's column it never stops to drop a drawer.
    const path = track(archivadorAt(400, 53, { tuning: withArchivador({ dropRange: 0 }) }), 30);
    const xs = path.map((e) => e.x);
    expect(Math.min(...xs)).toBeLessThan(archivador.patrolMarginX + 2);
    expect(Math.max(...xs)).toBeGreaterThan(
      SCREEN_WIDTH - archivador.patrolMarginX - archivador.width - 2,
    );
    for (const e of path) {
      expect(e.x).toBeGreaterThanOrEqual(archivador.patrolMarginX - 1e-9);
      expect(e.x + e.w).toBeLessThanOrEqual(SCREEN_WIDTH - archivador.patrolMarginX + 1e-9);
    }
    path.slice(1).forEach((e, i) => {
      const previous = path[i] ?? expect.unreachable();
      expect(Math.abs(e.x - previous.x)).toBeLessThanOrEqual(archivador.patrolSpeed / 60 + 1e-9);
    });
    // It actually turned around at least twice in 30 s.
    const turns = path.slice(2).filter((e, i) => {
      const a = path[i] ?? expect.unreachable();
      const b = path[i + 1] ?? expect.unreachable();
      return Math.sign(b.x - a.x) !== Math.sign(e.x - b.x) && e.x !== b.x;
    });
    expect(turns.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps high, inside its altitude band', () => {
    const path = track(archivadorAt(400, 53, { tuning: withArchivador({ dropRange: 0 }) }), 20);
    for (const e of path) {
      expect(e.y).toBeGreaterThanOrEqual(archivador.patrolMinY - archivador.hoverAmplitude - 1e-9);
      expect(e.y).toBeLessThanOrEqual(archivador.patrolMaxY + archivador.hoverAmplitude + 1e-9);
    }
  });

  it('climbs back up into its band when placed too low', () => {
    const game = archivadorAt(400, 200, { tuning: withArchivador({ dropRange: 0 }) });
    game.seconds(5);
    expect(enemyOf(game)?.y).toBeLessThanOrEqual(archivador.patrolMaxY + archivador.hoverAmplitude);
  });

  it('flies in from just outside either Arena edge', () => {
    const fromLeft = archivadorAt(-archivador.width, 40);
    fromLeft.seconds(1.5);
    expect(enemyOf(fromLeft)?.x).toBeGreaterThan(archivador.patrolMarginX);

    const fromRight = archivadorAt(SCREEN_WIDTH, 40);
    fromRight.seconds(1.5);
    const enemy = enemyOf(fromRight) ?? expect.unreachable();
    expect(enemy.x + enemy.w).toBeLessThan(SCREEN_WIDTH - archivador.patrolMarginX);
  });
});

describe('Archivador Artillado drawer bombs', () => {
  const still = (extra: ArchivadorOverrides = {}) => holdStill(withArchivador(extra));

  it('drops a drawer straight down when it is above Rexi', () => {
    const game = archivadorAt(ABOVE_REXI_X, 40, { tuning: still() });
    const { events } = untilEvent(game, 'enemy-fired');
    expect(eventsOf(events, 'enemy-fired')[0]).toMatchObject({ kind: 'archivador-artillado' });
    const [drawer] = drawersOf(game);
    expect(drawer).toMatchObject({ owner: 'enemy' });
    const enemy = enemyOf(game) ?? expect.unreachable();
    expect(drawer?.y).toBeGreaterThanOrEqual(enemy.y + enemy.h - 2);
    expect((drawer?.x ?? 0) + (drawer?.w ?? 0) / 2).toBeCloseTo(enemy.x + enemy.w / 2, 5);

    // It falls straight and speeds up.
    const before = drawersOf(game)[0] ?? expect.unreachable();
    game.ticks(10);
    const after = drawersOf(game)[0] ?? expect.unreachable();
    expect(after.x).toBe(before.x);
    expect(after.vy).toBeGreaterThan(before.vy);
    expect(after.y).toBeGreaterThan(before.y);
  });

  it('never drops a drawer while Rexi is out of its drop range', () => {
    const game = archivadorAt(ABOVE_REXI_X + 200, 40, { tuning: still() });
    expect(eventsOf(game.seconds(10), 'enemy-fired')).toHaveLength(0);
    expect(drawersOf(game)).toHaveLength(0);
  });

  it('telegraphs each drop: the windup climbs to 1 while it holds position, then the drawer falls', () => {
    const game = archivadorAt(ABOVE_REXI_X, 40, { tuning: still() });
    const windups: number[] = [];
    let dropped = false;
    for (let t = 0; t < 600 && !dropped; t++) {
      dropped = eventsOf(game.ticks(1), 'enemy-fired').length > 0;
      if (!dropped) windups.push(enemyOf(game)?.pose.windup ?? 0);
    }
    expect(dropped).toBe(true);
    const winding = windups.filter((w) => w > 0);
    expect(winding.length).toBe(secondsToTicks(archivador.dropWindup) - 1);
    winding.slice(1).forEach((w, i) => {
      expect(w).toBeGreaterThan(winding[i] ?? 0);
    });
    expect(Math.max(...winding)).toBeLessThanOrEqual(1);
    expect(enemyOf(game)?.pose.windup).toBe(0);
  });

  it('stops patrolling during the windup', () => {
    // Patrolling right from just left of Rexi's column.
    const game = archivadorAt(ABOVE_REXI_X - 10, 40, {
      tuning: withArchivador({ firstDropDelay: 0 }),
    });
    const xs: number[] = [];
    for (let t = 0; t < 600; t++) {
      game.ticks(1);
      const enemy = enemyOf(game) ?? expect.unreachable();
      if (enemy.pose.attack === 'windup') xs.push(enemy.x);
      else if (xs.length) break;
    }
    expect(xs.length).toBeGreaterThan(5);
    expect(new Set(xs).size).toBe(1);
  });

  it('waits its drop cooldown between drawers', () => {
    const game = archivadorAt(ABOVE_REXI_X, 40, { tuning: still() });
    const ticks: number[] = [];
    for (let t = 1; t <= secondsToTicks(10.5); t++) {
      if (eventsOf(game.ticks(1), 'enemy-fired').length) ticks.push(t);
    }
    const gaps = ticks.slice(1).map((t, i) => t - (ticks[i] ?? 0));
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    // The cooldown runs from one drop until the next windup starts.
    for (const gap of gaps) expectGap(gap, archivador.dropCooldown + archivador.dropWindup);
  });

  it('drops faster as the ramp raises the Enemy fire rate', () => {
    const game = archivadorAt(ABOVE_REXI_X, 40, {
      tuning: holdStill(
        withArchivador(
          {},
          {
            ...invincible,
            director: { stages: [{ from: 0, onScreenCap: 3, spawnInterval: 3, fireRate: 2 }] },
          },
        ),
      ),
    });
    const ticks: number[] = [];
    for (let t = 1; t <= secondsToTicks(10); t++) {
      if (eventsOf(game.ticks(1), 'enemy-fired').length) ticks.push(t);
    }
    const gaps = ticks.slice(1).map((t, i) => t - (ticks[i] ?? 0));
    expect(gaps.length).toBeGreaterThanOrEqual(3);
    // Only the cooldown speeds up: the windup stays readable.
    for (const gap of gaps) expectGap(gap, archivador.dropCooldown / 2 + archivador.dropWindup);
  });

  it('hurts Rexi standing under it when the drawer lands', () => {
    const game = archivadorAt(ABOVE_REXI_X, 40, { tuning: still() });
    untilEvent(game, 'enemy-fired');
    const { events } = untilEvent(game, 'rexi-hit');
    expect(eventsOf(events, 'rexi-hit')[0]).toMatchObject({ damage: archivador.drawerDamage });
    expect(drawersOf(game)).toHaveLength(0);
  });

  it('blows up on the ground, hurting Rexi within the blast radius even on a near miss', () => {
    // The drawer lands just beside Rexi without touching him.
    const offset = rexiTuning.width / 2 + archivador.drawerSize / 2 + 4;
    expect(offset - rexiTuning.width / 2).toBeLessThan(archivador.drawerBlastRadius);
    const game = archivadorAt(ABOVE_REXI_X + offset, 40, { tuning: still() });
    untilEvent(game, 'enemy-fired');
    const { events } = untilEvent(game, 'explosion');
    const [blast] = eventsOf(events, 'explosion');
    expect(blast).toMatchObject({
      owner: 'enemy',
      kind: 'drawer',
      size: archivador.drawerExplosion,
    });
    expect(blast?.y).toBeCloseTo(groundY - archivador.drawerSize / 2, 0);
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(1);
    // A visible explosion goes off where it landed.
    game.ticks(1);
    expect(runOf(game.view).effects.particles.some((p) => p.kind === 'flash')).toBe(true);
  });

  it('does not hurt Rexi when it blows up outside the blast radius', () => {
    const game = archivadorAt(ABOVE_REXI_X + 100, 40, { tuning: still({ dropRange: 200 }) });
    untilEvent(game, 'enemy-fired');
    const { events } = untilEvent(game, 'explosion');
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(0);
    expect(runOf(game.view).rexi.health).toBe(runOf(game.view).rexi.maxHealth);
  });

  it('blows up on a platform it falls onto', () => {
    const ledge = platforms[2] ?? expect.unreachable();
    const x = ledge.x + ledge.w / 2 - archivador.width / 2;
    const game = archivadorAt(x, 40, { tuning: still({ dropRange: 400 }) });
    untilEvent(game, 'enemy-fired');
    const { events } = untilEvent(game, 'explosion');
    expect(eventsOf(events, 'explosion')[0]?.y).toBeCloseTo(ledge.y - archivador.drawerSize / 2, 0);
    expect(drawersOf(game)).toHaveLength(0);
  });
});

describe('Archivador Artillado in the Enemy catalog', () => {
  it('is Lawyer Craft, and destroying it awards its points', () => {
    const spot = { x: 400, y: 53 };
    const game = drive({
      overrides: {
        spawns: [{ kind: 'archivador-artillado', ...spot }],
        tuning: holdStill({
          ...invincible,
          weapons: { 'mazo-automatico': { damage: archivador.health } },
        }),
      },
    });
    game.ticks(1);
    expect(enemyOf(game)?.craft).toBe('lawyer');
    const target = { x: spot.x + archivador.width / 2, y: spot.y + archivador.height / 2 };
    game.holdFireToward(target, 2);
    const [destroyed] = eventsOf(game.log, 'enemy-destroyed');
    expect(destroyed).toMatchObject({
      kind: 'archivador-artillado',
      craft: 'lawyer',
      points: archivador.points,
    });
    expect(runOf(game.view).stats.score).toBe(archivador.points);
  });

  it('is heavier than a Maletín-cóptero: more health, more points', () => {
    const maletin = defaultTuning.enemies['maletin-coptero'];
    expect(archivador.health).toBeGreaterThan(maletin.health);
    expect(archivador.points).toBeGreaterThan(maletin.points);
    expect(archivador.alwaysQuip).toBe(false);
  });
});

describe('Archivador Artillado in the Director ramp', () => {
  const entry = defaultTuning.director.roster['archivador-artillado'];

  it('joins the roster after about a minute, entering high from the sides', () => {
    expect(entry.from).toBe(60);
    expect(entry.edges).toEqual(['left', 'right']);
    expect(entry.minY).toBeGreaterThanOrEqual(archivador.patrolMinY);
    expect(entry.maxY).toBeLessThanOrEqual(archivador.patrolMaxY);
  });

  it('is never sent before 60 s of ramp clock, and is sent soon after', () => {
    // Rexi keeps shooting down whatever is in the Arena, so the cap never blocks the Director.
    const game = drive({
      seed: 3,
      overrides: { tuning: { ...invincible, weapons: { 'mazo-automatico': { damage: 100 } } } },
    });
    const firstSpawn = (): number | null => {
      for (let t = 0; t < secondsToTicks(200); t++) {
        const target = runOf(game.view).enemies.find((e) => e.x > 0 && e.x + e.w < SCREEN_WIDTH);
        const aim = target && { x: target.x + target.w / 2, y: target.y + target.h / 2 };
        const spawned = eventsOf(game.ticks(1, aim ? { aim, fire: true } : {}), 'enemy-spawned');
        if (spawned.some((e) => e.kind === 'archivador-artillado'))
          return runOf(game.view).rampTicks;
      }
      return null;
    };
    const at = firstSpawn();
    expect(at).not.toBeNull();
    expect(at).toBeGreaterThanOrEqual(secondsToTicks(60));
    expect(at).toBeLessThan(secondsToTicks(120));
  });

  it('follows its roster start time when it is overridden', () => {
    const game = drive({
      overrides: {
        tuning: {
          ...invincible,
          director: {
            firstSpawnDelay: 0,
            stages: [{ from: 0, onScreenCap: 20, spawnInterval: 0.25, fireRate: 1 }],
            roster: {
              'maletin-coptero': { weight: 0 },
              'archivador-artillado': { from: 5 },
            },
          },
        },
      },
    });
    expect(eventsOf(game.seconds(4.95), 'enemy-spawned')).toHaveLength(0);
    const spawned = eventsOf(game.seconds(1), 'enemy-spawned');
    expect(spawned.length).toBeGreaterThan(0);
    expect(new Set(spawned.map((e) => e.kind))).toEqual(new Set(['archivador-artillado']));
  });
});
