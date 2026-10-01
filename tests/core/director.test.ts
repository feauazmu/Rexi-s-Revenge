/** The spawn Director: continuous, seeded Enemy arrivals that escalate with the ramp clock. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  ENEMY_KINDS,
  type EnemyKind,
  SCREEN_WIDTH,
  secondsToTicks,
  rampAt,
  type EnemyView,
  type GameOptions,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';

const director = defaultTuning.director;
const maletin = defaultTuning.enemies['maletin-coptero'];

/** Rexi survives anything, so long Runs keep going. */
const invincible: TuningOverrides = { rexi: { maxHealth: 1_000_000_000 } };

function directed(options: Partial<GameOptions> & { tuning?: TuningOverrides } = {}): Driver {
  const { tuning, ...rest } = options;
  return drive({ ...rest, overrides: { tuning: { ...invincible, ...tuning } } });
}

const enemiesOf = (game: Driver): readonly EnemyView[] => runOf(game.view).enemies;

/** Advances `seconds`, returning the most Enemies seen on screen at once. */
function peakOnScreen(game: Driver, seconds: number): number {
  let peak = 0;
  for (let t = 0; t < secondsToTicks(seconds); t++) {
    game.ticks(1);
    peak = Math.max(peak, enemiesOf(game).length);
  }
  return peak;
}

/** A Run that releases one Maletín-cóptero per second, with the given ramp steps. */
function fastRamp(tuning: TuningOverrides['director']): TuningOverrides {
  return { director: { firstSpawnDelay: 0, ...tuning } };
}

describe('The first minute', () => {
  it('sends only Maletín-cópteros, never more than 3 on screen', () => {
    const game = directed({ seed: 7 });
    const peak = peakOnScreen(game, 59.9);
    expect(peak).toBe(3);
    const spawned = eventsOf(game.log, 'enemy-spawned');
    expect(spawned.length).toBeGreaterThanOrEqual(3);
    expect(new Set(spawned.map((e) => e.kind))).toEqual(new Set(['maletin-coptero']));
  });

  it('keeps sending Maletín-cópteros as Rexi destroys them, still capped at 3', () => {
    const game = directed({
      seed: 3,
      tuning: { weapons: { 'mazo-automatico': { damage: maletin.health } } },
    });
    let peak = 0;
    for (let t = 0; t < secondsToTicks(59.9); t++) {
      // Shoot at the oldest Enemy inside the Arena.
      const target = enemiesOf(game).find((e) => e.x > 0 && e.x + e.w < SCREEN_WIDTH);
      const aim = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : undefined;
      game.ticks(1, aim ? { aim, fire: true } : {});
      peak = Math.max(peak, enemiesOf(game).length);
    }
    expect(peak).toBeLessThanOrEqual(3);
    expect(runOf(game.view).stats.enemiesDestroyed).toBeGreaterThan(3);
    expect(eventsOf(game.log, 'enemy-spawned').length).toBeGreaterThan(6);
  });

  it('waits the first-spawn delay before the first Enemy arrives', () => {
    const game = directed({ tuning: { director: { firstSpawnDelay: 2 } } });
    expect(eventsOf(game.seconds(1.95), 'enemy-spawned')).toHaveLength(0);
    expect(eventsOf(game.seconds(0.1), 'enemy-spawned')).toHaveLength(1);
  });
});

