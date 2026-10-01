import { SCREEN_WIDTH } from '../../constants';
import { center, directionTo, type Vec2 } from '../../math';
import type { MaletinCopteroTuning } from '../../tuning';
import type { RunContext } from '../context';
import { spawnProjectile } from '../projectiles';
import { enemyFireRate } from '../ramp';
import { defineEnemy } from './types';

/** Tolerance for comparing accumulated seconds against a timer. */
const EPSILON = 1e-9;

interface MaletinMemory {
  /** Hover anchor (top-left without the bob): where the drift has taken it. */
  anchor: Vec2;
  /** Point the anchor drifts toward. */
  target: Vec2;
  /** Seconds of Enemy time until it picks a new target. */
  retargetTimer: number;
  /** Starting phase of the hover cycle, 0..1. */
  readonly phase: number;
  /** Seconds of Enemy time elapsed. */
  time: number;
  /** Seconds of Enemy time until the next paper (runs faster as the ramp's fire rate rises). */
  fireTimer: number;
}

/**
 * Maletín-cóptero: a briefcase with a rotor and a tiny lawyer pilot. Drifts toward random
 * points in the upper Arena, settling into a bobbing hover at each, and every few seconds
 * throws a slow paper at Rexi with a little "bad aim" error. One spawned off-screen flies in
 * on its own, since every target point is inside the Arena.
 */
export const maletinCoptero = defineEnemy<MaletinMemory>({
  kind: 'maletin-coptero',
  craft: 'lawyer',

  init(enemy, ctx) {
    const t = ctx.tuning.enemies['maletin-coptero'];
    return {
      anchor: { x: enemy.x, y: enemy.y },
      target: pickTarget(ctx, t, enemy.w),
      retargetTimer: ctx.rng.range(t.retargetMin, t.retargetMax),
      phase: ctx.rng.next(),
      time: 0,
      fireTimer: ctx.rng.range(t.fireIntervalMin, t.fireIntervalMax),
    };
  },

  update(enemy, memory, ctx, dt) {
    const t = ctx.tuning.enemies['maletin-coptero'];
    memory.time += dt;

    memory.retargetTimer -= dt;
    if (memory.retargetTimer <= EPSILON) {
      memory.retargetTimer += ctx.rng.range(t.retargetMin, t.retargetMax);
      memory.target = pickTarget(ctx, t, enemy.w);
    }
    drift(memory, t, dt);
    const cycle = memory.time / t.hoverPeriod + memory.phase;
    enemy.x = memory.anchor.x;
    enemy.y = memory.anchor.y + Math.sin(cycle * 2 * Math.PI) * t.hoverAmplitude;

    memory.fireTimer -= dt * enemyFireRate(ctx);
    if (memory.fireTimer > EPSILON) return;
    memory.fireTimer += ctx.rng.range(t.fireIntervalMin, t.fireIntervalMax);

    const origin = center(enemy);
    const aimed = directionTo(origin, center(ctx.state.rexi), { x: 0, y: 1 });
    const error = (ctx.rng.range(-t.aimError, t.aimError) * Math.PI) / 180;
    const angle = Math.atan2(aimed.y, aimed.x) + error;
    spawnProjectile(ctx, {
      kind: 'paper',
      owner: 'enemy',
      center: origin,
      size: t.paperSize,
      velocity: { x: Math.cos(angle) * t.paperSpeed, y: Math.sin(angle) * t.paperSpeed },
      damage: t.paperDamage,
      lifetime: t.paperLifetime,
    });
    ctx.emit({ type: 'enemy-fired', enemyId: enemy.id, kind: enemy.kind });
  },
});

/** A random hover point (hitbox top-left) inside the roaming area. */
function pickTarget(ctx: RunContext, t: MaletinCopteroTuning, width: number): Vec2 {
  return {
    x: ctx.rng.range(t.roamMarginX, SCREEN_WIDTH - t.roamMarginX - width),
    y: ctx.rng.range(t.roamMinY, t.roamMaxY),
  };
}

/** Moves the anchor straight toward the target, easing off within the arrive distance. */
function drift(memory: MaletinMemory, t: MaletinCopteroTuning, dt: number): void {
  const dx = memory.target.x - memory.anchor.x;
  const dy = memory.target.y - memory.anchor.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPSILON) return;
  const speed = t.driftSpeed * Math.min(1, distance / t.arriveDistance);
  const step = Math.min(distance, speed * dt);
  memory.anchor = {
    x: memory.anchor.x + (dx / distance) * step,
    y: memory.anchor.y + (dy / distance) * step,
  };
}
