/**
 * Banca Artillada: the heavy Gym Craft gunship. Slow standoff drift, rocket volleys that
 * accelerate and briefly home on Rexi, a big payout, an always-Quip kill and a late arrival
 * in the Director's ramp.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  SCREEN_WIDTH,
  secondsToTicks,
  type DebrisParticleView,
  type EnemyView,
  type GameEvent,
  type ProjectileView,
  type ScriptedSpawn,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';
import { holdStill } from '../support/fixtures';

const banca = defaultTuning.enemies['banca-artillada'];
const maletin = defaultTuning.enemies['maletin-coptero'];
const invincible: TuningOverrides = { rexi: { maxHealth: 1_000_000_000 } };
const EPSILON = 1e-6;

const bancaSpawn = (x: number, y: number, atTick = 0): ScriptedSpawn => ({
  kind: 'banca-artillada',
  x,
  y,
  atTick,
});

function bancaAt(x: number, y: number, tuning: TuningOverrides = {}, seed = 1): Driver {
  return drive({
    seed,
    overrides: { spawns: [bancaSpawn(x, y)], tuning: { ...invincible, ...tuning } },
  });
}

/** Banca tuning overrides merged under the given extra tuning. */
function withBanca(
  values: NonNullable<TuningOverrides['enemies']>['banca-artillada'],
  extra: TuningOverrides = {},
): TuningOverrides {
  return { ...extra, enemies: { ...extra.enemies, 'banca-artillada': values } };
}

const bancaOf = (game: Driver): EnemyView | undefined =>
  runOf(game.view).enemies.find((e) => e.kind === 'banca-artillada');
const rocketsOf = (game: Driver): ProjectileView[] =>
  runOf(game.view).projectiles.filter((p) => p.kind === 'rocket' && p.owner === 'enemy');
const middle = (box: { x: number; y: number; w: number; h: number }): Vec2 => ({
  x: box.x + box.w / 2,
  y: box.y + box.h / 2,
});
const heading = (p: ProjectileView) => Math.atan2(p.vy, p.vx);
const speed = (p: ProjectileView) => Math.hypot(p.vx, p.vy);
const turnBetween = (a: number, b: number) => {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
};

/** Ticks one at a time (holding `input`) until `type` is emitted; returns that tick's events. */
function untilEvent(
  game: Driver,
  type: GameEvent['type'],
  input: Parameters<Driver['ticks']>[1] = {},
  maxTicks = 60 * 60,
): GameEvent[] {
  for (let t = 0; t < maxTicks; t++) {
    const events = game.ticks(1, input);
    if (events.some((e) => e.type === type)) return events;
  }
  throw new Error(`No ${type} event within ${maxTicks} ticks`);
}