describe('The ramp table', () => {
  it('raises the on-screen cap ramp step by ramp step with the default table', () => {
    const game = directed({ seed: 11 });
    const peaks = [0, 60, 120, 180].map(() => peakOnScreen(game, 60));
    expect(peaks).toEqual(director.steps.slice(0, 4).map((s) => s.onScreenCap));
    expect(peaks).toEqual([3, 4, 5, 6]);
    // The last ramp step starts at 4:00 with a cap of 7, which growth then raises.
    expect(peakOnScreen(game, 30)).toBe(7);
  });

  it('keeps raising the on-screen cap after the last ramp step, with no hard limit', () => {
    const game = directed({
      tuning: fastRamp({
        steps: [{ from: 0, onScreenCap: 1, spawnInterval: 0.25, fireRate: 1 }],
        growth: { timeScale: 2, onScreenCap: 2, spawnPace: 0, fireRate: 0 },
      }),
    });
    // cap = floor(1 + 2 ln(1 + t / 2)): 1 until 1.3 s, 2 until 3.4 s, 3 until 7 s, 4 until 12.8 s…
    const peaks = [1, 2, 3.5, 5.5, 8].map((seconds) => peakOnScreen(game, seconds));
    expect(peaks).toEqual([1, 2, 3, 4, 5]);
  });

  it('spaces spawns by the ramp step spawn interval', () => {
    const game = directed({
      tuning: fastRamp({
        steps: [
          { from: 0, onScreenCap: 20, spawnInterval: 2, fireRate: 1 },
          { from: 10, onScreenCap: 20, spawnInterval: 1, fireRate: 1 },
        ],
        growth: { timeScale: 0 },
      }),
    });
    expect(eventsOf(game.seconds(10), 'enemy-spawned')).toHaveLength(5);
    expect(eventsOf(game.seconds(5), 'enemy-spawned')).toHaveLength(5);
  });

  it('keeps shortening the spawn interval after the last ramp step', () => {
    const game = directed({
      tuning: fastRamp({
        steps: [{ from: 0, onScreenCap: 500, spawnInterval: 2, fireRate: 1 }],
        growth: { timeScale: 10, spawnPace: 2, onScreenCap: 0, fireRate: 0 },
      }),
    });
    const counts = [0, 1, 2, 3].map(() => eventsOf(game.seconds(15), 'enemy-spawned').length);
    counts.slice(1).forEach((count, i) => {
      expect(count).toBeGreaterThan(counts[i] ?? Infinity);
    });
  });

  it('raises the Enemy fire rate ramp step by ramp step', () => {
    const game = drive({
      overrides: {
        spawns: [{ kind: 'maletin-coptero', x: 400, y: 80 }],
        tuning: {
          ...invincible,
          enemies: {
            'maletin-coptero': { fireIntervalMin: 1, fireIntervalMax: 1, driftSpeed: 0 },
          },
          director: {
            steps: [
              { from: 0, onScreenCap: 3, spawnInterval: 3, fireRate: 1 },
              { from: 10, onScreenCap: 3, spawnInterval: 3, fireRate: 2 },
            ],
            growth: { timeScale: 0 },
          },
        },
      },
    });
    expect(eventsOf(game.seconds(10.05), 'enemy-fired')).toHaveLength(10);
    expect(eventsOf(game.seconds(10), 'enemy-fired')).toHaveLength(20);
  });

  it('keeps raising the fire rate after the last ramp step', () => {
    const game = drive({
      overrides: {
        spawns: [{ kind: 'maletin-coptero', x: 400, y: 80 }],
        tuning: {
          ...invincible,
          enemies: {
            'maletin-coptero': { fireIntervalMin: 1, fireIntervalMax: 1, driftSpeed: 0 },
          },
          director: {
            steps: [{ from: 0, onScreenCap: 3, spawnInterval: 3, fireRate: 1 }],
            growth: { timeScale: 10, fireRate: 1, spawnPace: 0, onScreenCap: 0 },
          },
        },
      },
    });
    const counts = [0, 1, 2, 3].map(() => eventsOf(game.seconds(20), 'enemy-fired').length);
    counts.slice(1).forEach((count, i) => {
      expect(count).toBeGreaterThan(counts[i] ?? Infinity);
    });
  });

  it('has a default table whose cap, pace and fire rate only ever escalate', () => {
    const { steps } = director;
    expect(steps[0]).toMatchObject({ from: 0, onScreenCap: 3 });
    steps.slice(1).forEach((step, i) => {
      const previous = steps[i] ?? expect.unreachable();
      expect(step.from).toBeGreaterThan(previous.from);
      expect(step.onScreenCap).toBeGreaterThanOrEqual(previous.onScreenCap);
      expect(step.spawnInterval).toBeLessThanOrEqual(previous.spawnInterval);
      expect(step.fireRate).toBeGreaterThanOrEqual(previous.fireRate);
    });
    expect(steps.some((s) => s.from === 60)).toBe(true);
    expect(director.growth.onScreenCap).toBeGreaterThan(0);
    expect(director.growth.spawnPace).toBeGreaterThan(0);
    expect(director.growth.fireRate).toBeGreaterThan(0);
  });
});

