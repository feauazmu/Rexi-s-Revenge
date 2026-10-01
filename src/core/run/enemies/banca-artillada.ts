import { SCREEN_WIDTH } from '../../constants';
import { center, clamp, type Vec2 } from '../../math';
import type { BancaArtilladaTuning } from '../../tuning';
import type { RunContext } from '../context';
import { spawnProjectile } from '../projectiles';
import { enemyFireRate } from '../ramp';
import type { EnemyState } from '../state';
import { defineEnemy } from './types';

/** Tolerance for comparing accumulated seconds against a timer. */
const EPSILON = 1e-9;

interface BancaMemory {
  /** Hover anchor (top-left without the bob): where the drift has taken it. */
  anchor: Vec2;
  /** Which side of Rexi it holds its standoff on: -1 left of him, 1 right of him. */
  side: -1 | 1;
  /** Cruising altitude (hitbox top) the anchor drifts toward. */
  cruiseY: number;
  /** Seconds of Enemy time until it picks a new cruising altitude. */
  altitudeTimer: number;
  /** Starting phase of the hover cycle, 0..1. */
  readonly phase: number;
  /** Seconds of Enemy time elapsed. */
  time: number;
  /** Seconds of Enemy time until the next volley starts (runs faster as the fire rate rises). */
  volleyTimer: number;
  /** Rockets still to launch in the current volley (0 between volleys). */
  rocketsLeft: number;
  /** Seconds of Enemy time until the next rocket of the current volley. */
  rocketTimer: number;
  /** Pod the next rocket leaves from: -1 the left pod, 1 the right one. */
  nextPod: -1 | 1;
}

/**
 * Banca Artillada: a bench press turned gunship, lifted by two rotors on its barbell rack,
 * with a rocket pod under each end of the bench. The heavy set piece of the Gym Craft.
 *
 * It lumbers into a standoff beside Rexi (`standoff` px from him, on whichever side it is
 * on) and follows him there slowly, cruising at an altitude it re-picks now and then. When
 * Rexi pins it against an edge it crosses over him to his other side. Every volley interval
 * it fires a fanned volley of rockets, alternating pods; rockets accelerate and home on Rexi
 * briefly, then fly straight.
 */
export const bancaArtillada = defineEnemy<BancaMemory>({
  kind: 'banca-artillada',
  craft: 'gym',

  init(enemy, ctx) {
    const t = ctx.tuning.enemies['banca-artillada'];
    return {
      anchor: { x: enemy.x, y: enemy.y },
      side: center(enemy).x < center(ctx.state.rexi).x ? -1 : 1,
      cruiseY: ctx.rng.range(t.minY, t.maxY),
      altitudeTimer: ctx.rng.range(t.altitudeChangeMin, t.altitudeChangeMax),
      phase: ctx.rng.next(),
      time: 0,
      volleyTimer: t.firstVolleyDelay,
      rocketsLeft: 0,
      rocketTimer: 0,
      nextPod: ctx.rng.chance(0.5) ? -1 : 1,
    };
  },

  update(enemy, memory, ctx, dt) {
    const t = ctx.tuning.enemies['banca-artillada'];
    memory.time += dt;

    memory.altitudeTimer -= dt;
    if (memory.altitudeTimer <= EPSILON) {
      memory.altitudeTimer += ctx.rng.range(t.altitudeChangeMin, t.altitudeChangeMax);
      memory.cruiseY = ctx.rng.range(t.minY, t.maxY);
    }
    drift(memory, standoffPoint(memory, enemy, ctx, t), t, dt);
    const cycle = memory.time / t.hoverPeriod + memory.phase;
    enemy.x = memory.anchor.x;
    enemy.y = memory.anchor.y + Math.sin(cycle * 2 * Math.PI) * t.hoverAmplitude;

    memory.volleyTimer -= dt * enemyFireRate(ctx);
    if (memory.volleyTimer <= EPSILON) {
      memory.volleyTimer += t.volleyInterval;
      memory.rocketsLeft = t.volleySize;
      memory.rocketTimer = 0;
    }
    if (memory.rocketsLeft <= 0) return;
    if (memory.rocketTimer <= EPSILON) {
      memory.rocketTimer += t.volleySpacing;
      fireRocket(enemy, memory, ctx, t);
    }
    memory.rocketTimer -= dt;
  },
});

