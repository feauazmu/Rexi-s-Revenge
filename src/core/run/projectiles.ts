import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { ProjectileKind } from '../ids';
import { center, overlaps, type Vec2 } from '../math';
import type { RunContext } from './context';
import { puffSmoke } from './effects';
import { damageEnemy } from './enemies/system';
import { detonate } from './explosives';
import { canHurtRexi, damageRexi } from './rexi';
import type { Blast, ProjectileState, ProjectileThrust } from './state';

/** How far outside the screen a projectile may travel before it is discarded, px. */
const OFFSCREEN_MARGIN = 32;

export interface ProjectileSpawn {
  readonly kind: ProjectileKind;
  readonly owner: 'rexi' | 'enemy';
  /** Center of the projectile at spawn. */
  readonly center: Vec2;
  readonly size: number;
  readonly velocity: Vec2;
  /** Impact damage to whatever it hits. */
  readonly damage: number;
  /** Lifetime, seconds. */
  readonly lifetime: number;
  /** Downward acceleration, px/s². Default 0. */
  readonly gravity?: number;
  /**
   * Bounces off the ground and one-way platforms (landing from above) this many times,
   * keeping `restitution` of its vertical speed. Default: no bouncing.
   */
  readonly bounce?: { readonly count: number; readonly restitution: number };
  /** Accelerates along its heading up to a top speed (rockets). Default: constant speed. */
  readonly thrust?: ProjectileThrust;
  /**
   * Makes it explosive: it detonates with this blast when it hits an Enemy, lands with no
   * bounces left, or its lifetime runs out (never when it leaves the screen).
   */
  readonly blast?: Blast;
  /** Seconds between the puffs of a smoke trail (cosmetic). Default: no trail. */
  readonly trailInterval?: number;
}

export function spawnProjectile(ctx: RunContext, spawn: ProjectileSpawn): ProjectileState {
  const projectile: ProjectileState = {
    id: ctx.nextId(),
    kind: spawn.kind,
    owner: spawn.owner,
    x: spawn.center.x - spawn.size / 2,
    y: spawn.center.y - spawn.size / 2,
    w: spawn.size,
    h: spawn.size,
    vx: spawn.velocity.x,
    vy: spawn.velocity.y,
    gravity: spawn.gravity ?? 0,
    damage: spawn.damage,
    ttl: secondsToTicks(spawn.lifetime),
    age: 0,
    bounce: spawn.bounce
      ? { left: spawn.bounce.count, restitution: spawn.bounce.restitution }
      : null,
    thrust: spawn.thrust ?? null,
    blast: spawn.blast ?? null,
    trailInterval:
      spawn.trailInterval === undefined ? null : Math.max(1, secondsToTicks(spawn.trailInterval)),
  };
  ctx.state.projectiles.push(projectile);
  return projectile;
}

/** Moves every projectile, resolves hits and removes spent ones. */
export function stepProjectiles(ctx: RunContext): void {
  const { state } = ctx;
  state.projectiles = state.projectiles.filter((p) => stepProjectile(ctx, p));
}

/** Advances one projectile one tick; returns false when it is spent. */
function stepProjectile(ctx: RunContext, p: ProjectileState): boolean {
  const { state } = ctx;
  const bottomBefore = p.y + p.h;
  p.vy += p.gravity * DT;
  if (p.thrust) accelerate(p, p.thrust);
  p.x += p.vx * DT;
  p.y += p.vy * DT;
  p.age += 1;
  p.ttl -= 1;
  if (p.trailInterval !== null && p.age % p.trailInterval === 0) puffSmoke(ctx, tailOf(p));

  if (p.owner === 'rexi') {
    const target = state.enemies.find((enemy) => enemy.health > 0 && overlaps(p, enemy));
    if (target) {
      damageEnemy(ctx, target, p.damage);
      if (p.blast) detonate(ctx, p.blast, center(p));
      return false;
    }
  } else if (canHurtRexi(state.rexi) && overlaps(p, state.rexi)) {
    // While Rexi is invulnerable, Enemy projectiles fly through him.
    damageRexi(ctx, p.damage);
    return false;
  }

  const surface = p.bounce ? landingSurface(ctx, p, bottomBefore) : groundCrossed(ctx, p);
  if (surface !== null) {
    p.y = surface - p.h;
    if (p.bounce && p.bounce.left > 0) {
      p.bounce.left -= 1;
      p.vy = -p.vy * p.bounce.restitution;
    } else {
      if (p.blast) detonate(ctx, p.blast, center(p));
      return false;
    }
  }

  if (p.ttl <= 0) {
    if (p.blast) detonate(ctx, p.blast, center(p));
    return false;
  }
  return isNearScreen(p);
}

function accelerate(p: ProjectileState, thrust: ProjectileThrust): void {
  const speed = Math.hypot(p.vx, p.vy);
  if (speed === 0) return;
  const next = Math.min(thrust.maxSpeed, speed + thrust.acceleration * DT);
  p.vx *= next / speed;
  p.vy *= next / speed;
}

/** The middle of the projectile's back end, opposite its heading. */
function tailOf(p: Readonly<ProjectileState>): Vec2 {
  const mid = center(p);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed === 0) return mid;
  const half = Math.max(p.w, p.h) / 2;
  return { x: mid.x - (p.vx / speed) * half, y: mid.y - (p.vy / speed) * half };
}

/** The ground's top when the projectile has reached it, else null. */
function groundCrossed(ctx: RunContext, p: Readonly<ProjectileState>): number | null {
  const { groundY } = ctx.tuning.arena;
  return p.y + p.h >= groundY ? groundY : null;
}

/**
 * The surface a bouncing projectile lands on this tick: the ground, or a one-way platform whose
 * top its bottom crossed while falling. Null when it is still in the air.
 */
function landingSurface(
  ctx: RunContext,
  p: Readonly<ProjectileState>,
  bottomBefore: number,
): number | null {
  const bottom = p.y + p.h;
  let surface = groundCrossed(ctx, p);
  if (p.vy <= 0) return surface;
  for (const platform of ctx.tuning.arena.platforms) {
    const crossesTop = bottomBefore <= platform.y && bottom >= platform.y;
    const overlapsX = p.x < platform.x + platform.w && platform.x < p.x + p.w;
    if (crossesTop && overlapsX && (surface === null || platform.y < surface)) {
      surface = platform.y;
    }
  }
  return surface;
}

function isNearScreen(p: Readonly<ProjectileState>): boolean {
  return (
    p.x + p.w > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y + p.h > -OFFSCREEN_MARGIN &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}
