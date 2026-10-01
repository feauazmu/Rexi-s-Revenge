import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

/** Hot tracer streak behind the slug, brightest nearest to it. */
const TRAIL: readonly Color[] = ['#ffd040', '#ff8a20', '#d8341c'];

/** A dark-outlined brass slug, so it reads against both the sky and the buildings. */
const SLUG = defineSprite({ k: palette.outline, W: '#fff8d8', Y: '#ffd040', O: '#e09020' }, [
  '.kk.',
  'kWYk',
  'kYOk',
  '.kk.',
]);

/** Caminadora a Reacción gatling bullet: a slug with a short tracer pointing back along its path. */
export function drawBullet(dc: DrawContext, projectile: ProjectileView): void {
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const backX = -projectile.vx / speed;
  const backY = -projectile.vy / speed;
  TRAIL.forEach((color, i) => {
    const distance = 2.5 + i * 1.5;
    const x = Math.floor(cx + backX * distance);
    const y = Math.floor(cy + backY * distance);
    dc.surface.fillRect(x, y, 1, 1, color);
  });
  drawSpriteCentered(dc, SLUG, cx, cy);
}