describe('Banca Artillada movement', () => {
  it('drifts slowly: never faster than its drift speed (plus the hover bob)', () => {
    const game = bancaAt(400, 80);
    const bobPerTick = (2 * Math.PI * banca.hoverAmplitude) / banca.hoverPeriod / 60;
    let previous = bancaOf(game);
    for (let t = 0; t < secondsToTicks(20); t++) {
      // Rexi runs back and forth, so the Banca keeps having to reposition.
      game.ticks(1, { move: t % 300 < 150 ? 1 : -1 });
      const current = bancaOf(game) ?? expect.unreachable();
      if (previous) {
        expect(Math.abs(current.x - previous.x)).toBeLessThanOrEqual(
          banca.driftSpeed / 60 + EPSILON,
        );
        expect(Math.abs(current.y - previous.y)).toBeLessThanOrEqual(
          banca.driftSpeed / 60 + bobPerTick + EPSILON,
        );
      }
      previous = current;
    }
  });

  it('settles at its standoff distance from Rexi, inside its altitude band', () => {
    const game = bancaAt(507, 80);
    game.seconds(15);
    const enemy = bancaOf(game) ?? expect.unreachable();
    const rexi = runOf(game.view).rexi;
    expect(Math.abs(middle(enemy).x - middle(rexi).x - banca.standoff)).toBeLessThan(2);
    expect(enemy.y).toBeGreaterThanOrEqual(banca.minY - banca.hoverAmplitude - EPSILON);
    expect(enemy.y).toBeLessThanOrEqual(banca.maxY + banca.hoverAmplitude + EPSILON);
  });

  it('follows Rexi when he runs, keeping to its side', () => {
    const game = bancaAt(400, 80);
    game.seconds(10);
    game.seconds(1, { move: 1 });
    game.seconds(12);
    const enemy = bancaOf(game) ?? expect.unreachable();
    const rexi = runOf(game.view).rexi;
    expect(middle(enemy).x - middle(rexi).x).toBeCloseTo(banca.standoff, 0);
  });

  it('crosses over Rexi to his other side when he pins it against the edge', () => {
    const game = bancaAt(507, 80);
    game.seconds(4);
    game.seconds(3, { move: 1 });
    game.seconds(15);
    const enemy = bancaOf(game) ?? expect.unreachable();
    const rexi = runOf(game.view).rexi;
    expect(middle(rexi).x - middle(enemy).x).toBeCloseTo(banca.standoff, 0);
  });

  it('never leaves the Arena once inside it', () => {
    const game = bancaAt(507, 80);
    for (let t = 0; t < secondsToTicks(40); t++) {
      game.ticks(1, { move: t % 400 < 200 ? 1 : -1 });
      const enemy = bancaOf(game) ?? expect.unreachable();
      expect(enemy.x).toBeGreaterThanOrEqual(banca.marginX - EPSILON);
      expect(enemy.x + enemy.w).toBeLessThanOrEqual(SCREEN_WIDTH - banca.marginX + EPSILON);
    }
  });

  it('flies in on its own from just outside the Arena edge', () => {
    const game = bancaAt(SCREEN_WIDTH, 80);
    game.seconds(8);
    const enemy = bancaOf(game) ?? expect.unreachable();
    expect(enemy.x + enemy.w).toBeLessThanOrEqual(SCREEN_WIDTH - banca.marginX + EPSILON);
  });

  it('holds its position (hover bob only) when its drift speed is zero', () => {
    const game = bancaAt(400, 80, holdStill());
    const xs = new Set<number>();
    for (let t = 0; t < secondsToTicks(5); t++) {
      game.ticks(1, { move: 1 });
      xs.add(bancaOf(game)?.x ?? NaN);
    }
    expect(xs).toEqual(new Set([400]));
  });
});

