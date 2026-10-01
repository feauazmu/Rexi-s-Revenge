import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { dumbbellTurns } from './art';
import { drawTumbling } from './tumble';

/** Mancuernas: a dumbbell tumbling end over end, spinning the way it flies (16 steps a turn). */
export function drawDumbbell(dc: DrawContext, projectile: ProjectileView): void {
  drawTumbling(dc, dumbbellTurns, projectile, 22.5, 2, 180);
}
