import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { bulletTurns } from './art';
import { drawAimed } from './turned';

/** Hot tracer streak behind the slug, brightest nearest to it (the palette's fire ramp). */
const TRAIL: readonly Color[] = [P.sunYellow, P.skyPeach, P.skyOrange, P.redLight];

/**
 * Caminadora a Reacción gatling round: a brass slug pointing along its flight (16 directions)
 * with a short tracer behind it.
 */
export function drawBullet(dc: DrawContext, projectile: ProjectileView): void {
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const backX = -projectile.vx / speed;
  const backY = -projectile.vy / speed;
  TRAIL.forEach((color, i) => {
    const distance = 4 + i * 1.5;
    dc.surface.fillRect(
      Math.floor(cx + backX * distance),
      Math.floor(cy + backY * distance),
      1,
      1,
      color,
    );
  });
  drawAimed(dc, bulletTurns.sprites, bulletTurns.set, projectile.vx, projectile.vy, cx, cy);
}
