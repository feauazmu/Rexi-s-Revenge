import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { ProjectileKind } from '../ids';
import { clamp, overlaps, type Vec2 } from '../math';
import type { RunContext } from './context';
import { explode } from './effects';
import { damageEnemy } from './enemies/system';
import { canHurtRexi, damageRexi } from './rexi';
import type { ProjectileBlast, ProjectileState } from './state';

/** How far outside the screen a projectile may travel before it is discarded, px. */
const OFFSCREEN_MARGIN = 32;

export interface ProjectileSpawn {
  readonly kind: ProjectileKind;
  readonly owner: 'rexi' | 'enemy';
  /** Center of the projectile at spawn. */
  readonly center: Vec2;
  readonly size: number;
  readonly velocity: Vec2;
  readonly damage: number;
  /** Lifetime, seconds. */
  readonly lifetime: number;
  /** Downward acceleration, px/s². Default 0. */
  readonly gravity?: number;
  /**
   * Makes an Enemy projectile explosive: it blows up on Rexi, the ground or a platform top,
   * hurting Rexi within the blast radius. Default: none (it just disappears at the ground).
   */
  readonly blast?: ProjectileBlast;
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
    blast: spawn.blast ?? null,
    damage: spawn.damage,
    ttl: secondsToTicks(spawn.lifetime),
    age: 0,
  };
  ctx.state.projectiles.push(projectile);
  return projectile;
}

/** Moves every projectile, resolves hits and removes spent ones. */
export function stepProjectiles(ctx: RunContext): void {
  const { state } = ctx;
  const groundY = ctx.tuning.arena.groundY;

  state.projectiles = state.projectiles.filter((p) => {
    const previousBottom = p.y + p.h;
    p.vy += p.gravity * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    p.age += 1;
    p.ttl -= 1;

    if (p.owner === 'rexi') {
      const target = state.enemies.find((enemy) => enemy.health > 0 && overlaps(p, enemy));
      if (target) {
        damageEnemy(ctx, target, p.damage);
        return false;
      }
    } else if (canHurtRexi(state.rexi) && overlaps(p, state.rexi)) {
      // While Rexi is invulnerable, Enemy projectiles fly through him.
      damageRexi(ctx, p.damage);
      if (p.blast) detonate(ctx, p, { x: p.x + p.w / 2, y: p.y + p.h / 2 });
      return false;
    } else if (p.blast) {
      const surfaceY = landingSurface(ctx, p, previousBottom);
      if (surfaceY !== null) {
        detonate(ctx, p, { x: p.x + p.w / 2, y: surfaceY });
        return false;
      }
    }

    return p.ttl > 0 && p.y + p.h < groundY && isNearScreen(p);
  });
}

/**
 * The top of the walkable surface (ground or a platform) an explosive projectile reached this
 * tick, falling from `previousBottom`, or null if it is still in the air.
 */
function landingSurface(
  ctx: RunContext,
  p: Readonly<ProjectileState>,
  previousBottom: number,
): number | null {
  const bottom = p.y + p.h;
  if (p.vy <= 0) return null;
  for (const platform of ctx.tuning.arena.platforms) {
    const crossed = previousBottom <= platform.y && bottom >= platform.y;
    if (crossed && p.x + p.w > platform.x && p.x < platform.x + platform.w) return platform.y;
  }
  const { groundY } = ctx.tuning.arena;
  return bottom >= groundY ? groundY : null;
}

/** Blows an explosive projectile up at `at`, hurting Rexi if he is within the blast radius. */
function detonate(ctx: RunContext, p: Readonly<ProjectileState>, at: Vec2): void {
  const blast = p.blast;
  if (!blast) return;
  const { rexi } = ctx.state;
  const nearestX = clamp(at.x, rexi.x, rexi.x + rexi.w);
  const nearestY = clamp(at.y, rexi.y, rexi.y + rexi.h);
  const inRange = Math.hypot(at.x - nearestX, at.y - nearestY) <= blast.radius;
  if (inRange && canHurtRexi(rexi)) damageRexi(ctx, p.damage);
  explode(ctx, at, blast.explosion);
  ctx.emit({ type: 'projectile-exploded', kind: p.kind, x: at.x, y: at.y });
}

function isNearScreen(p: Readonly<ProjectileState>): boolean {
  return (
    p.x + p.w > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y + p.h > -OFFSCREEN_MARGIN &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}
