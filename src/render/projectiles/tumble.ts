import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawTurned, type TurnSet, type TurnSprites } from './turned';

/**
 * Draws a baked part tumbling end over end: one `step`-degree turn every `ticks` ticks,
 * clockwise when it flies right (its top goes forward) and counter-clockwise when it flies left.
 * `turns` covers the angles from -180 (exclusive) to 180, or 0 to 180 for a part that looks the
 * same turned half round (a dumbbell).
 */
export function drawTumbling(
  dc: DrawContext,
  turns: { readonly sprites: TurnSprites; readonly set: TurnSet },
  projectile: ProjectileView,
  step: number,
  ticks: number,
  period = 360,
): void {
  const spin = projectile.vx < 0 ? 1 : -1;
  let degrees = (spin * Math.floor(projectile.age / ticks) * step) % period;
  if (period === 360) {
    if (degrees <= -180) degrees += 360;
    if (degrees > 180) degrees -= 360;
  } else if (degrees < 0) {
    degrees += period;
  }
  drawTurned(
    dc,
    turns.sprites,
    turns.set,
    degrees,
    projectile.x + projectile.w / 2,
    projectile.y + projectile.h / 2,
  );
}