/**
 * Where the anchor wants to be: `standoff` px beside Rexi on its current side, at its
 * cruising altitude, kept inside the Arena. When that side is squeezed against an edge to
 * under half the standoff and the other side has room, it switches sides.
 */
function standoffPoint(
  memory: BancaMemory,
  enemy: Readonly<EnemyState>,
  ctx: RunContext,
  t: BancaArtilladaTuning,
): Vec2 {
  const rexiX = center(ctx.state.rexi).x;
  const half = enemy.w / 2;
  const minCenter = t.marginX + half;
  const maxCenter = SCREEN_WIDTH - t.marginX - half;
  const reach = (side: -1 | 1) => clamp(rexiX + side * t.standoff, minCenter, maxCenter);
  const roomOn = (side: -1 | 1) => Math.abs(reach(side) - rexiX);

  const other = memory.side === 1 ? -1 : 1;
  if (roomOn(memory.side) < t.standoff / 2 && roomOn(other) > roomOn(memory.side)) {
    memory.side = other;
  }
  return { x: reach(memory.side) - half, y: memory.cruiseY };
}

/** Moves the anchor straight toward `target`, easing off within the arrive distance. */
function drift(memory: BancaMemory, target: Vec2, t: BancaArtilladaTuning, dt: number): void {
  const dx = target.x - memory.anchor.x;
  const dy = target.y - memory.anchor.y;
  const distance = Math.hypot(dx, dy);
  if (distance < EPSILON) return;
  const speed = t.driftSpeed * Math.min(1, distance / t.arriveDistance);
  const step = Math.min(distance, speed * dt);
  memory.anchor = {
    x: memory.anchor.x + (dx / distance) * step,
    y: memory.anchor.y + (dy / distance) * step,
  };
}

/** Launches the volley's next rocket from the next pod, at its slot in the fan. */
function fireRocket(
  enemy: Readonly<EnemyState>,
  memory: BancaMemory,
  ctx: RunContext,
  t: BancaArtilladaTuning,
): void {
  const mid = center(enemy);
  const origin = { x: mid.x + memory.nextPod * t.podOffsetX, y: mid.y + t.podOffsetY };
  memory.nextPod = memory.nextPod === 1 ? -1 : 1;

  // Rockets fan out evenly across the spread, first to last.
  const index = t.volleySize - memory.rocketsLeft;
  memory.rocketsLeft -= 1;
  const slot = t.volleySize > 1 ? index / (t.volleySize - 1) - 0.5 : 0;
  const target = center(ctx.state.rexi);
  const aim = Math.atan2(target.y - origin.y, target.x - origin.x);
  const angle = aim + (slot * t.volleySpread * Math.PI) / 180;

  spawnProjectile(ctx, {
    kind: 'rocket',
    owner: 'enemy',
    center: origin,
    size: t.rocketSize,
    velocity: {
      x: Math.cos(angle) * t.rocketLaunchSpeed,
      y: Math.sin(angle) * t.rocketLaunchSpeed,
    },
    damage: t.rocketDamage,
    lifetime: t.rocketLifetime,
    thrust: { acceleration: t.rocketAcceleration, maxSpeed: t.rocketMaxSpeed },
    homing: { turnRate: t.rocketTurnRate, duration: t.rocketHomingTime },
    burst: 'small',
  });
  ctx.emit({ type: 'enemy-fired', enemyId: enemy.id, kind: enemy.kind });
}
