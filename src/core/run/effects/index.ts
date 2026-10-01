/**
 * Combat feedback: hit flash, explosions, debris and screen shake.
 *
 * Effects are simulated in the core so they are deterministic and testable through the view,
 * but they are purely cosmetic: they draw only from their own random stream (`EffectsState.rng`,
 * seeded from the Game seed) and never read or change gameplay state, so tuning them can never
 * alter how a Run plays out.
 *
 * Other subsystems use the verbs below: `flashEnemy` on every hit, `shatterEnemy` when an
 * Enemy is destroyed, `explode` / `addShakeTrauma` for anything else that blows up
 * (explosive Weapons, Rexi getting hurt), and `puffSmoke` for rocket trails.
 */
import { secondsToTicks } from '../../constants';
import { center, type Vec2 } from '../../math';
import { createRng, type Rng } from '../../rng';
import type { EffectsTuning, ExplosionSize, Tuning } from '../../tuning';
import type { EffectsView } from '../../view';
import type { RunContext } from '../context';
import type { EnemyState } from '../state';
import {
  DEBRIS_AIR_LIFE,
  spawnParticle,
  stepParticles,
  viewParticle,
  type ParticlePool,
  type ParticleState,
} from './particles';
import { addTrauma, createShake, shakeOffset, stepShake, type ShakeState } from './shake';

export interface EffectsState extends ParticlePool {
  readonly list: ParticleState[];
  readonly rng: Rng;
  readonly shake: ShakeState;
}

/** `seed` is the effects stream's own seed (see `deriveSeed`), never the gameplay Rng. */
export function createEffects(seed: number): EffectsState {
  const rng = createRng(seed);
  const shakeSeedX = rng.int(0, 0x7fffffff);
  const shakeSeedY = rng.int(0, 0x7fffffff);
  return { list: [], rng, shake: createShake(shakeSeedX, shakeSeedY) };
}

/** Advances every effect one tick. Runs first in the tick, so new effects show at age 0. */
export function stepEffects(ctx: RunContext): void {
  const { effects } = ctx.state;
  stepShake(effects.shake, ctx.tuning.effects.shake);
  stepParticles(effects, ctx.tuning.effects, ctx.tuning.arena.groundY);
}

/** Adds screen-shake trauma (0..1) without an explosion, e.g. when Rexi is hurt. */
export function addShakeTrauma(ctx: RunContext, amount: number): void {
  addTrauma(ctx.state.effects.shake, amount);
}

/**
 * Starts the white hit flash on an Enemy. Re-triggers are spaced by `hitFlash.minInterval`,
 * so even very rapid fire keeps showing the sprite between flashes.
 */
export function flashEnemy(ctx: RunContext, enemy: EnemyState): void {
  const { tick } = ctx.state;
  const minInterval = secondsToTicks(ctx.tuning.effects.hitFlash.minInterval);
  if (enemy.hitFlashTick === null || tick - enemy.hitFlashTick >= minInterval) {
    enemy.hitFlashTick = tick;
  }
}

/** Whether an Enemy is drawn flashing, given the Run tick the view is taken at. */
export function isHitFlashing(enemy: Readonly<EnemyState>, tick: number, tuning: Tuning): boolean {
  if (enemy.hitFlashTick === null) return false;
  // A hit during the step at tick T is first visible in the view taken after it (tick T + 1).
  const shown = tick - enemy.hitFlashTick;
  return shown >= 1 && shown <= secondsToTicks(tuning.effects.hitFlash.duration);
}

/** A destroyed Enemy breaks into debris and blows up with its kind's explosion preset. */
export function shatterEnemy(ctx: RunContext, enemy: Readonly<EnemyState>): void {
  const { explosion, debrisPieces } = ctx.tuning.enemies[enemy.kind];
  spawnDebris(ctx, enemy, debrisPieces);
  explode(ctx, center(enemy), explosion);
}