describe('Endless escalation', () => {
  const at = (minutes: number) => rampAt(director, minutes * 60);

  it('is harder at 10 minutes than at 6', () => {
    const six = at(6);
    const ten = at(10);
    expect(ten.fireRate).toBeGreaterThan(six.fireRate);
    expect(ten.spawnInterval).toBeLessThan(six.spawnInterval);
    expect(ten.onScreenCap).toBeGreaterThan(six.onScreenCap);
  });

  it('never plateaus: fire rate and pace keep climbing every minute, and the cap creeps up', () => {
    for (let minute = 4; minute < 60; minute++) {
      expect(at(minute + 1).fireRate).toBeGreaterThan(at(minute).fireRate);
      expect(at(minute + 1).spawnInterval).toBeLessThan(at(minute).spawnInterval);
      expect(at(minute + 1).onScreenCap).toBeGreaterThanOrEqual(at(minute).onScreenCap);
    }
    expect(at(60).onScreenCap).toBeGreaterThan(at(20).onScreenCap);
  });

  it('climbs ever more slowly, with no cliff after the last ramp step', () => {
    const rise = (from: number, to: number) => at(to).fireRate - at(from).fireRate;
    expect(rise(5, 6)).toBeLessThan(rise(4, 5));
    expect(rise(20, 21)).toBeLessThan(rise(5, 6));
    // The first minute of growth climbs about as much as one ramp step did.
    expect(rise(4, 5)).toBeLessThanOrEqual(0.15);
    expect(at(4 + 1 / 60).spawnInterval).toBeCloseTo(at(4).spawnInterval, 1);
  });
});

describe('The roster', () => {
  it('keeps a kind out until its start time', () => {
    const game = directed({
      tuning: fastRamp({ roster: { 'maletin-coptero': { from: 5 } } }),
    });
    expect(eventsOf(game.seconds(4.95), 'enemy-spawned')).toHaveLength(0);
    expect(eventsOf(game.seconds(5), 'enemy-spawned').length).toBeGreaterThan(0);
  });

  it("respects a kind's own on-screen limit under the global cap", () => {
    const game = directed({
      tuning: fastRamp({ roster: { 'maletin-coptero': { maxOnScreen: 1 } } }),
    });
    expect(peakOnScreen(game, 20)).toBe(1);
  });

  it('lets Maletín-cópteros in from the very start', () => {
    expect(director.roster['maletin-coptero']).toMatchObject({ from: 0 });
  });
});

