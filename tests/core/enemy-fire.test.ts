/** Enemy fire, Rexi's health and invulnerability, and the end of a Run. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  secondsToTicks,
  type GameEvent,
  type ScriptedSpawn,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';

const maletin = defaultTuning.enemies['maletin-coptero'];
const rexiTuning = defaultTuning.rexi;

const maletinAt = (x: number, y: number, atTick = 0): ScriptedSpawn => ({
  kind: 'maletin-coptero',
  x,
  y,
  atTick,
});

/** A Maletín-cóptero that fires a perfectly aimed paper every `interval` seconds. */
function sharpshooter(interval: number, extra: TuningOverrides = {}): TuningOverrides {
  return {
    ...extra,
    enemies: {
      'maletin-coptero': {
        fireIntervalMin: interval,
        fireIntervalMax: interval,
        aimError: 0,
        ...extra.enemies?.['maletin-coptero'],
      },
    },
  };
}

/** Ticks one at a time until `type` is emitted; returns the tick count and that tick's events. */
function untilEvent(game: Driver, type: GameEvent['type'], maxTicks = 60 * 60) {
  for (let tick = 1; tick <= maxTicks; tick++) {
    const events = game.ticks(1);
    if (events.some((e) => e.type === type)) return { tick, events };
  }
  throw new Error(`No ${type} event within ${maxTicks} ticks`);
}

describe('Maletín-cóptero fire', () => {
  it('shoots papers at Rexi at its configured interval', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)], tuning: sharpshooter(1) } });
    const fired = eventsOf(game.seconds(5.05), 'enemy-fired');
    expect(fired).toHaveLength(5);
    expect(fired[0]).toMatchObject({ kind: 'maletin-coptero' });
  });

  it('waits a random time between its tuned bounds before each shot', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)] } });
    const ticks: number[] = [];
    for (let t = 1; t <= 60 * 30; t++) {
      if (eventsOf(game.ticks(1, { move: t % 240 < 120 ? 1 : -1 }), 'enemy-fired').length) {
        ticks.push(t);
      }
    }
    const gaps = ticks.slice(1).map((t, i) => t - (ticks[i] ?? 0));
    expect(gaps.length).toBeGreaterThan(5);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(secondsToTicks(maletin.fireIntervalMin) - 1);
      expect(gap).toBeLessThanOrEqual(secondsToTicks(maletin.fireIntervalMax) + 1);
    }
  });

  it('fires visible enemy papers that fly toward Rexi', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)], tuning: sharpshooter(1) } });
    game.seconds(1.1);
    const run = runOf(game.view);
    const papers = run.projectiles.filter((p) => p.owner === 'enemy');
    expect(papers).toHaveLength(1);
    const paper = papers[0];
    expect(paper?.kind).toBe('paper');
    expect(Math.hypot(paper?.vx ?? 0, paper?.vy ?? 0)).toBeCloseTo(maletin.paperSpeed, 3);
    // Heading down and to the left, where Rexi stands.
    expect(paper?.vx).toBeLessThan(0);
    expect(paper?.vy).toBeGreaterThan(0);
  });

  it('can be dodged: a paper aimed at Rexi misses once he runs away', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)], tuning: sharpshooter(5) } });
    game.seconds(5.05);
    expect(runOf(game.view).projectiles).toHaveLength(1);
    const events = game.seconds(3, { move: -1 });
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(0);
    expect(runOf(game.view).rexi.health).toBe(rexiTuning.maxHealth);
    // The paper hit the ground and is gone.
    expect(runOf(game.view).projectiles).toHaveLength(0);
  });
});

describe("Rexi's health", () => {
  it('drops by the paper damage when a paper hits him', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)], tuning: sharpshooter(1) } });
    const { events } = untilEvent(game, 'rexi-hit');
    const [hit] = eventsOf(events, 'rexi-hit');
    expect(hit).toEqual({
      type: 'rexi-hit',
      damage: maletin.paperDamage,
      health: rexiTuning.maxHealth - maletin.paperDamage,
    });
    expect(runOf(game.view).rexi.health).toBe(rexiTuning.maxHealth - maletin.paperDamage);
  });

  it('uses the configured paper damage', () => {
    const game = drive({
      overrides: {
        spawns: [maletinAt(300, 60)],
        tuning: sharpshooter(1, { enemies: { 'maletin-coptero': { paperDamage: 13 } } }),
      },
    });
    untilEvent(game, 'rexi-hit');
    expect(runOf(game.view).rexi.health).toBe(rexiTuning.maxHealth - 13);
  });

  it('removes a paper when it hits him', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)], tuning: sharpshooter(10) } });
    untilEvent(game, 'rexi-hit');
    expect(runOf(game.view).projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(0);
  });

  it('is not hurt by his own gavels', () => {
    const game = drive({ overrides: { spawns: [] } });
    const events = game.holdFireToward({ x: 127, y: 300 }, 2);
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(0);
  });
});

