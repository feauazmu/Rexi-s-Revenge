import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../../constants';
import type { EnemyKind, ParticleKind } from '../../ids';
import type { Rng } from '../../rng';
import type { EffectsTuning } from '../../tuning';
import type { ParticleView } from '../../view';

/** How far outside the screen a particle may drift before it is culled, px. */
const OFFSCREEN_MARGIN = 32;
/** A bouncing chunk whose rebound is slower than this comes to rest, px/s. */
const SETTLE_SPEED = 60;
/** Velocity kept per tick by drifting particles (fire, smoke). */
const DRIFT_DRAG = 0.92;
/**
 * Initial lifetime of a debris chunk, s: a safety cap replaced by rest + blink time as soon as
 * the chunk settles on the ground.
 */
export const DEBRIS_AIR_LIFE = 4;
/** Debris blinks with this period while blinking out, ticks. */
const BLINK_PERIOD = 4;

export interface ParticleState {
  readonly kind: ParticleKind;
  /** Center, game coordinates. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Downward acceleration, px/s². */
  readonly gravity: number;
  readonly size: number;
  age: number;
  life: number;
  readonly variant: number;
  /** Extra state of a debris chunk; null for every other kind. */
  readonly debris: DebrisState | null;
}

export interface DebrisState {
  readonly enemyKind: EnemyKind;
  readonly piece: number;
  /** Rotation in quarter turns (fractional while spinning). */
  angle: number;
  /** Quarter turns per second while airborne. */
  readonly spin: number;
  settled: boolean;
  /** Ticks until the next trailing smoke puff. */
  smokeIn: number;
}

/** Everything a particle needs at spawn; the pool fills in age and kind-specific defaults. */
export interface ParticleSpawn {
  readonly kind: ParticleKind;
  readonly x: number;
  readonly y: number;
  readonly vx?: number;
  readonly vy?: number;
  readonly gravity?: number;
  readonly size: number;
  /** Lifetime, seconds. */
  readonly life: number;
  readonly debris?: Omit<DebrisState, 'settled' | 'smokeIn'>;
}

/**
 * A bounded particle pool. Particles are kept oldest first; when a spawn would exceed the
 * budget the oldest are dropped, so a long Run can never accumulate particles.
 */
export interface ParticlePool {
  readonly list: ParticleState[];
  readonly rng: Rng;
}

export function spawnParticle(
  pool: ParticlePool,
  tuning: EffectsTuning,
  spawn: ParticleSpawn,
): void {
  pool.list.push({
    kind: spawn.kind,
    x: spawn.x,
    y: spawn.y,
    vx: spawn.vx ?? 0,
    vy: spawn.vy ?? 0,
    gravity: spawn.gravity ?? 0,
    size: spawn.size,
    age: 0,
    life: Math.max(1, secondsToTicks(spawn.life)),
    variant: pool.rng.next(),
    debris: spawn.debris
      ? { ...spawn.debris, settled: false, smokeIn: secondsToTicks(tuning.debris.smokeInterval) }
      : null,
  });
  enforceBudget(pool, tuning.maxParticles);
}

function enforceBudget(pool: ParticlePool, maxParticles: number): void {
  const excess = pool.list.length - Math.max(0, maxParticles);
  if (excess > 0) pool.list.splice(0, excess);
}

/** Ages, moves and culls every particle by one tick. */
export function stepParticles(pool: ParticlePool, tuning: EffectsTuning, groundY: number): void {
  const trails: ParticleSpawn[] = [];
  const survivors = pool.list.filter((p) => {
    p.age += 1;
    if (p.age >= p.life) return false;
    if (p.debris?.settled) return true;

    p.vy += p.gravity * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;

    switch (p.kind) {
      case 'fire':
      case 'smoke':
        p.vx *= DRIFT_DRAG;
        break;
      case 'spark':
        if (p.y >= groundY) return false;
        break;
      case 'debris':
        if (p.debris) stepDebris(p, p.debris, tuning, groundY, trails);
        break;
      case 'flash':
        break;
    }
    return isNearScreen(p);
  });
  pool.list.splice(0, pool.list.length, ...survivors);
  for (const trail of trails) spawnParticle(pool, tuning, trail);
}

function stepDebris(
  p: ParticleState,
  debris: DebrisState,
  tuning: EffectsTuning,
  groundY: number,
  trails: ParticleSpawn[],
): void {
  const t = tuning.debris;
  debris.angle += debris.spin * DT;

  const floor = groundY - p.size / 2;
  if (p.y >= floor) {
    p.y = floor;
    const rebound = p.vy * t.restitution;
    if (rebound < SETTLE_SPEED) {
      p.vx = 0;
      p.vy = 0;
      debris.settled = true;
      debris.angle = Math.round(debris.angle);
      p.life = p.age + secondsToTicks(t.restTime + t.blinkTime);
      return;
    }
    p.vy = -rebound;
    p.vx *= t.friction;
  }

  debris.smokeIn -= 1;
  if (debris.smokeIn <= 0) {
    debris.smokeIn = secondsToTicks(t.smokeInterval);
    trails.push({
      kind: 'smoke',
      x: p.x,
      y: p.y,
      vy: -tuning.particles.smokeRise / 2,
      size: Math.max(1, p.size / 4),
      life: tuning.particles.smokeLifeMin,
    });
  }
}

function isNearScreen(p: Readonly<ParticleState>): boolean {
  return (
    p.x > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y > -SCREEN_HEIGHT &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}

export function viewParticle(p: Readonly<ParticleState>, tuning: EffectsTuning): ParticleView {
  const base = {
    x: p.x,
    y: p.y,
    size: p.size,
    age: p.age,
    life: p.life,
    variant: p.variant,
  };
  const { debris } = p;
  if (!debris) {
    if (p.kind === 'debris') throw new Error('A debris particle needs its debris state');
    return { ...base, kind: p.kind };
  }

  const blinkTicks = secondsToTicks(tuning.debris.blinkTime);
  const blinking = debris.settled && p.life - p.age <= blinkTicks;
  return {
    ...base,
    kind: 'debris',
    enemyKind: debris.enemyKind,
    piece: debris.piece,
    quarterTurns: (((Math.round(debris.angle) % 4) + 4) % 4) + 0,
    hidden: blinking && Math.floor(p.age / (BLINK_PERIOD / 2)) % 2 === 1,
  };
}