describe('Where Enemies enter', () => {
  it('enters just outside the left or right edge, within the altitude band', () => {
    const game = directed({ seed: 5, tuning: { director: { firstSpawnDelay: 0 } } });
    const entry = director.roster['maletin-coptero'];
    const sides = new Set<string>();
    for (let t = 0; t < secondsToTicks(120); t++) {
      const spawned = eventsOf(game.ticks(1), 'enemy-spawned');
      for (const { enemyId } of spawned) {
        const enemy = enemiesOf(game).find((e) => e.id === enemyId) ?? expect.unreachable();
        // It has had one tick to move since spawning.
        const side = enemy.x < SCREEN_WIDTH / 2 ? 'left' : 'right';
        sides.add(side);
        if (side === 'left') expect(enemy.x + enemy.w).toBeLessThanOrEqual(2);
        else expect(enemy.x).toBeGreaterThanOrEqual(SCREEN_WIDTH - 2);
        expect(enemy.y).toBeGreaterThanOrEqual(entry.minY - maletin.hoverAmplitude);
        expect(enemy.y).toBeLessThanOrEqual(entry.maxY + maletin.hoverAmplitude);
      }
    }
    expect(sides).toEqual(new Set(['left', 'right']));
  });

  it('enters from the top when the roster says so', () => {
    const game = directed({
      seed: 5,
      tuning: fastRamp({ roster: { 'maletin-coptero': { edges: ['top'] } } }),
    });
    const spawned = eventsOf(game.ticks(1), 'enemy-spawned');
    expect(spawned).toHaveLength(1);
    const [enemy] = enemiesOf(game);
    expect((enemy?.y ?? 0) + (enemy?.h ?? 0)).toBeLessThanOrEqual(maletin.hoverAmplitude + 2);
    expect(enemy?.x).toBeGreaterThanOrEqual(0);
    expect((enemy?.x ?? 0) + (enemy?.w ?? 0)).toBeLessThanOrEqual(SCREEN_WIDTH);
  });

  it('flies into the Arena after entering', () => {
    const game = directed({ seed: 9, tuning: { director: { firstSpawnDelay: 0 } } });
    game.seconds(8);
    const settled = enemiesOf(game).filter((e) => e.age > secondsToTicks(4));
    expect(settled.length).toBeGreaterThan(0);
    for (const enemy of settled) {
      expect(enemy.x).toBeGreaterThanOrEqual(0);
      expect(enemy.x + enemy.w).toBeLessThanOrEqual(SCREEN_WIDTH);
    }
  });
});

describe('Seeding', () => {
  const arrivals = (seed: number) => {
    const game = directed({ seed });
    const log: string[] = [];
    for (let t = 0; t < secondsToTicks(30); t++) {
      for (const { enemyId } of eventsOf(game.ticks(1), 'enemy-spawned')) {
        const e = enemiesOf(game).find((enemy) => enemy.id === enemyId);
        log.push(`${t}:${e?.kind}@${e?.x.toFixed(2)},${e?.y.toFixed(2)}`);
      }
    }
    return log;
  };

  it('replays the same arrivals for the same seed, and different ones for another', () => {
    expect(arrivals(42)).toEqual(arrivals(42));
    expect(arrivals(42)).not.toEqual(arrivals(43));
  });
});

describe('Overriding the Director', () => {
  it('sends nothing at all when the scripted spawn list is empty', () => {
    const game = drive({ overrides: { spawns: [], tuning: invincible } });
    expect(eventsOf(game.seconds(90), 'enemy-spawned')).toHaveLength(0);
    expect(enemiesOf(game)).toHaveLength(0);
  });

  it('sends exactly the scripted Enemies, and no others', () => {
    const game = drive({
      overrides: {
        spawns: [
          { kind: 'maletin-coptero', x: 133, y: 53, atTick: 10 },
          { kind: 'maletin-coptero', x: 400, y: 80, atTick: 200 },
        ],
        tuning: invincible,
      },
    });
    const spawned = eventsOf(game.seconds(90), 'enemy-spawned');
    expect(spawned).toHaveLength(2);
  });
});

