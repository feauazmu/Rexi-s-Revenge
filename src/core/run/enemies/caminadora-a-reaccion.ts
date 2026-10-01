import { SCREEN_WIDTH } from '../../constants';
import { center, directionTo, type Vec2 } from '../../math';
import type { CaminadoraAReaccionTuning } from '../../tuning';
import type { RunContext } from '../context';
import { spawnProjectile } from '../projectiles';
import { enemyFireRate } from '../ramp';
import type { EnemyState } from '../state';
import { defineEnemy } from './types';

/** Tolerance for comparing accumulated seconds against a timer. */
const EPSILON = 1e-9;
/** The gun hangs under the front of the deck: muzzle height above the hitbox bottom, px. */
const MUZZLE_RISE = 2;

interface CaminadoraMemory {
  /** Direction of travel, which is also the way it faces: 1 right, -1 left. */
  direction: 1 | -1;
  /** Altitude (hitbox top) it climbs or sinks toward during this pass. */
  targetY: number;
  /** Strafing between bursts, stopped to wind up, or strafing while firing a burst. */
  phase: 'idle' | 'windup' | 'firing';
  /** Seconds of Enemy time until the next windup (runs faster as the ramp's fire rate rises). */
  fireTimer: number;
  /** Seconds left of the windup. */
  windupTimer: number;
  /** Bullets left in the current burst. */
  shotsLeft: number;
  /** Seconds until the next bullet of the burst. */
  shotTimer: number;
  /** Heading of every bullet of the current burst, fixed when the burst starts. */
  aim: Vec2;
}

/**
 * Caminadora a Reacción: a jet-powered treadmill with a gatling gun bolted under its console.
 * Strafes nose first from edge to edge, picking a new altitude on each pass. Every few seconds
 * it stops dead to wind up (the telegraph), swinging round to face Rexi if he is behind it,
 * then fires a burst of bullets aimed where Rexi was at that moment and strafes on toward him
 * while the burst plays out, laying a line of fire across his path. One spawned off-screen flies in on its own, since it always heads into the Arena.
 */
export const caminadoraAReaccion = defineEnemy<CaminadoraMemory>({
  kind: 'caminadora-a-reaccion',
  craft: 'gym',

  init(enemy, ctx) {
    const t = ctx.tuning.enemies['caminadora-a-reaccion'];
    return {
      direction: enemy.x + enemy.w / 2 < SCREEN_WIDTH / 2 ? 1 : -1,
      targetY: enemy.y,
      phase: 'idle',
      fireTimer: ctx.rng.range(t.fireIntervalMin, t.fireIntervalMax),
      windupTimer: 0,
      shotsLeft: 0,
      shotTimer: 0,
      aim: { x: 0, y: 1 },
    };
  },

  update(enemy, memory, ctx, dt) {
    const t = ctx.tuning.enemies['caminadora-a-reaccion'];

    if (memory.phase === 'idle') {
      memory.fireTimer -= dt * enemyFireRate(ctx);
      if (memory.fireTimer <= EPSILON) startWindup(enemy, memory, ctx, t);
    } else if (memory.phase === 'windup') {
      memory.windupTimer -= dt;
      if (memory.windupTimer <= EPSILON) startBurst(enemy, memory, ctx, t);
    }

    if (memory.phase !== 'windup') strafe(enemy, memory, ctx, t, dt);

    if (memory.phase !== 'firing') return;
    if (memory.shotTimer <= EPSILON) {
      fire(enemy, memory, ctx, t);
      memory.shotsLeft -= 1;
      memory.shotTimer += t.burstSpacing;
      if (memory.shotsLeft === 0) {
        memory.phase = 'idle';
        memory.fireTimer += ctx.rng.range(t.fireIntervalMin, t.fireIntervalMax);
      }
    }
    memory.shotTimer -= dt;
  },

  pose: (memory, tuning) => ({
    facing: memory.direction,
    attack: memory.phase,
    windup:
      memory.phase === 'windup'
        ? 1 - memory.windupTimer / tuning.enemies['caminadora-a-reaccion'].windup
        : 0,
  }),
});

/** Where its bullets come out: the gatling muzzle under the front of the deck. */
function muzzleOf(enemy: Readonly<EnemyState>, direction: 1 | -1): Vec2 {
  return {
    x: direction === 1 ? enemy.x + enemy.w : enemy.x,
    y: enemy.y + enemy.h - MUZZLE_RISE,
  };
}

/** Stops, swinging round to face Rexi if he is behind it, so the gun points his way. */
function startWindup(
  enemy: Readonly<EnemyState>,
  memory: CaminadoraMemory,
  ctx: RunContext,
  t: CaminadoraAReaccionTuning,
): void {
  memory.phase = 'windup';
  memory.windupTimer = t.windup;
  const toRexi = center(ctx.state.rexi).x - center(enemy).x;
  if (toRexi !== 0) memory.direction = toRexi > 0 ? 1 : -1;
}

function startBurst(
  enemy: Readonly<EnemyState>,
  memory: CaminadoraMemory,
  ctx: RunContext,
  t: CaminadoraAReaccionTuning,
): void {
  memory.phase = 'firing';
  memory.shotsLeft = t.burstCount;
  memory.shotTimer = 0;
  const muzzle = muzzleOf(enemy, memory.direction);
  memory.aim = directionTo(muzzle, center(ctx.state.rexi), { x: memory.direction, y: 0 });
}

function fire(
  enemy: Readonly<EnemyState>,
  memory: CaminadoraMemory,
  ctx: RunContext,
  t: CaminadoraAReaccionTuning,
): void {
  spawnProjectile(ctx, {
    kind: 'bullet',
    owner: 'enemy',
    center: muzzleOf(enemy, memory.direction),
    size: t.bulletSize,
    velocity: { x: memory.aim.x * t.bulletSpeed, y: memory.aim.y * t.bulletSpeed },
    damage: t.bulletDamage,
    lifetime: t.bulletLifetime,
  });
  ctx.emit({ type: 'enemy-fired', enemyId: enemy.id, kind: enemy.kind });
}

/**
 * Moves it along its pass, easing toward the pass altitude. Past the turning point on the side
 * it is heading to, it turns around and picks a new altitude for the next pass.
 */
function strafe(
  enemy: EnemyState,
  memory: CaminadoraMemory,
  ctx: RunContext,
  t: CaminadoraAReaccionTuning,
  dt: number,
): void {
  const minX = t.strafeMarginX;
  const maxX = SCREEN_WIDTH - t.strafeMarginX - enemy.w;
  enemy.x += memory.direction * t.strafeSpeed * dt;
  const turned =
    (memory.direction === 1 && enemy.x >= maxX) || (memory.direction === -1 && enemy.x <= minX);
  if (turned) {
    enemy.x = memory.direction === 1 ? maxX : minX;
    memory.direction = memory.direction === 1 ? -1 : 1;
    memory.targetY = ctx.rng.range(t.strafeMinY, t.strafeMaxY);
  }

  const dy = memory.targetY - enemy.y;
  const climb = t.climbSpeed * dt;
  enemy.y = Math.abs(dy) <= climb ? memory.targetY : enemy.y + Math.sign(dy) * climb;
}
