import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { gavelTurns } from './art';
import { drawTumbling } from './tumble';

/** Mazo Automático: a gavel tumbling head over handle, spinning the way it flies. */
export function drawGavel(dc: DrawContext, projectile: ProjectileView): void {
  drawTumbling(dc, gavelTurns, projectile, 45, 2);
}
