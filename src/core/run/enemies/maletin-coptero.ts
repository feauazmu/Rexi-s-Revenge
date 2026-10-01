import { center, directionTo } from '../../math';
import { spawnProjectile } from '../projectiles';
import { defineEnemy } from './types';

/** Tolerance for comparing accumulated seconds against a timer. */
const EPSILON = 1e-9;

interface MaletinMemory {
  readonly baseY: number;
  /** Starting phase of the hover cycle, 0..1. */
  readonly phase: number;
  /** Seconds of Enemy time elapsed. */
  time: number;
  /** Seconds of Enemy time until the next paper. */
  fireTimer: number;
}

/**
 * Maletín-cóptero: a briefcase with a rotor. Hovers in place and every few seconds throws a
 * slow paper at Rexi, with a little "bad aim" error.
 */
export const maletinCoptero = defineEnemy<MaletinMemory>({
  kind: 'maletin-coptero',
  craft: 'lawyer',

  init(enemy, ctx) {
    const t = ctx.tuning.enemies['maletin-coptero'];
    return {
      baseY: enemy.y,
      phase: ctx.rng.next(),
      time: 0,
      fireTimer: ctx.rng.range(t.fireIntervalMin, t.fireIntervalMax),
    };
  },

  update(enemy, memory, ctx, dt) {
    const t = ctx.tuning.enemies['maletin-coptero'];
    memory.time += dt;
    const cycle = memory.time / t.hoverPeriod + memory.phase;
    enemy.y = memory.baseY + Math.sin(cycle * 2 * Math.PI) * t.hoverAmplitude;

    memory.fireTimer -= dt;
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