describe('The ramp clock', () => {
  it('starts at zero and counts simulated Run ticks', () => {
    const game = directed();
    expect(runOf(game.view).rampTicks).toBe(0);
    game.seconds(10);
    expect(runOf(game.view).rampTicks).toBe(secondsToTicks(10));
    expect(runOf(game.view).rampTicks).toBe(runOf(game.view).tick);
  });

  it('does not advance while the Run is not being simulated, and restarts with a new Run', () => {
    const game = drive({
      overrides: {
        spawns: [{ kind: 'maletin-coptero', x: 400, y: 80 }],
        tuning: {
          rexi: { maxHealth: 5, invulnerability: 0.1 },
          enemies: {
            'maletin-coptero': {
              fireIntervalMin: 0.5,
              fireIntervalMax: 0.5,
              aimError: 0,
              driftSpeed: 0,
            },
          },
        },
      },
    });
    while (!runOf(game.view).ended) game.ticks(1);
    const atEnd = runOf(game.view).rampTicks;
    expect(atEnd).toBeGreaterThan(0);
    game.ticks(30);
    expect(runOf(game.view).rampTicks).toBe(atEnd);
    // The Game goes back to the Title; starting again begins a new Run with a fresh ramp clock.
    for (let i = 0; i < 1000 && game.view.screen === 'run'; i++) game.ticks(1);
    for (let i = 0; i < 1000 && game.view.screen !== 'run'; i++) {
      game.ticks(1, { start: game.view.startReady });
    }
    expect(runOf(game.view).ended).toBe(false);
    expect(runOf(game.view).rampTicks).toBe(0);
  });

  it('does not advance while paused, nor does the Director send anything', () => {
    const game = directed({ seed: 4, tuning: { director: { firstSpawnDelay: 0 } } });
    game.seconds(5);
    const before = runOf(game.view).rampTicks;
    game.pause();
    expect(game.view.screen).toBe('paused');
    const events = game.seconds(10);
    expect(runOf(game.view).rampTicks).toBe(before);
    expect(eventsOf(events, 'enemy-spawned')).toHaveLength(0);

    game.ticks(1, { pause: true });
    expect(game.view.screen).toBe('run');
    game.ticks(1);
    expect(runOf(game.view).rampTicks).toBe(before + 1);
  });

  it('does not advance during Hit-stop, and resumes with the Run', () => {
    const spot = { x: 400, y: 200 };
    const aim = { x: spot.x + 12, y: spot.y + 9 };
    const hitStopTicks = secondsToTicks(defaultTuning.quips.hitStop);
    const game = drive({
      seed: 7,
      overrides: {
        spawns: [{ kind: 'maletin-coptero', ...spot }],
        tuning: {
          ...invincible,
          quips: { chance: 1 },
          enemies: { 'maletin-coptero': { health: 1, driftSpeed: 0 } },
        },
      },
    });
    let started = false;
    for (let i = 0; i < 600 && !started; i++) {
      started = eventsOf(game.ticks(1, { aim, fire: true }), 'quip-started').length > 0;
    }
    expect(started).toBe(true);

    const before = runOf(game.view);
    expect(before.hitStop).toBe(hitStopTicks);
    game.ticks(hitStopTicks);
    expect(runOf(game.view).rampTicks).toBe(before.rampTicks);
    game.ticks(1);
    expect(runOf(game.view).rampTicks).toBe(before.rampTicks + 1);
    expect(runOf(game.view).rampTicks).toBe(runOf(game.view).tick);
  });
});

describe('A default Director-driven Run', () => {
  it('runs 4 minutes with an invulnerable Rexi and sends every Enemy kind', () => {
    // Default tuning except a Rexi who cannot die and a Mazo that one-shots, so the Director
    // keeps sending fresh Enemies as Rexi clears the oldest one inside the Arena.
    const game = drive({
      seed: 7,
      overrides: { tuning: { ...invincible, weapons: { 'mazo-automatico': { damage: 1000 } } } },
    });
    const seen = new Set<EnemyKind>();
    for (let t = 0; t < secondsToTicks(4 * 60); t++) {
      const enemies = runOf(game.view).enemies;
      const target = enemies.find((e) => e.x > 0 && e.x + e.w < SCREEN_WIDTH);
      const aim = target && { x: target.x + target.w / 2, y: target.y + target.h / 2 };
      const events = game.ticks(1, aim ? { aim, fire: true } : {});
      for (const e of eventsOf(events, 'enemy-spawned')) seen.add(e.kind);
      expect(eventsOf(events, 'run-ended')).toHaveLength(0);
    }
    expect(game.view.screen).toBe('run');
    expect(runOf(game.view).ended).toBe(false);
    expect([...seen].sort()).toEqual([...ENEMY_KINDS].sort());
  });
});
