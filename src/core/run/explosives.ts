import { clamp, type Box, type Vec2 } from '../math';
import type { RunContext } from './context';
import { explode } from './effects';
import { damageEnemy } from './enemies/system';
import type { Blast } from './state';

/**
 * Detonates an explosive Weapon's blast at `at`: the `explosion` event, the explosion effect,
 * then splash damage on every Enemy within reach. Splash only ever hurts Enemies, never Rexi.
 */
export function detonate(ctx: RunContext, blast: Blast, at: Vec2): void {
  ctx.emit({
    type: 'explosion',
    weapon: blast.weapon,
    x: at.x,
    y: at.y,
    radius: blast.splashRadius,
  });
  explode(ctx, at, blast.explosion);
  // A copy: Enemies destroyed by the splash leave the list while it is applied.
  for (const enemy of [...ctx.state.enemies]) {
    const damage = splashDamageAt(blast, distanceToBox(at, enemy));
    if (damage > 0) damageEnemy(ctx, enemy, damage);
  }
}

/**
 * Splash damage at `distance` px from the blast: full at the center, falling off linearly to
 * `splashEdge` × full at the radius, nothing beyond it. Rounded to whole damage, at least 1.
 */
function splashDamageAt(blast: Blast, distance: number): number {
  if (blast.splashDamage <= 0 || distance > blast.splashRadius) return 0;
  const reach = blast.splashRadius > 0 ? distance / blast.splashRadius : 0;
  const scaled = blast.splashDamage * (1 - (1 - blast.splashEdge) * reach);
  return Math.max(1, Math.round(scaled));
}

/** Distance from a point to the nearest point of a box (0 inside it), px. */
function distanceToBox(point: Vec2, box: Readonly<Box>): number {
  const dx = point.x - clamp(point.x, box.x, box.x + box.w);
  const dy = point.y - clamp(point.y, box.y, box.y + box.h);
  return Math.hypot(dx, dy);
}
