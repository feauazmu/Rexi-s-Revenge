import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';

const colors = { h: '#c08040', d: '#6a3e1c', s: '#e8d0a0' } as const;

/** Spinning gavel: four quarter-turn frames. */
const FRAMES = [
  defineSprite(colors, ['.hhh.', '.dhd.', '..s..', '..s..', '..s..']),
  defineSprite(colors, ['.....', 'h....', 'hdsss', 'h....', '.....']),
  defineSprite(colors, ['..s..', '..s..', '..s..', '.dhd.', '.hhh.']),
  defineSprite(colors, ['.....', '....h', 'sssdh', '....h', '.....']),
];

export function drawGavel(dc: DrawContext, projectile: ProjectileView): void {
  const frame = FRAMES[Math.floor(projectile.age / 3) % FRAMES.length] ?? FRAMES[0];
  if (!frame) return;
  drawSpriteCentered(dc, frame, projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
}
