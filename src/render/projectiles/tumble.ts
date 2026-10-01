import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawTurned, type TumbleTurns } from './turned';

/**
 * Draws a baked part tumbling end over end: one `turns.step` turn every `ticksPerStep` ticks,
 * clockwise when it flies right (its top goes forward) and counter-clockwise when it flies left.
 * A full-circle set covers -180 (exclusive) to 180; a half-circle one 0 to 180 (exclusive).
 */
export function drawTumbling(
  dc: DrawContext,
  turns: TumbleTurns,
  projectile: ProjectileView,
  ticksPerStep: number,
): void {
  const spin = projectile.vx < 0 ? 1 : -1;
  const { step, period } = turns;
  let degrees = (spin * Math.floor(projectile.age / ticksPerStep) * step) % period;
  if (period === 360) {
    if (degrees <= -180) degrees += 360;
    if (degrees > 180) degrees -= 360;
  } else if (degrees < 0) {
    degrees += period;
  }
  drawTurned(dc, turns, degrees, projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
}
