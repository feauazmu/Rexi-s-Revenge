import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { rotatedShapeSprites } from './rotated-shape';

/** Cast-iron plates on a steel bar. */
const colors = {
  k: palette.outline,
  W: '#d8dce6',
  p: '#8e8e9a',
  P: '#4e4e5c',
  b: '#c0c4cc',
} as const;

/** Mancuernas: a dumbbell, `u` along its bar. Plates are lit from above. */
function paintDumbbell(u: number, v: number): string | null {
  const along = Math.abs(u);
  if (along >= 2 && along <= 4.3 && Math.abs(v) <= 3.2) {
    if (v < -1.3) return 'W';
    return v > 1.1 ? 'P' : 'p';
  }
  if (along < 2 && Math.abs(v) <= 0.9) return 'b';
  return null;
}

/** 16 steps around the circle; the shape is symmetric, so 8 distinct looks. */
const spriteAt = rotatedShapeSprites({ palette: colors, paint: paintDumbbell, radius: 5.4 }, 16);

/** Ticks per spin step (π/8). */
const SPIN_TICKS = 2;

/** A dumbbell tumbling end over end, spinning the way it flies. */
export function drawDumbbell(dc: DrawContext, projectile: ProjectileView): void {
  const spin = projectile.vx < 0 ? -1 : 1;
  const angle = (spin * Math.floor(projectile.age / SPIN_TICKS) * Math.PI) / 8;
  drawSpriteCentered(
    dc,
    spriteAt(angle),
    projectile.x + projectile.w / 2,
    projectile.y + projectile.h / 2,
  );
}
