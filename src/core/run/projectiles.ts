import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { ProjectileKind } from '../ids';
import { center, clamp, overlaps, rotate, type Box, type Vec2 } from '../math';
import type { RunContext } from './context';
import { damageEnemy } from './enemies/system';
import { enemyTimeScale } from './power-ups/pre-entreno';
import { canHurtRexi, damageRexi } from './rexi';
import type { ProjectileState } from './state';

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
   * Homing: fastest turn toward the nearest target (Enemies for Rexi's projectiles, Rexi for
   * Enemy ones), degrees per second. Default 0: flies straight.
   */
  readonly turnRate?: number;
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
    turnRate: ((spawn.turnRate ?? 0) * Math.PI) / 180,
    damage: spawn.damage,
    ttl: secondsToTicks(spawn.lifetime),
    age: 0,
  };
  ctx.state.projectiles.push(projectile);
  return projectile;
}

/**
 * Moves every projectile, resolves hits and removes spent ones. Enemy projectiles run on Enemy
 * time (Pre-entreno slows their flight, homing and lifetime); Rexi's always run at full speed.
 */
export function stepProjectiles(ctx: RunContext): void {
  const { state } = ctx;
  const groundY = ctx.tuning.arena.groundY;
  const enemyScale = enemyTimeScale(ctx);

  state.projectiles = state.projectiles.filter((p) => {
    const scale = p.owner === 'enemy' ? enemyScale : 1;
    const dt = DT * scale;
    if (p.turnRate > 0) steer(ctx, p, dt);
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += 1;
    p.ttl -= scale;

    if (p.owner === 'rexi') {
      const target = state.enemies.find((enemy) => enemy.health > 0 && overlaps(p, enemy));
      if (target) {
        damageEnemy(ctx, target, p.damage);
        return false;
      }
    } else if (canHurtRexi(state.rexi) && overlaps(p, state.rexi)) {
      // While Rexi is invulnerable, Enemy projectiles fly through him.
      damageRexi(ctx, p.damage);
      return false;
    }

    return p.ttl > 0 && p.y + p.h < groundY && isNearScreen(p);
  });
}

/** Turns a homing projectile toward its nearest target by at most its turn rate, keeping its speed. */
function steer(ctx: RunContext, p: ProjectileState, dt: number): void {
  const target = homingTarget(ctx, p);
  if (!target) return;
  const from = center(p);
  const to = center(target);
  const heading = Math.atan2(p.vy, p.vx);
  const wanted = Math.atan2(to.y - from.y, to.x - from.x);
  // Shortest signed angle from the heading to the target, in (-π, π].
  const error = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
  const maxTurn = p.turnRate * dt;
  const turned = rotate({ x: p.vx, y: p.vy }, clamp(error, -maxTurn, maxTurn));
  p.vx = turned.x;
  p.vy = turned.y;
}

/** The nearest live Enemy for Rexi's projectiles, or Rexi for Enemy ones. */
function homingTarget(ctx: RunContext, p: Readonly<ProjectileState>): Readonly<Box> | null {
  if (p.owner === 'enemy') return ctx.state.rexi;
  const from = center(p);
  let nearest: Readonly<Box> | null = null;
  let best = Infinity;
  for (const enemy of ctx.state.enemies) {
    if (enemy.health <= 0) continue;
    const c = center(enemy);
    const distance = (c.x - from.x) ** 2 + (c.y - from.y) ** 2;
    if (distance < best) {
      best = distance;
      nearest = enemy;
    }
  }
  return nearest;
}

function isNearScreen(p: Readonly<ProjectileState>): boolean {
  return (
    p.x + p.w > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y + p.h > -OFFSCREEN_MARGIN &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}
