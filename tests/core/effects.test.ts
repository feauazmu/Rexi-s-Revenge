/**
 * Combat feedback (hit flash, explosions, debris, screen shake), observed only through the
 * view. Effects are simulated by the Game core so they are deterministic and testable.
 */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  secondsToTicks,
  type GameOptions,
  type InputFramePatch,
  type ParticleView,
  type RunView,
  type ScriptedSpawn,
  type TuningOverrides,
} from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';

const fx = defaultTuning.effects;
const maletin = defaultTuning.enemies['maletin-coptero'];
const groundY = defaultTuning.arena.groundY;

const maletinAt = (x: number, y: number, atTick = 0): ScriptedSpawn => ({
  kind: 'maletin-coptero',
  x,
  y,
  atTick,
});
const centerOf = (x: number, y: number) => ({
  x: x + maletin.width / 2,
  y: y + maletin.height / 2,
});

/** One gavel destroys a Maletín-cóptero, so kills happen on a predictable tick. */
const oneShotKills: TuningOverrides = {
  weapons: { 'mazo-automatico': { damage: maletin.health } },
};

function arena(
  spawns: readonly ScriptedSpawn[],
  tuning: TuningOverrides = oneShotKills,
  options: Partial<GameOptions> = {},
): Driver {
  return drive({ ...options, overrides: { spawns, tuning } });
}

/** Fires at `target` tick by tick until an Enemy is destroyed; returns the ticks it took. */
function fireUntilKill(game: Driver, target: { x: number; y: number }, limit = 600): number {
  for (let t = 1; t <= limit; t++) {
    const events = game.ticks(1, { aim: target, fire: true });
    if (eventsOf(events, 'enemy-destroyed').length > 0) return t;
  }
  throw new Error('No Enemy was destroyed');
}

const particlesOf = (run: RunView, kind: ParticleView['kind']) =>
  run.effects.particles.filter((p) => p.kind === kind);

describe('Hit flash', () => {
  it('flashes an Enemy for the tuned duration after each hit', () => {
    const target = centerOf(300, 60);
    const game = arena([maletinAt(300, 60)], {});
    game.ticks(1, { aim: target });
    expect(runOf(game.view).enemies[0]?.hitFlash).toBe(false);

    // One gavel; wait for the tick it lands on.
    let events = game.ticks(1, { aim: target, fire: true });
    for (let t = 0; eventsOf(events, 'enemy-hit').length === 0; t++) {
      if (t > 120) throw new Error('The gavel never hit');
      events = game.ticks(1, { aim: target });
    }

    const duration = secondsToTicks(fx.hitFlash.duration);
    const flashing: boolean[] = [runOf(game.view).enemies[0]?.hitFlash ?? false];
    for (let i = 0; i < duration + 2; i++) {
      game.ticks(1, { aim: centerOf(300, 60) });
      flashing.push(runOf(game.view).enemies[0]?.hitFlash ?? false);
    }
    expect(flashing).toEqual([
      ...Array<boolean>(duration).fill(true),
      ...Array<boolean>(flashing.length - duration).fill(false),
    ]);
  });

  it('keeps showing the sprite between flashes under very rapid fire', () => {
    // Fire every tick: hits land on consecutive ticks, but flashes are spaced out.
    const game = arena([maletinAt(300, 60)], {
      enemies: { 'maletin-coptero': { health: 10_000 } },
      weapons: { 'mazo-automatico': { fireInterval: 0 } },
    });
    const samples: boolean[] = [];
    for (let i = 0; i < 120; i++) {
      game.ticks(1, { aim: centerOf(300, 60), fire: true });
      samples.push(runOf(game.view).enemies[0]?.hitFlash ?? false);
    }
    const lastSecond = samples.slice(60);
    expect(lastSecond).toContain(true);
    expect(lastSecond).toContain(false);
  });
});

