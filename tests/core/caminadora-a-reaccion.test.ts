/**
 * Caminadora a Reacción: the first Gym Craft Enemy. Strafes edge to edge across the Arena,
 * stops briefly to wind up, then fires a burst of bullets aimed where Rexi was.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  QUIPS,
  SCREEN_WIDTH,
  secondsToTicks,
  type EnemyView,
  type GameEvent,
  type ProjectileView,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';
import { holdStill } from '../support/fixtures';

const KIND = 'caminadora-a-reaccion';
const caminadora = defaultTuning.enemies[KIND];
const invincible: TuningOverrides = { rexi: { maxHealth: 1_000_000_000 } };
/** Fire interval long enough that it never shoots during a test. */
const HOLD_FIRE = { fireIntervalMin: 999, fireIntervalMax: 999 };

type CaminadoraOverrides = NonNullable<TuningOverrides['enemies']>[typeof KIND];

function caminadoraAt(
  x: number,
  y: number,
  enemy: CaminadoraOverrides = {},
  tuning: TuningOverrides = {},
): Driver {
  return drive({
    seed: 3,
    overrides: {
      spawns: [{ kind: KIND, x, y }],
      tuning: { ...invincible, ...tuning, enemies: { [KIND]: enemy } },
    },
  });
}

const enemyOf = (game: Driver): EnemyView | undefined => runOf(game.view).enemies[0];
const enemyBullets = (game: Driver): ProjectileView[] =>
  runOf(game.view).projectiles.filter((p) => p.owner === 'enemy');

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

/** Ticks one at a time until `type` is emitted; returns how many ticks it took. */
function ticksUntil(game: Driver, type: GameEvent['type'], limit = 60 * 30): number {
  for (let tick = 1; tick <= limit; tick++) {
    if (game.ticks(1).some((e) => e.type === type)) return tick;
  }
  throw new Error(`No ${type} event within ${limit} ticks`);
}