describe('Invulnerability after a hit', () => {
  const rapidFire = (invulnerability: number) =>
    drive({
      overrides: {
        spawns: [maletinAt(300, 60)],
        tuning: sharpshooter(0.1, { rexi: { invulnerability } }),
      },
    });

  it('ignores hits for the configured window, then can be hurt again', () => {
    const game = rapidFire(1);
    untilEvent(game, 'rexi-hit');
    const window = secondsToTicks(1);
    const second = untilEvent(game, 'rexi-hit');
    expect(second.tick).toBeGreaterThanOrEqual(window);
    expect(second.tick).toBeLessThanOrEqual(window + secondsToTicks(0.2));
  });

  it('spaces every hit by at least the window over a long barrage', () => {
    const invulnerability = 0.5;
    const game = rapidFire(invulnerability);
    const hitTicks: number[] = [];
    for (let t = 1; t <= 60 * 8; t++) {
      if (eventsOf(game.ticks(1), 'rexi-hit').length) hitTicks.push(t);
    }
    expect(hitTicks.length).toBeGreaterThan(5);
    const gaps = hitTicks.slice(1).map((t, i) => t - (hitTicks[i] ?? 0));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(secondsToTicks(invulnerability));
  });

  it('shows the hurt reaction and invulnerability in the view, counting down', () => {
    const game = rapidFire(1);
    expect(runOf(game.view).rexi).toMatchObject({ hurtTicks: 0, invulnerableTicks: 0 });

    untilEvent(game, 'rexi-hit');
    const hurt = runOf(game.view).rexi;
    expect(hurt.invulnerableTicks).toBe(secondsToTicks(1));
    expect(hurt.hurtTicks).toBe(secondsToTicks(rexiTuning.hurtDuration));

    game.ticks(10);
    expect(runOf(game.view).rexi.invulnerableTicks).toBe(secondsToTicks(1) - 10);
    game.seconds(rexiTuning.hurtDuration);
    expect(runOf(game.view).rexi.hurtTicks).toBe(0);
  });
});

describe('End of the Run', () => {
  /** Rexi with 10 health against a fast sharpshooter that does 5 per paper. */
  const doomed = (spawns: ScriptedSpawn[]) =>
    drive({
      overrides: {
        spawns,
        tuning: sharpshooter(0.5, {
          rexi: { maxHealth: 10, invulnerability: 0.2 },
          enemies: { 'maletin-coptero': { paperDamage: 5 } },
          // One gavel destroys a Maletín-cóptero.
          weapons: { 'mazo-automatico': { damage: maletin.health } },
        }),
      },
    });

  it('emits run-ended with the score, Enemies destroyed and time survived at zero health', () => {
    // The first Maletín-cóptero is shot down; the second, out of reach of the gavels, wins.
    const game = doomed([maletinAt(300, 60), maletinAt(440, 20, 120)]);
    game.holdFireToward({ x: 312, y: 69 }, 0.1);
    game.seconds(0.9);
    expect(runOf(game.view).stats.enemiesDestroyed).toBe(1);
    expect(runOf(game.view).rexi.health).toBe(10);
    const elapsed = secondsToTicks(1);

    const { tick, events } = untilEvent(game, 'run-ended');
    const [ended] = eventsOf(events, 'run-ended');
    expect(ended).toEqual({
      type: 'run-ended',
      score: maletin.points,
      enemiesDestroyed: 1,
      ticksSurvived: elapsed + tick,
    });
    expect(eventsOf(game.log, 'run-ended')).toHaveLength(1);
    expect(runOf(game.view).rexi.health).toBe(0);
    expect(runOf(game.view).stats.ticksSurvived).toBe(elapsed + tick);
  });

  it('happens in the same tick as the fatal hit', () => {
    const game = doomed([maletinAt(300, 60)]);
    const { events } = untilEvent(game, 'run-ended');
    expect(eventsOf(events, 'rexi-hit')).toEqual([{ type: 'rexi-hit', damage: 5, health: 0 }]);
  });

  it('freezes the ended Run and marks it as ended', () => {
    const game = doomed([maletinAt(300, 60)]);
    expect(runOf(game.view).ended).toBe(false);
    untilEvent(game, 'run-ended');
    const atEnd = runOf(game.view);
    expect(atEnd.ended).toBe(true);

    const after = game.ticks(30, { move: 1, fire: true });
    expect(after).toEqual([]);
    expect(runOf(game.view)).toMatchObject({
      ended: true,
      stats: atEnd.stats,
      rexi: { x: atEnd.rexi.x, health: 0 },
    });
  });

  it('opens the Veredicto shortly afterwards (see verdict.test.ts)', () => {
    const game = doomed([maletinAt(300, 60)]);
    untilEvent(game, 'run-ended');
    const { tick } = untilEvent(game, 'screen-changed', 60 * 5);
    expect(tick).toBeGreaterThan(30);
    expect(game.view).toMatchObject({ screen: 'verdict', run: { ended: true } });
  });

  it('cannot be paused once over', () => {
    const game = doomed([maletinAt(300, 60)]);
    untilEvent(game, 'run-ended');
    game.ticks(1, { pause: true });
    game.pause();
    expect(game.view.screen).toBe('run');
  });
});

describe('Projectile bookkeeping', () => {
  it('stays bounded over a long Run: papers that miss leave the Arena', () => {
    const game = drive({
      overrides: { tuning: { rexi: { maxHealth: 1_000_000 } } },
    });
    let peak = 0;
    let fired = 0;
    for (let second = 0; second < 10 * 60; second++) {
      // Run back and forth so plenty of papers miss and hit the ground or fly off-screen.
      const events = game.seconds(1, { move: second % 4 < 2 ? 1 : -1, jump: second % 3 === 0 });
      fired += eventsOf(events, 'enemy-fired').length;
      peak = Math.max(peak, runOf(game.view).projectiles.length);
    }
    expect(fired).toBeGreaterThan(100);
    expect(peak).toBeLessThanOrEqual(5);
  });
});