describe('Banca Artillada rocket volleys', () => {
  it('fires volleys of rockets, a short gap apart, every volley interval', () => {
    const game = bancaAt(400, 80, withBanca({ firstVolleyDelay: 1, volleyInterval: 4 }));
    const fireTicks: number[] = [];
    for (let t = 1; t <= secondsToTicks(9.5 + banca.volleyWindup); t++) {
      const fired = eventsOf(game.ticks(1), 'enemy-fired');
      for (const e of fired) {
        expect(e.kind).toBe('banca-artillada');
        fireTicks.push(t);
      }
    }
    const spacing = secondsToTicks(banca.volleySpacing);
    const interval = secondsToTicks(4);
    expect(fireTicks).toHaveLength(3 * banca.volleySize);
    for (let v = 0; v < 3; v++) {
      const volley = fireTicks.slice(v * banca.volleySize, (v + 1) * banca.volleySize);
      const start = volley[0] ?? expect.unreachable();
      // Each volley follows its windup (the telegraph).
      const due = secondsToTicks(1 + banca.volleyWindup) + v * interval;
      expect(Math.abs(start - due)).toBeLessThanOrEqual(1);
      expect(volley.map((t) => t - start)).toEqual(
        Array.from({ length: banca.volleySize }, (_, i) => i * spacing),
      );
    }
  });

  it('telegraphs each volley: a windup climbing to 1 before the first rocket, then firing', () => {
    const game = bancaAt(400, 80, withBanca({ firstVolleyDelay: 1 }, holdStill()));
    game.seconds(1 - 1 / 60);
    expect(bancaOf(game)?.pose).toEqual({ facing: null, attack: 'idle', windup: 0 });
    const windups: number[] = [];
    let fired = false;
    while (!fired) {
      fired = eventsOf(game.ticks(1), 'enemy-fired').length > 0;
      const pose = bancaOf(game)?.pose ?? expect.unreachable();
      if (!fired) {
        expect(pose.attack).toBe('windup');
        windups.push(pose.windup);
      } else {
        expect(pose).toMatchObject({ attack: 'firing', windup: 0 });
      }
    }
    expect(windups.length).toBe(secondsToTicks(banca.volleyWindup) - 1);
    windups.slice(1).forEach((w, i) => {
      expect(w).toBeGreaterThan(windups[i] ?? 0);
    });
    expect(rocketsOf(game)).toHaveLength(1);
    game.seconds(banca.volleySize * banca.volleySpacing);
    expect(bancaOf(game)?.pose.attack).toBe('idle');
  });

  it('launches visible enemy rockets from its two pods, alternating', () => {
    const game = bancaAt(400, 80, withBanca({ firstVolleyDelay: 0.5 }, holdStill()));
    untilEvent(game, 'enemy-fired');
    const enemy = bancaOf(game) ?? expect.unreachable();
    const first = rocketsOf(game)[0] ?? expect.unreachable();
    game.ticks(secondsToTicks(banca.volleySpacing));
    const second = rocketsOf(game).find((p) => p.id !== first.id) ?? expect.unreachable();
    const firstSide = Math.sign(middle(first).x - middle(enemy).x);
    const secondSide = Math.sign(middle(second).x - middle(enemy).x);
    expect(firstSide).not.toBe(0);
    expect(secondSide).toBe(-firstSide);
    expect(middle(first).y).toBeGreaterThan(middle(enemy).y);
  });

  it('rockets leave at launch speed and accelerate up to their top speed', () => {
    const game = bancaAt(400, 53, withBanca({ firstVolleyDelay: 0.5, volleySize: 1 }));
    untilEvent(game, 'enemy-fired');
    const rocket = rocketsOf(game)[0] ?? expect.unreachable();
    expect(speed(rocket)).toBeLessThan(
      banca.rocketLaunchSpeed + banca.rocketAcceleration / 60 + EPSILON,
    );
    const speeds: number[] = [];
    for (let t = 0; t < 60; t++) {
      game.ticks(1);
      const same = rocketsOf(game).find((p) => p.id === rocket.id);
      if (same) speeds.push(speed(same));
    }
    speeds.slice(1).forEach((s, i) => {
      expect(s).toBeGreaterThanOrEqual((speeds[i] ?? 0) - EPSILON);
    });
    expect(Math.max(...speeds)).toBeLessThanOrEqual(banca.rocketMaxSpeed + EPSILON);
    expect(speeds.at(-1)).toBeCloseTo(banca.rocketMaxSpeed, 3);
  });

  it('rockets steer toward Rexi for their homing time, then fly straight', () => {
    const game = bancaAt(
      453,
      53,
      // Fires half a second in, windup included, so the rocket clears Rexi's head.
      withBanca(
        { firstVolleyDelay: 0.5 - banca.volleyWindup, volleySize: 1, volleySpread: 0 },
        holdStill(),
      ),
    );
    untilEvent(game, 'enemy-fired');
    const rocket = rocketsOf(game)[0] ?? expect.unreachable();
    const maxTurn = (banca.rocketTurnRate * Math.PI) / 180 / 60;
    const misalignment = (p: ProjectileView) => {
      const to = middle(runOf(game.view).rexi);
      const from = middle(p);
      return turnBetween(heading(p), Math.atan2(to.y - from.y, to.x - from.x));
    };

    // Rexi runs right, under the Banca: the rocket bends after him.
    let previous = rocket;
    const homingTicks = secondsToTicks(banca.rocketHomingTime);
    for (let t = 0; t < homingTicks - 1; t++) {
      game.ticks(1, { move: 1 });
      const current = rocketsOf(game).find((p) => p.id === rocket.id) ?? expect.unreachable();
      expect(turnBetween(heading(current), heading(previous))).toBeLessThanOrEqual(
        maxTurn + EPSILON,
      );
      previous = current;
    }
    expect(turnBetween(heading(previous), heading(rocket))).toBeGreaterThan(maxTurn * 10);
    expect(misalignment(previous)).toBeLessThan(Math.PI / 4);

    // After the homing time it flies straight, wherever Rexi goes.
    game.ticks(2, { move: -1 });
    const straight = rocketsOf(game).find((p) => p.id === rocket.id) ?? expect.unreachable();
    game.ticks(10, { move: -1 });
    const later = rocketsOf(game).find((p) => p.id === rocket.id) ?? expect.unreachable();
    expect(heading(later)).toBeCloseTo(heading(straight), 9);
  });

  it('a rocket that reaches Rexi hurts him for its damage', () => {
    const game = bancaAt(
      400,
      80,
      withBanca({ firstVolleyDelay: 0.5, volleySpread: 0 }, holdStill()),
    );
    const [hit] = eventsOf(untilEvent(game, 'rexi-hit'), 'rexi-hit');
    expect(hit?.damage).toBe(banca.rocketDamage);
  });

  it('fires volleys faster as the ramp raises the fire rate', () => {
    const volleysIn = (fireRate: number) => {
      const game = bancaAt(
        400,
        80,
        withBanca(
          { firstVolleyDelay: 2, volleyInterval: 2 },
          { director: { stages: [{ from: 0, onScreenCap: 3, spawnInterval: 3, fireRate }] } },
        ),
      );
      // The windup before each volley runs in Enemy time, unaffected by the fire rate.
      const span = 16.75 + banca.volleyWindup;
      return eventsOf(game.seconds(span), 'enemy-fired').length / banca.volleySize;
    };
    expect(volleysIn(1)).toBe(8);
    expect(volleysIn(2)).toBe(16);
  });
});

