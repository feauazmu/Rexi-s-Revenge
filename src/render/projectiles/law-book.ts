import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { lawBookTurns } from './art';
import { drawAimed } from './turned';

/** Exhaust from the back cover, hot to cool along the palette's fire ramp. */
const FLAME: readonly Color[] = [P.white, P.sunYellow, P.skyPeach, P.redLight];

/** How far behind its centre the book's back cover is, px. */
const BACK = 7;

/** Ticks per flame flicker frame. */
const FLICKER_TICKS = 2;

/**
 * Código Penal: the law book points along its velocity (16 directions, upright both ways) with a
 * flickering exhaust tongue out of its back.
 */
export function drawLawBook(dc: DrawContext, projectile: ProjectileView): void {
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const bx = -projectile.vx / speed;
  const by = -projectile.vy / speed;
  const long = Math.floor(projectile.age / FLICKER_TICKS) % 2 === 0;
  const length = long ? 7 : 5;
  // Back to front so the hotter steps nearer the book are drawn last; 2 px wide near the book.
  for (let d = length; d >= 1; d--) {
    const t = d / length;
    const color = FLAME[Math.min(FLAME.length - 1, Math.floor(t * FLAME.length))] ?? P.redLight;
    const size = d <= length / 2 ? 2 : 1;
    dc.surface.fillRect(
      Math.round(cx + bx * (BACK + d) - size / 2),
      Math.round(cy + by * (BACK + d) - size / 2),
      size,
      size,
      color,
    );
  }
  drawAimed(dc, lawBookTurns.sprites, lawBookTurns.set, projectile.vx, projectile.vy, cx, cy);
}