describe('Explosions and debris', () => {
  it('blows a destroyed Enemy up where it was, with debris from its own sprite', () => {
    const game = arena([maletinAt(300, 60)]);
    fireUntilKill(game, centerOf(300, 60));
    const destroyed = eventsOf(game.log, 'enemy-destroyed')[0];
    const run = runOf(game.view);

    const burst = run.effects.particles.filter((p) => p.kind !== 'debris');
    const kinds = new Set(burst.map((p) => p.kind));
    expect(kinds).toEqual(new Set(['flash', 'fire', 'smoke', 'spark']));
    for (const p of burst) {
      expect(Math.hypot(p.x - (destroyed?.x ?? 0), p.y - (destroyed?.y ?? 0))).toBeLessThan(40);
    }

    const debris = particlesOf(run, 'debris');
    expect(debris).toHaveLength(maletin.debrisPieces);
    expect(debris.map((d) => (d.kind === 'debris' ? d.enemyKind : null))).toEqual(
      Array<string>(maletin.debrisPieces).fill('maletin-coptero'),
    );
    expect(debris.map((d) => (d.kind === 'debris' ? d.piece : -1))).toEqual(
      Array.from({ length: maletin.debrisPieces }, (_, i) => i),
    );
  });

  it('plays the explosion out over time: flash first, then fire and rising smoke', () => {
    const game = arena([maletinAt(300, 60)]);
    fireUntilKill(game, centerOf(300, 60));
    expect(particlesOf(runOf(game.view), 'flash')).not.toHaveLength(0);

    game.ticks(10);
    const run = runOf(game.view);
    expect(particlesOf(run, 'flash')).toHaveLength(0);
    const smoke = particlesOf(run, 'smoke');
    expect(smoke.length).toBeGreaterThan(0);
    const destroyed = eventsOf(game.log, 'enemy-destroyed')[0];
    const meanY = smoke.reduce((sum, p) => sum + p.y, 0) / smoke.length;
    expect(meanY).toBeLessThan(destroyed?.y ?? 0);
  });

  it('lets debris fall, settle on the ground and blink out', () => {
    const game = arena([maletinAt(300, 60)]);
    fireUntilKill(game, centerOf(300, 60));

    game.seconds(2);
    const settled = particlesOf(runOf(game.view), 'debris');
    expect(settled).toHaveLength(maletin.debrisPieces);
    for (const piece of settled) {
      expect(piece.y + piece.size / 2).toBeCloseTo(groundY, 0);
    }

    game.seconds(fx.debris.restTime + fx.debris.blinkTime + 1);
    expect(runOf(game.view).effects.particles).toHaveLength(0);
  });

  it('scales the explosion with the Enemy: large explosions throw more sparks', () => {
    const sparksAfterKill = (explosion: 'small' | 'large') => {
      const game = arena([maletinAt(300, 60)], {
        ...oneShotKills,
        enemies: { 'maletin-coptero': { explosion } },
      });
      fireUntilKill(game, centerOf(300, 60));
      return particlesOf(runOf(game.view), 'spark').length;
    };
    expect(sparksAfterKill('small')).toBe(fx.explosions.small.sparks);
    expect(sparksAfterKill('large')).toBe(fx.explosions.large.sparks);
    expect(fx.explosions.large.sparks).toBeGreaterThan(fx.explosions.small.sparks);
  });
});

