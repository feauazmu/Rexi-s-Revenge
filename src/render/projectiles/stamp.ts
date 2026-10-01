import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { stampTurns } from './art';
import { drawTumbling } from './tumble';

/** Lluvia de Sellos: a rubber stamp tumbling through the air. */
export function drawStamp(dc: DrawContext, projectile: ProjectileView): void {
  drawTumbling(dc, stampTurns, projectile, 3);
}
