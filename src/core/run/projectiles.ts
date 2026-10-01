import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { ProjectileKind } from '../ids';
import { overlaps, type Vec2 } from '../math';
import type { RunContext } from './context';
import { damageEnemy } from './enemies/system';
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
  };
  ctx.state.projectiles.push(projectile);
  return projectile;
}

/** Moves every projectile, resolves hits and removes spent ones. */
export function stepProjectiles(ctx: RunContext): void {
  const { state } = ctx;
  const groundY = ctx.tuning.arena.groundY;

  state.projectiles = state.projectiles.filter((p) => {
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
    }

    return p.ttl > 0 && p.y + p.h < groundY && isNearScreen(p);
  });
}

function isNearScreen(p: Readonly<ProjectileState>): boolean {
  return (
    p.x + p.w > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y + p.h > -OFFSCREEN_MARGIN &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}
