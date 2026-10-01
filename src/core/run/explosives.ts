import { center, clamp, type Box, type Vec2 } from '../math';
import type { SplashTuning } from '../tuning';
import type { RunContext } from './context';
import { explode } from './effects';
import { damageEnemy } from './enemies/system';
import { canHurtRexi, damageRexi } from './rexi';
import type { Blast, ProjectileState } from './state';

/** The blast of an explosive Weapon, from its splash tuning. */
export function splashBlast(t: SplashTuning): Blast {
  return {
    radius: t.splashRadius,
    damage: t.splashDamage,
    edge: t.splashEdge,
    explosion: t.explosion,
  };
}

/**
 * Detonates an explosive projectile at `at` (default: its center): the `explosion` event, the
 * explosion effect, then splash damage on whatever its owner fights. Rexi's blasts hurt every
 * Enemy within reach and never Rexi; Enemy blasts hurt only Rexi, and not while he is
 * invulnerable.
 */
export function detonate(
  ctx: RunContext,
  p: Readonly<ProjectileState>,
  at: Vec2 = center(p),
): void {
  const { blast } = p;
  if (!blast) return;
  ctx.emit({
    type: 'explosion',
    owner: p.owner,
    kind: p.kind,
    size: blast.explosion,
    x: at.x,
    y: at.y,
    radius: blast.radius,
  });
  explode(ctx, at, blast.explosion);
  if (p.owner === 'rexi') {
    // A copy: Enemies destroyed by the splash leave the list while it is applied.
    for (const enemy of [...ctx.state.enemies]) {
      const damage = splashDamageAt(blast, distanceToBox(at, enemy));
      if (damage > 0) damageEnemy(ctx, enemy, damage);
    }
  } else if (canHurtRexi(ctx.state.rexi)) {
    const damage = splashDamageAt(blast, distanceToBox(at, ctx.state.rexi));
    if (damage > 0) damageRexi(ctx, damage);
  }
}

/**
 * Splash damage at `distance` px from the blast: full at the center, falling off linearly to
 * `edge` × full at the radius, nothing beyond it. Rounded to whole damage, at least 1.
 */
function splashDamageAt(blast: Blast, distance: number): number {
  if (blast.damage <= 0 || distance > blast.radius) return 0;
  const reach = blast.radius > 0 ? distance / blast.radius : 0;
  const scaled = blast.damage * (1 - (1 - blast.edge) * reach);
  return Math.max(1, Math.round(scaled));
}

/** Distance from a point to the nearest point of a box (0 inside it), px. */
function distanceToBox(point: Vec2, box: Readonly<Box>): number {
  const dx = point.x - clamp(point.x, box.x, box.x + box.w);
  const dy = point.y - clamp(point.y, box.y, box.y + box.h);
  return Math.hypot(dx, dy);
}
