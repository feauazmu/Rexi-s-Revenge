import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { projectileArt } from './art';

/** Dots trailing behind the envelope, nearest first: distance from its center, size, color. */
const TRAIL: readonly { readonly at: number; readonly size: number; readonly color: Color }[] = [
  { at: 8, size: 2, color: P.coral },
  { at: 11, size: 2, color: P.redLight },
  { at: 14, size: 1, color: P.hairLight },
];

/**
 * Citaciones Teledirigidas: a sealed manila envelope and a short streak behind it, which shows
 * where it is steering.
 */
export function drawSubpoena(dc: DrawContext, projectile: ProjectileView): void {
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy);
  if (speed > 0) {
    const bx = -projectile.vx / speed;
    const by = -projectile.vy / speed;
    // The streak grows in over the first few ticks, so it never starts behind the muzzle.
    for (const dot of TRAIL.slice(0, Math.min(TRAIL.length, projectile.age))) {
      dc.surface.fillRect(
        Math.round(cx + bx * dot.at - dot.size / 2),
        Math.round(cy + by * dot.at - dot.size / 2),
        dot.size,
        dot.size,
        dot.color,
      );
    }
  }
  drawSpriteCentered(dc, projectileArt.subpoena, cx, cy);
}