describe('Banca Artillada as an Enemy', () => {
  /** Kills a one-hit Banca parked at (60, 60) and returns the destruction tick's events. */
  function destroyOne(tuning: TuningOverrides = {}): { game: Driver; events: GameEvent[] } {
    const game = bancaAt(80, 80, withBanca({ health: 1 }, holdStill(tuning)));
    const aim = { x: 80 + banca.width / 2, y: 80 + banca.height / 2 };
    const events = untilEvent(game, 'enemy-destroyed', { aim, fire: true });
    return { game, events };
  }

  it('is Gym Craft and pays its points when destroyed', () => {
    const { game, events } = destroyOne();
    const [destroyed] = eventsOf(events, 'enemy-destroyed');
    expect(destroyed).toMatchObject({
      kind: 'banca-artillada',
      craft: 'gym',
      points: banca.points,
    });
    expect(runOf(game.view).stats.score).toBe(banca.points);
    expect(runOf(game.view).stats.enemiesDestroyed).toBe(1);
  });

  it('is far tougher and worth far more than a Maletín-cóptero', () => {
    expect(banca.health).toBeGreaterThanOrEqual(10 * maletin.health);
    expect(banca.points).toBeGreaterThanOrEqual(10 * maletin.points);
  });

  it('is flagged always-Quip in the Enemy catalog', () => {
    expect(banca.alwaysQuip).toBe(true);
  });

  it('breaks apart in a large explosion with a hard screen shake', () => {
    expect(banca.explosion).toBe('large');
    const { game } = destroyOne();
    game.ticks(1);
    const { particles, shake } = runOf(game.view).effects;
    const debris = particles.filter((p): p is DebrisParticleView => p.kind === 'debris');
    expect(debris).toHaveLength(banca.debrisPieces);
    expect(new Set(debris.map((p) => p.enemyKind))).toEqual(new Set(['banca-artillada']));
    expect(Math.abs(shake.x) + Math.abs(shake.y)).toBeGreaterThan(0);
  });
});

