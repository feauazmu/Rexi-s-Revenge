import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

/** A sealed manila envelope with a red wax seal (Citaciones Teledirigidas). */
const ENVELOPE = defineSprite({ k: palette.outline, p: '#f0dcb0', f: '#b89464', r: '#e02828' }, [
  'kkkkkkk',
  'kfpppfk',
  'kpfpfpk',
  'kpprppk',
  'kkkkkkk',
]);

/** Dots trailing behind the envelope, nearest first: distance from its center, size, color. */
const TRAIL: readonly { readonly at: number; readonly size: number; readonly color: Color }[] = [
  { at: 6, size: 2, color: '#ff8a7a' },
  { at: 9, size: 1, color: '#ff8a7a' },
  { at: 12, size: 1, color: '#f0dcb0' },
];

/** The envelope and a short streak behind it, which shows where it is steering. */
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
  drawSpriteCentered(dc, ENVELOPE, cx, cy);
}
