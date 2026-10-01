import { SCREEN_WIDTH } from '../../constants';
import { center, clamp } from '../../math';
import type { ArchivadorArtilladoTuning } from '../../tuning';
import type { RunContext } from '../context';
import { spawnProjectile } from '../projectiles';
import { enemyFireRate } from '../ramp';
import type { EnemyState } from '../state';
import { defineEnemy } from './types';

/** Tolerance for comparing accumulated seconds against a timer. */
const EPSILON = 1e-9;

interface ArchivadorMemory {
  /** Patrol direction: 1 heading right, -1 heading left. */
  direction: 1 | -1;
  /** Altitude without the hover bob (hitbox top). */
  anchorY: number;
  /** Altitude it cruises at: its entry height, clamped to the patrol band. */
  readonly cruiseY: number;
  /** Starting phase of the hover cycle, 0..1. */
  readonly phase: number;
  /** Seconds of Enemy time elapsed. */
  time: number;
  /** Seconds until it may start a windup (runs faster as the ramp's fire rate rises). */
  dropTimer: number;
  /** Seconds into the current windup, or null when not winding up. */
  windup: number | null;
}

/**
 * Archivador Artillado: a flying filing cabinet on jet thrusters. It patrols edge to edge high
 * above the Arena and, whenever it passes over Rexi with its drop ready, stops, lowers a drawer
 * from its bomb bay (the telegraph) and lets it fall. The drawer blows up on Rexi, the ground
 * or a platform. One spawned off-screen heads for the Arena center, so it flies in on its own.
 */
export const archivadorArtillado = defineEnemy<ArchivadorMemory>({
  kind: 'archivador-artillado',
  craft: 'lawyer',

  init(enemy, ctx) {
    const t = ctx.tuning.enemies['archivador-artillado'];
    return {
      direction: enemy.x + enemy.w / 2 < SCREEN_WIDTH / 2 ? 1 : -1,
      anchorY: enemy.y,
      cruiseY: clamp(enemy.y, t.patrolMinY, t.patrolMaxY),
      phase: ctx.rng.next(),
      time: 0,
      dropTimer: t.firstDropDelay,
      windup: null,
    };
  },

  update(enemy, memory, ctx, dt) {
    const t = ctx.tuning.enemies['archivador-artillado'];
    memory.time += dt;
    hover(enemy, memory, t, dt);

    if (memory.windup !== null) {
      memory.windup += dt;
      enemy.attackWindup = Math.min(1, memory.windup / t.dropWindup);
      if (memory.windup < t.dropWindup - EPSILON) return;
      dropDrawer(enemy, ctx, t);
      memory.windup = null;
      memory.dropTimer = t.dropCooldown;
      enemy.attackWindup = 0;
      return;
    }

    patrol(enemy, memory, t, dt);
    memory.dropTimer = Math.max(0, memory.dropTimer - dt * enemyFireRate(ctx));
    if (memory.dropTimer > EPSILON || !isOverRexi(enemy, ctx, t)) return;
    memory.windup = dt;
    enemy.attackWindup = Math.min(1, dt / t.dropWindup);
  },
});

/** Eases back into the cruise altitude and bobs gently on its thrusters. */
function hover(
  enemy: EnemyState,
  memory: ArchivadorMemory,
  t: ArchivadorArtilladoTuning,
  dt: number,
): void {
  const dy = memory.cruiseY - memory.anchorY;
  memory.anchorY += Math.sign(dy) * Math.min(Math.abs(dy), t.climbSpeed * dt);
  const cycle = memory.time / t.hoverPeriod + memory.phase;
  enemy.y = memory.anchorY + Math.sin(cycle * 2 * Math.PI) * t.hoverAmplitude;
}

/** Flies sideways, turning back at the patrol margins. */
function patrol(
  enemy: EnemyState,
  memory: ArchivadorMemory,
  t: ArchivadorArtilladoTuning,
  dt: number,
): void {
  const left = t.patrolMarginX;
  const right = SCREEN_WIDTH - t.patrolMarginX - enemy.w;
  enemy.x += memory.direction * t.patrolSpeed * dt;
  // It always starts heading for the Arena center, so it only meets the margin it flies toward.
  if (memory.direction === 1 && enemy.x >= right) {
    enemy.x = right;
    memory.direction = -1;
  } else if (memory.direction === -1 && enemy.x <= left) {
    enemy.x = left;
    memory.direction = 1;
  }
}

/** Whether it is fully inside the Arena with Rexi within drop range below. */
function isOverRexi(enemy: EnemyState, ctx: RunContext, t: ArchivadorArtilladoTuning): boolean {
  if (enemy.x < 0 || enemy.x + enemy.w > SCREEN_WIDTH) return false;
  return Math.abs(center(enemy).x - center(ctx.state.rexi).x) < t.dropRange;
}

/** Releases a drawer bomb from the bomb bay, centered under the cabinet. */
function dropDrawer(enemy: EnemyState, ctx: RunContext, t: ArchivadorArtilladoTuning): void {
  spawnProjectile(ctx, {
    kind: 'drawer',
    owner: 'enemy',
    center: { x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h + t.drawerSize / 2 },
    size: t.drawerSize,
    velocity: { x: 0, y: 0 },
    gravity: t.drawerGravity,
    damage: t.drawerDamage,
    lifetime: t.drawerLifetime,
    blast: {
      radius: t.drawerBlastRadius,
      damage: t.drawerDamage,
      edge: 1,
      explosion: t.drawerExplosion,
    },
  });
  ctx.emit({ type: 'enemy-fired', enemyId: enemy.id, kind: enemy.kind });
}
