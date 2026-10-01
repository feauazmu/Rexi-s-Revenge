import type { DebrisParticleView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { enemyDebris } from '../enemies';
import { rotateSprite } from '../sprite';

/** A tumbling chunk of a destroyed Enemy, cut from that Enemy's own art. */
export function drawDebris(dc: DrawContext, p: DebrisParticleView): void {
  if (p.hidden) return;
  const chunks = enemyDebris[p.enemyKind];
  const chunk = chunks[p.piece % chunks.length];
  if (!chunk) return;
  const sprite = rotateSprite(chunk, p.quarterTurns);
  // Sit the chunk on the bottom of its box, so settled chunks rest on the ground.
  drawSpriteCentered(dc, sprite, p.x, p.y + p.size / 2 - sprite.height / 2);
}
