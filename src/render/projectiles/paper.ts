import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { mirroredSprite, rotateSprite } from '../sprite';
import { projectileArt } from './art';

/** A tumbling legal paper (a "demanda"): upright, tilted, sideways, tilted back. */
const FRAMES = [
  projectileArt.paper,
  projectileArt.paper_tilt,
  rotateSprite(projectileArt.paper, 1),
  mirroredSprite(projectileArt.paper_tilt),
];

/** Ticks each tumble frame is shown. */
const FRAME_TICKS = 6;

export function drawPaper(dc: DrawContext, projectile: ProjectileView): void {
  const frame = FRAMES[Math.floor(projectile.age / FRAME_TICKS) % FRAMES.length] ?? FRAMES[0];
  if (!frame) return;
  drawSpriteCentered(dc, frame, projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
}
