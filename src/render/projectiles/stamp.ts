import type { ProjectileView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';

const colors = { r: '#d42a2a', R: '#ff8a7a', B: '#3a4ec0' } as const;

/** Tumbling rubber stamp (Lluvia de Sellos): four quarter-turn frames. */
const FRAMES = [
  defineSprite(colors, ['.rrr.', '.rRr.', '..r..', 'rrrrr', 'rrrrr', 'BBBBB']),
  defineSprite(colors, ['Brr...', 'Brr.rr', 'BrrrRr', 'Brr.rr', 'Brr...']),
  defineSprite(colors, ['BBBBB', 'rrrrr', 'rrrrr', '..r..', '.rRr.', '.rrr.']),
  defineSprite(colors, ['...rrB', 'rr.rrB', 'rRrrrB', 'rr.rrB', '...rrB']),
];

export function drawStamp(dc: DrawContext, projectile: ProjectileView): void {
  const frame = FRAMES[Math.floor(projectile.age / 3) % FRAMES.length] ?? FRAMES[0];
  if (!frame) return;
  drawSpriteCentered(dc, frame, projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
}