describe('Caminadora a Reacción strafing', () => {
  it('strafes edge to edge across the whole Arena', () => {
    const path = track(caminadoraAt(200, 90, HOLD_FIRE), 12);
    const xs = path.map((e) => e.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(caminadora.strafeMarginX + 2);
    expect(Math.max(...xs) + caminadora.width).toBeGreaterThanOrEqual(
      SCREEN_WIDTH - caminadora.strafeMarginX - 2,
    );
    for (const e of path) {
      expect(e.x).toBeGreaterThanOrEqual(caminadora.strafeMarginX - 1e-9);
      expect(e.x + e.w).toBeLessThanOrEqual(SCREEN_WIDTH - caminadora.strafeMarginX + 1e-9);
    }
  });

  it('moves horizontally at its strafe speed, climbing slower than that', () => {
    const path = track(caminadoraAt(200, 90, HOLD_FIRE), 12);
    path.slice(1).forEach((e, i) => {
      const previous = path[i] ?? expect.unreachable();
      expect(Math.abs(e.x - previous.x)).toBeLessThanOrEqual(caminadora.strafeSpeed / 60 + 1e-9);
      expect(Math.abs(e.y - previous.y)).toBeLessThanOrEqual(caminadora.climbSpeed / 60 + 1e-9);
    });
    const travelled = path
      .slice(1)
      .reduce((sum, e, i) => sum + Math.abs(e.x - (path[i] ?? e).x), 0);
    // Only the turning ticks fall a little short of a full step.
    expect(travelled).toBeGreaterThan((0.98 * caminadora.strafeSpeed * (path.length - 1)) / 60);
  });

  it('changes altitude between passes, inside its altitude band', () => {
    const path = track(caminadoraAt(200, 90, HOLD_FIRE), 30);
    const ys = path.map((e) => e.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(10);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(caminadora.strafeMinY - 1e-9);
      expect(y).toBeLessThanOrEqual(caminadora.strafeMaxY + 1e-9);
    }
  });

  it('faces the way it flies, turning around at each edge', () => {
    const path = track(caminadoraAt(200, 90, HOLD_FIRE), 12);
    const facings = new Set<number>();
    path.slice(1).forEach((e, i) => {
      // Each tick it moves the way it faced at the start of that tick.
      const previous = path[i] ?? expect.unreachable();
      const dx = e.x - previous.x;
      if (dx !== 0) expect(previous.pose.facing).toBe(Math.sign(dx));
      facings.add(e.pose.facing ?? 0);
    });
    expect(facings).toEqual(new Set([1, -1]));
  });

  it.each([
    ['left', -caminadora.width],
    ['right', SCREEN_WIDTH],
  ])('flies in from just outside the %s edge', (_side, x) => {
    const game = caminadoraAt(x, 90, HOLD_FIRE);
    game.seconds(1.5);
    const enemy = enemyOf(game) ?? expect.unreachable();
    expect(enemy.x).toBeGreaterThanOrEqual(caminadora.strafeMarginX);
    expect(enemy.x + enemy.w).toBeLessThanOrEqual(SCREEN_WIDTH - caminadora.strafeMarginX);
  });

  it('holds still when its strafe speed is zero', () => {
    const path = track(caminadoraAt(200, 90, { ...HOLD_FIRE, strafeSpeed: 0 }), 5);
    expect(new Set(path.map((e) => `${e.x},${e.y}`))).toEqual(new Set(['200,90']));
  });
});

describe('Caminadora a Reacción bursts', () => {
  const burstTuning = { fireIntervalMin: 2, fireIntervalMax: 2 };

  it('fires bursts of bullets spaced a few ticks apart', () => {
    const game = caminadoraAt(200, 90, burstTuning);
    const fireTicks: number[] = [];
    for (let t = 1; t <= secondsToTicks(3); t++) {
      if (eventsOf(game.ticks(1), 'enemy-fired').length > 0) fireTicks.push(t);
    }
    expect(fireTicks).toHaveLength(caminadora.burstCount);
    const spacing = secondsToTicks(caminadora.burstSpacing);
    fireTicks.slice(1).forEach((t, i) => {
      expect(t - (fireTicks[i] ?? 0)).toBe(spacing);
    });
    expect(eventsOf(game.log, 'enemy-fired')[0]).toMatchObject({ kind: KIND });
  });

  it('stops and winds up before each burst, then strafes on while firing', () => {
    const game = caminadoraAt(200, 90, burstTuning);
    game.seconds(2 - 0.1);
    const windup: EnemyView[] = [];
    let firstShotAt = -1;
    for (let t = 0; t < secondsToTicks(1) && firstShotAt < 0; t++) {
      if (eventsOf(game.ticks(1), 'enemy-fired').length > 0) firstShotAt = t;
      else windup.push(enemyOf(game) ?? expect.unreachable());
    }
    const still = windup.filter((e) => e.pose.attack === 'windup');
    expect(still.length).toBe(secondsToTicks(caminadora.windup));
    expect(new Set(still.map((e) => e.x)).size).toBe(1);

    const before = enemyOf(game)?.x ?? 0;
    game.ticks(2);
    expect(enemyOf(game)?.pose.attack).toBe('firing');
    expect(enemyOf(game)?.x).not.toBe(before);
    game.seconds(1);
    expect(enemyOf(game)?.pose.attack).toBe('idle');
  });

  it('aims the whole burst where Rexi was when it started, as a straight line', () => {
    const game = caminadoraAt(300, 80, { ...burstTuning, strafeSpeed: 0 });
    game.seconds(2 + caminadora.windup + 0.02);
    // Rexi runs away mid-burst: the remaining bullets keep the same heading.
    game.seconds(0.5, { move: -1 });
    const bullets = enemyBullets(game);
    expect(bullets).toHaveLength(caminadora.burstCount);
    const headings = bullets.map((b) => Math.atan2(b.vy, b.vx));
    for (const h of headings) expect(h).toBeCloseTo(headings[0] ?? 0, 9);
    for (const b of bullets) {
      expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(caminadora.bulletSpeed, 6);
      expect(b.kind).toBe('bullet');
    }
    // Rexi stood to the lower left of it when the burst started.
    expect(bullets[0]?.vx).toBeLessThan(0);
    expect(bullets[0]?.vy).toBeGreaterThan(0);
  });

  it.each([
    ['ahead of it', 30, 1],
    ['behind it', 160, -1],
  ])('faces Rexi when he is %s, and fires forward', (_where, x, towardRexi) => {
    // Both spawn left of center, heading right; Rexi stands between them.
    const game = caminadoraAt(x, 90, { ...burstTuning, strafeSpeed: 0 });
    game.ticks(1);
    expect(enemyOf(game)?.pose.facing).toBe(1);
    ticksUntil(game, 'enemy-fired');
    expect(enemyOf(game)?.pose.facing).toBe(towardRexi);
    const [bullet] = enemyBullets(game);
    expect(Math.sign(bullet?.vx ?? 0)).toBe(towardRexi);
  });

  it('hurts Rexi by its bullet damage', () => {
    const rexi = defaultTuning.rexi;
    const game = drive({
      overrides: {
        spawns: [{ kind: KIND, x: rexi.spawnX + 60, y: 120 }],
        tuning: { enemies: { [KIND]: { ...burstTuning, strafeSpeed: 0 } } },
      },
    });
    ticksUntil(game, 'rexi-hit');
    expect(runOf(game.view).rexi.health).toBe(rexi.maxHealth - caminadora.bulletDamage);
  });

  it('bursts more often as the ramp raises the fire rate', () => {
    const bursts = (fireRate: number) => {
      const game = caminadoraAt(200, 90, burstTuning, {
        director: { stages: [{ from: 0, onScreenCap: 3, spawnInterval: 3, fireRate }] },
      });
      game.seconds(20);
      return eventsOf(game.log, 'enemy-fired').length / caminadora.burstCount;
    };
    expect(bursts(2)).toBeGreaterThan(bursts(1) * 1.5);
  });
});

describe('Caminadora a Reacción destruction', () => {
  const SPOT = { x: 300, y: 100 };
  const AIM = { x: SPOT.x + caminadora.width / 2, y: SPOT.y + caminadora.height / 2 };

  function target(tuning: TuningOverrides = {}): Driver {
    return drive({
      seed: 7,
      overrides: {
        spawns: [{ kind: KIND, ...SPOT }],
        tuning: holdStill({
          ...invincible,
          ...tuning,
          enemies: { [KIND]: { ...HOLD_FIRE, ...tuning.enemies?.[KIND] } },
        }),
      },
    });
  }

  it('is Gym Craft and awards its points when destroyed', () => {
    const game = target();
    game.ticks(1);
    expect(enemyOf(game)?.craft).toBe('gym');
    const events = game.holdFireToward(AIM, 15);
    const [destroyed] = eventsOf(events, 'enemy-destroyed');
    expect(destroyed).toMatchObject({ kind: KIND, craft: 'gym', points: caminadora.points });
    const run = runOf(game.view);
    expect(run.enemies).toHaveLength(0);
    expect(run.stats.score).toBe(caminadora.points);
    expect(caminadora.points).toBeGreaterThan(defaultTuning.enemies['maletin-coptero'].points);
  });

  it('takes more hits than a Maletín-cóptero', () => {
    const mazo = defaultTuning.weapons['mazo-automatico'];
    const game = target();
    const hits = eventsOf(game.holdFireToward(AIM, 15), 'enemy-hit');
    expect(hits).toHaveLength(Math.ceil(caminadora.health / mazo.damage));
    expect(caminadora.health).toBeGreaterThan(defaultTuning.enemies['maletin-coptero'].health);
  });

  it('draws a gym Quip when destroyed', () => {
    const gymIds = new Set(QUIPS.filter((q) => q.theme === 'gym').map((q) => q.id));
    const game = target({ quips: { chance: 1 }, enemies: { [KIND]: { health: 1 } } });
    const events = game.holdFireToward(AIM, 1);
    const [started] = eventsOf(events, 'quip-started');
    expect(started?.theme).toBe('gym');
    expect(gymIds.has(started?.quipId ?? '')).toBe(true);
    expect(started?.enemyId).toBe(eventsOf(events, 'enemy-destroyed')[0]?.enemyId);
    expect(runOf(game.view).dialogue?.quipId).toBe(started?.quipId);
  });
});

describe('Caminadora a Reacción in the Director', () => {
  it('joins the roster at about a minute', () => {
    expect(defaultTuning.director.roster[KIND].from).toBe(60);
  });

  it('is never sent before a minute, and is sent after', () => {
    // Only Caminadoras are allowed, so a due spawn waits for them.
    const game = drive({
      seed: 4,
      overrides: {
        tuning: {
          ...invincible,
          director: { firstSpawnDelay: 0, roster: { 'maletin-coptero': { weight: 0 } } },
        },
      },
    });
    expect(eventsOf(game.seconds(59.95), 'enemy-spawned')).toHaveLength(0);
    const spawned = eventsOf(game.seconds(5), 'enemy-spawned');
    expect(spawned.length).toBeGreaterThan(0);
    expect(new Set(spawned.map((e) => e.kind))).toEqual(new Set([KIND]));
  });

  it('shows up among the default spawns in the second minute', () => {
    const game = drive({
      seed: 2,
      overrides: { tuning: { ...invincible, weapons: { 'mazo-automatico': { damage: 1000 } } } },
    });
    /** Rexi one-shots the oldest Enemy inside the Arena, so the Director keeps sending more. */
    const fightFor = (seconds: number) => {
      const events: GameEvent[] = [];
      for (let t = 0; t < secondsToTicks(seconds); t++) {
        const enemies = runOf(game.view).enemies;
        const target = enemies.find((e) => e.x > 0 && e.x + e.w < SCREEN_WIDTH);
        const aim = target && { x: target.x + target.w / 2, y: target.y + target.h / 2 };
        events.push(...game.ticks(1, aim ? { aim, fire: true } : {}));
      }
      return eventsOf(events, 'enemy-spawned').map((e) => e.kind);
    };
    expect(fightFor(59.9)).not.toContain(KIND);
    expect(fightFor(60)).toContain(KIND);
  });

  it('enters from a side edge inside its altitude band', () => {
    const entry = defaultTuning.director.roster[KIND];
    expect([...entry.edges].sort()).toEqual(['left', 'right']);
    expect(entry.minY).toBeGreaterThanOrEqual(caminadora.strafeMinY);
    expect(entry.maxY).toBeLessThanOrEqual(caminadora.strafeMaxY);
  });
});