describe('Destroying a Banca Artillada always triggers a Quip', () => {
  const SPOT = { x: 400, y: 200 };
  const AT_MALETIN = { x: SPOT.x + maletin.width / 2, y: SPOT.y + maletin.height / 2 };
  const BANCA = { x: 53, y: 67 };
  const AT_BANCA = { x: BANCA.x + banca.width / 2, y: BANCA.y + banca.height / 2 };

  function quipGame(quips: TuningOverrides['quips']): Driver {
    const tuning = holdStill({
      ...invincible,
      quips,
      enemies: {
        'maletin-coptero': { health: 1, fireIntervalMin: 99, fireIntervalMax: 99 },
        'banca-artillada': { health: 1, firstVolleyDelay: 99 },
      },
    });
    return drive({
      seed: 7,
      overrides: {
        tuning,
        spawns: [{ kind: 'maletin-coptero', ...SPOT }, bancaSpawn(BANCA.x, BANCA.y)],
      },
    });
  }

  it('replaces the Dialogue Box a Maletín-cóptero kill is showing with a gym Quip', () => {
    const game = quipGame({ chance: 1, cooldown: 60 });
    const first = eventsOf(
      untilEvent(game, 'quip-started', { aim: AT_MALETIN, fire: true }),
      'quip-started',
    );
    expect(first[0]?.theme).toBe('legal');

    const start = game.log.length;
    const events = untilEvent(game, 'enemy-destroyed', { aim: AT_BANCA, fire: true });
    const [destroyed] = eventsOf(events, 'enemy-destroyed');
    expect(destroyed?.kind).toBe('banca-artillada');
    const [started] = eventsOf(events, 'quip-started');
    expect(started).toMatchObject({ theme: 'gym', enemyId: destroyed?.enemyId });
    expect(runOf(game.view).dialogue?.quipId).toBe(started?.quipId);
    // The legal box never closed: the Banca's Quip replaced it.
    expect(eventsOf(game.log.slice(start), 'dialogue-closed')).toHaveLength(0);
  });

  it('triggers even when the Quip chance is zero', () => {
    const game = quipGame({ chance: 0 });
    game.holdFireToward(AT_MALETIN, 1);
    expect(eventsOf(game.log, 'quip-started')).toHaveLength(0);
    const events = untilEvent(game, 'enemy-destroyed', { aim: AT_BANCA, fire: true });
    expect(eventsOf(events, 'quip-started')).toHaveLength(1);
  });
});

describe('Banca Artillada in the Director', () => {
  /** Spawns due every half second; only the Banca may be picked. */
  const bancaOnlyRamp: TuningOverrides = {
    ...invincible,
    director: {
      firstSpawnDelay: 0,
      stages: [{ from: 0, onScreenCap: 20, spawnInterval: 0.5, fireRate: 1 }],
      roster: {
        'maletin-coptero': { weight: 0 },
        'archivador-artillado': { weight: 0 },
        'caminadora-a-reaccion': { weight: 0 },
      },
    },
  };

  it('has a roster entry from 120 s, at most one on screen', () => {
    expect(defaultTuning.director.roster['banca-artillada']).toMatchObject({
      from: 120,
      maxOnScreen: 1,
    });
  });

  it('only arrives after 120 s of ramp clock, and never more than one at a time', () => {
    const game = drive({ seed: 3, overrides: { tuning: bancaOnlyRamp } });
    expect(eventsOf(game.seconds(119.9), 'enemy-spawned')).toHaveLength(0);
    const arrived = eventsOf(game.seconds(0.2), 'enemy-spawned');
    expect(arrived.map((e) => e.kind)).toEqual(['banca-artillada']);

    let peak = 0;
    for (let t = 0; t < secondsToTicks(20); t++) {
      game.ticks(1);
      peak = Math.max(peak, runOf(game.view).enemies.length);
    }
    expect(peak).toBe(1);
  });
});