/** A complete explosion at `at`: flash, fireballs, smoke, sparks and screen shake. */
export function explode(ctx: RunContext, at: Vec2, size: ExplosionSize): void {
  const { effects } = ctx.state;
  const tuning = ctx.tuning.effects;
  const preset = tuning.explosions[size];
  const p = tuning.particles;
  const { rng } = effects;

  // Spawned least important first: if the budget is tight, the oldest particles (and the
  // first of this burst) are dropped, while the flash always survives.
  for (let i = 0; i < preset.sparks; i++) {
    // Mostly upward, like a fountain.
    const angle = rng.range(-Math.PI * 1.1, Math.PI * 0.1);
    const speed = rng.range(preset.sparkSpeedMin, preset.sparkSpeedMax);
    spawnParticle(effects, tuning, {
      kind: 'spark',
      x: at.x,
      y: at.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: p.sparkGravity,
      size: rng.chance(0.5) ? 1 : 2,
      life: rng.range(p.sparkLifeMin, p.sparkLifeMax),
    });
  }
  for (let i = 0; i < preset.smokePuffs; i++) {
    // Smoke starts in the upper half of the blast and rises.
    const offset = pointInDisc(rng, preset.spread);
    spawnParticle(effects, tuning, {
      kind: 'smoke',
      x: at.x + offset.x,
      y: at.y - Math.abs(offset.y),
      vx: offset.x * 2,
      vy: -p.smokeRise * rng.range(0.7, 1.3),
      size: rng.range(preset.smokeRadius * 0.5, preset.smokeRadius),
      life: rng.range(p.smokeLifeMin, p.smokeLifeMax),
    });
  }
  for (let i = 0; i < preset.fireballs; i++) {
    const offset = pointInDisc(rng, preset.spread);
    spawnParticle(effects, tuning, {
      kind: 'fire',
      x: at.x + offset.x,
      y: at.y + offset.y,
      vx: offset.x * 3,
      vy: offset.y * 3,
      size: rng.range(preset.fireRadius * 0.5, preset.fireRadius),
      life: rng.range(p.fireLifeMin, p.fireLifeMax),
    });
  }
  spawnParticle(effects, tuning, {
    kind: 'flash',
    x: at.x,
    y: at.y,
    size: preset.flashRadius,
    life: p.flashLife,
  });
  addTrauma(effects.shake, preset.trauma);
}

/** One small smoke puff left behind at `at` (a rocket's trail). */
export function puffSmoke(ctx: RunContext, at: Vec2): void {
  const { effects } = ctx.state;
  const tuning = ctx.tuning.effects;
  const p = tuning.particles;
  const { rng } = effects;
  spawnParticle(effects, tuning, {
    kind: 'smoke',
    x: at.x + rng.range(-1, 1),
    y: at.y + rng.range(-1, 1),
    vy: -p.smokeRise * rng.range(0.3, 0.6),
    size: rng.range(p.trailPuffRadius * 0.5, p.trailPuffRadius),
    life: rng.range(p.smokeLifeMin, p.smokeLifeMax),
  });
}

function spawnDebris(ctx: RunContext, enemy: Readonly<EnemyState>, pieces: number): void {
  const { effects } = ctx.state;
  const tuning: EffectsTuning = ctx.tuning.effects;
  const t = tuning.debris;
  const { rng } = effects;
  const mid = center(enemy);
  const size = Math.max(4, Math.round(Math.min(enemy.w, enemy.h) / 2));

  for (let piece = 0; piece < pieces; piece++) {
    // Chunks start spread across the Enemy and fly away from its middle.
    const x = enemy.x + ((piece + 0.5) / pieces) * enemy.w;
    const side = x < mid.x ? -1 : x > mid.x ? 1 : rng.chance(0.5) ? -1 : 1;
    spawnParticle(effects, tuning, {
      kind: 'debris',
      x,
      y: mid.y + rng.range(-enemy.h / 4, enemy.h / 4),
      vx: side * rng.range(t.speedXMin, t.speedXMax),
      vy: -rng.range(t.speedUpMin, t.speedUpMax),
      gravity: t.gravity,
      size,
      life: DEBRIS_AIR_LIFE,
      debris: {
        enemyKind: enemy.kind,
        piece,
        angle: 0,
        spin: (rng.chance(0.5) ? -1 : 1) * rng.range(t.spin * 0.5, t.spin),
      },
    });
  }
}

function pointInDisc(rng: Rng, radius: number): Vec2 {
  const angle = rng.range(0, Math.PI * 2);
  const distance = Math.sqrt(rng.next()) * radius;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

export function viewEffects(
  effects: Readonly<EffectsState>,
  tuning: Tuning,
  tick: number,
): EffectsView {
  return {
    particles: effects.list.map((p) => viewParticle(p, tuning.effects)),
    shake: shakeOffset(effects.shake, tuning.effects.shake, tick),
  };
}