describe('Screen shake', () => {
  const bigKill: TuningOverrides = {
    ...oneShotKills,
    enemies: { 'maletin-coptero': { explosion: 'large' } },
  };

  const shakeTrace = (tuning: TuningOverrides, ticks: number) => {
    const game = arena([maletinAt(300, 60)], tuning);
    const before = runOf(game.view).effects.shake;
    fireUntilKill(game, centerOf(300, 60));
    const trace = [runOf(game.view).effects.shake];
    for (let i = 0; i < ticks; i++) {
      game.ticks(1);
      trace.push(runOf(game.view).effects.shake);
    }
    return { before, trace };
  };

  it('is still until something explodes', () => {
    const game = arena([maletinAt(300, 60)]);
    game.seconds(2, { move: 1, jump: true, aim: { x: 0, y: 0 }, fire: true });
    expect(runOf(game.view).effects.shake).toEqual({ x: 0, y: 0 });
  });

  it('kicks the view by whole pixels after a big explosion, within the tuned maximum', () => {
    const { before, trace } = shakeTrace(bigKill, 10);
    expect(before).toEqual({ x: 0, y: 0 });
    expect(trace.some((s) => s.x !== 0 || s.y !== 0)).toBe(true);
    for (const s of trace) {
      expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(fx.shake.maxOffset);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(fx.shake.maxOffset);
    }
  });

  it('dies down shortly afterwards', () => {
    const settle = secondsToTicks(1 / fx.shake.traumaDecay) + 1;
    const { trace } = shakeTrace(bigKill, settle);
    expect(trace.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('shakes harder for bigger explosions', () => {
    const energy = (explosion: 'small' | 'large') =>
      shakeTrace({ ...oneShotKills, enemies: { 'maletin-coptero': { explosion } } }, 30)
        .trace.map((s) => Math.abs(s.x) + Math.abs(s.y))
        .reduce((a, b) => a + b, 0);
    expect(energy('large')).toBeGreaterThan(energy('small'));
  });

  it('can be turned off with the shake scale', () => {
    const { trace } = shakeTrace({ ...bigKill, effects: { shake: { scale: 0 } } }, 30);
    expect(trace.every((s) => s.x === 0 && s.y === 0)).toBe(true);
  });
});

describe('Determinism', () => {
  /** A busy scripted fight: several Maletín-cópteros destroyed while Rexi runs and jumps. */
  function fight(seed: number, tuning: TuningOverrides = oneShotKills) {
    const spawns = [maletinAt(300, 60), maletinAt(200, 50, 40), maletinAt(380, 90, 80)];
    const game = drive({ seed, overrides: { spawns, tuning } });
    const targets = [centerOf(300, 60), centerOf(200, 50), centerOf(380, 90)];
    const log = [];
    const views: RunView[] = [];
    for (let t = 0; t < 240; t++) {
      const input: InputFramePatch = {
        aim: targets[Math.min(2, Math.floor(t / 60))],
        fire: t % 20 < 2,
        move: t % 120 < 60 ? 0.5 : -0.5,
        jump: t % 70 < 2,
      };
      log.push(...game.ticks(1, input));
      views.push(runOf(game.view));
    }
    return { log, views };
  }

  it('reproduces every particle and shake offset for the same seed and inputs', () => {
    const a = fight(7);
    const b = fight(7);
    expect(eventsOf(a.log, 'enemy-destroyed').length).toBeGreaterThan(1);
    expect(b.views.map((v) => v.effects)).toEqual(a.views.map((v) => v.effects));
  });

  it('varies the particles with the seed', () => {
    const a = fight(7).views.map((v) => v.effects.particles);
    const b = fight(8).views.map((v) => v.effects.particles);
    expect(b).not.toEqual(a);
  });

  it('never changes gameplay: the Run plays out the same with effects disabled', () => {
    const withEffects = fight(7);
    const without = fight(7, { ...oneShotKills, effects: { maxParticles: 0 } });
    expect(without.views.every((v) => v.effects.particles.length === 0)).toBe(true);
    expect(without.log).toEqual(withEffects.log);
    const gameplay = (v: RunView) => ({ rexi: v.rexi, enemies: v.enemies, stats: v.stats });
    expect(without.views.map(gameplay)).toEqual(withEffects.views.map(gameplay));
  });
});

describe('Particle budget', () => {
  it('never holds more particles than the budget, dropping the oldest first', () => {
    const budget = 24;
    const spawns = [0, 30, 60, 90].map((t) => maletinAt(300, 60, t));
    const game = arena(spawns, { ...oneShotKills, effects: { maxParticles: budget } });

    let kills = 0;
    let peak = 0;
    for (let t = 0; t < 240; t++) {
      const events = game.ticks(1, { aim: centerOf(300, 60), fire: true });
      const run = runOf(game.view);
      peak = Math.max(peak, run.effects.particles.length);
      if (eventsOf(events, 'enemy-destroyed').length > 0) {
        kills += 1;
        // The newest explosion always survives the cut: its opening flash is on screen.
        expect(particlesOf(run, 'flash').some((p) => p.age === 0)).toBe(true);
      }
    }
    expect(kills).toBe(4);
    expect(peak).toBe(budget);
  });

  it('does not grow over a long Run and empties once the fighting stops', () => {
    const minutes = 10;
    const every = 45;
    const ticks = minutes * 60 * 60;
    const spawns = Array.from({ length: Math.floor(ticks / every) }, (_, i) =>
      maletinAt(140 + ((i * 97) % 280), 30 + ((i * 53) % 120), i * every),
    );
    // No Quips: Hit-stops would push the scripted spawns past the end of the loop.
    const game = arena(spawns, { ...oneShotKills, quips: { chance: 0 } });

    let peak = 0;
    let kills = 0;
    for (let t = 0; t < ticks; t++) {
      const target = runOf(game.view).enemies[0];
      const aim = target ? { x: target.x + target.w / 2, y: target.y + target.h / 2 } : undefined;
      const events = game.ticks(1, aim ? { aim, fire: t % 2 === 0 } : {});
      kills += eventsOf(events, 'enemy-destroyed').length;
      peak = Math.max(peak, runOf(game.view).effects.particles.length);
    }
    expect(kills).toBeGreaterThan(spawns.length * 0.9);
    expect(peak).toBeLessThanOrEqual(fx.maxParticles);

    game.seconds(10);
    expect(runOf(game.view).enemies).toHaveLength(0);
    expect(runOf(game.view).effects.particles).toHaveLength(0);
    expect(runOf(game.view).effects.shake).toEqual({ x: 0, y: 0 });
  });
});
