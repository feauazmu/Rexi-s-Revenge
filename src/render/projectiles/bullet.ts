import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { bulletTurns } from './art';
import { drawAimed } from './turned';

/**
 * Hot tracer streak behind the slug, white-hot nearest to it and cooling down the fire ramp.
 * Two pixels thick and unbroken, so it reads over the sunset bands and the glass tower too
 * (consistency pass, #30): Enemy shots must stay visible over every part of the Arena.
 */
const TRAIL: readonly Color[] = [
  P.light,
  P.sunYellow,
  P.sunYellow,
  P.skyPeach,
  P.skyOrange,
  P.redLight,
];
/** Distance behind the slug's centre where the tracer starts, px. */
const TRAIL_FROM = 3;

/**
 * Caminadora a Reacción gatling round: a brass slug pointing along its flight (16 directions)
 * with a tracer behind it.
 */
export function drawBullet(dc: DrawContext, projectile: ProjectileView): void {
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const backX = -projectile.vx / speed;
  const backY = -projectile.vy / speed;
  // A mostly horizontal tracer is thickened downward, a mostly vertical one to the right.
  const thick = Math.abs(backX) > Math.abs(backY) ? { x: 0, y: 1 } : { x: 1, y: 0 };
  TRAIL.forEach((color, i) => {
    const x = Math.floor(cx + backX * (TRAIL_FROM + i));
    const y = Math.floor(cy + backY * (TRAIL_FROM + i));
    dc.surface.fillRect(x, y, 1 + thick.x, 1 + thick.y, color);
  });
  drawAimed(dc, bulletTurns, projectile.vx, projectile.vy, cx, cy);
}
