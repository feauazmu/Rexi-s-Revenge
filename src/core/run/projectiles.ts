import { DT, SCREEN_HEIGHT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { ProjectileKind } from '../ids';
import { center, overlaps, type Vec2 } from '../math';
import type { ExplosionSize } from '../tuning';
import type { RunContext } from './context';
import { explode } from './effects';
import { damageEnemy } from './enemies/system';
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
  /** Rocket thrust: speeds up along its heading by `acceleration` px/s², up to `maxSpeed` px/s. */
  readonly thrust?: { readonly acceleration: number; readonly maxSpeed: number };
  /**
   * Turns toward Rexi at up to `turnRate` degrees per second for the first `duration`
   * seconds, then flies straight. Meant for Enemy projectiles.
   */
  readonly homing?: { readonly turnRate: number; readonly duration: number };
  /** Explosion played where it ends: on a hit, at the ground or when its lifetime runs out. */
  readonly burst?: ExplosionSize;
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
    thrust: spawn.thrust ?? null,
    homing: spawn.homing
      ? {
          turnRate: (spawn.homing.turnRate * Math.PI) / 180,
          ticksLeft: secondsToTicks(spawn.homing.duration),
        }
      : null,
    burst: spawn.burst ?? null,
  };
  ctx.state.projectiles.push(projectile);
  return projectile;
}

/** Moves every projectile, resolves hits and removes spent ones. */
export function stepProjectiles(ctx: RunContext): void {
  const { state } = ctx;
  const groundY = ctx.tuning.arena.groundY;

  state.projectiles = state.projectiles.filter((p) => {
    steer(ctx, p);
    p.vy += p.gravity * DT;
    p.x += p.vx * DT;
    p.y += p.vy * DT;
    p.age += 1;
    p.ttl -= 1;

    if (p.owner === 'rexi') {
      const target = state.enemies.find((enemy) => enemy.health > 0 && overlaps(p, enemy));
      if (target) {
        damageEnemy(ctx, target, p.damage);
        burst(ctx, p);
        return false;
      }
    } else if (canHurtRexi(state.rexi) && overlaps(p, state.rexi)) {
      // While Rexi is invulnerable, Enemy projectiles fly through him.
      damageRexi(ctx, p.damage);
      burst(ctx, p);
      return false;
    }

    if (p.ttl <= 0 || p.y + p.h >= groundY) {
      burst(ctx, p);
      return false;
    }
    return isNearScreen(p);
  });
}

/** Homing then thrust: turns toward Rexi while homing, then speeds up along its heading. */
function steer(ctx: RunContext, p: ProjectileState): void {
  if (p.homing && p.homing.ticksLeft > 0) {
    p.homing.ticksLeft -= 1;
    const from = center(p);
    const to = center(ctx.state.rexi);
    const heading = Math.atan2(p.vy, p.vx);
    const wanted = Math.atan2(to.y - from.y, to.x - from.x);
    // Shortest signed turn from the heading to the wanted direction, in (-π, π].
    const delta = Math.atan2(Math.sin(wanted - heading), Math.cos(wanted - heading));
    const maxTurn = p.homing.turnRate * DT;
    const turned = heading + Math.max(-maxTurn, Math.min(maxTurn, delta));
    const speed = Math.hypot(p.vx, p.vy);
    p.vx = Math.cos(turned) * speed;
    p.vy = Math.sin(turned) * speed;
  }
  if (p.thrust) {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0 && speed < p.thrust.maxSpeed) {
      const faster = Math.min(p.thrust.maxSpeed, speed + p.thrust.acceleration * DT);
      p.vx *= faster / speed;
      p.vy *= faster / speed;
    }
  }
}

/** Plays the projectile's end-of-flight explosion, if it has one (cosmetic). */
function burst(ctx: RunContext, p: Readonly<ProjectileState>): void {
  if (p.burst) explode(ctx, center(p), p.burst);
}

function isNearScreen(p: Readonly<ProjectileState>): boolean {
  return (
    p.x + p.w > -OFFSCREEN_MARGIN &&
    p.x < SCREEN_WIDTH + OFFSCREEN_MARGIN &&
    p.y + p.h > -OFFSCREEN_MARGIN &&
    p.y < SCREEN_HEIGHT + OFFSCREEN_MARGIN
  );
}
