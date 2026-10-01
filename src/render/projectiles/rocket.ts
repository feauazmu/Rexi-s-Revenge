import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { fillDisc } from '../effects/burst';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { rocketTurns } from './art';
import { drawAimed } from './turned';

/** The exhaust's outer tongue flickers through these; its core is always white-hot. */
const FLAME: readonly Color[] = [P.sunYellow, P.skyPeach, P.skyOrange];
const SMOKE: readonly Color[] = [P.grey3, P.grey2, P.grey1];

/** How far behind its centre the rocket's tail is, px. */
const TAIL = 7;

/**
 * A Banca Artillada rocket: points along its velocity (16 directions), with a flickering exhaust
 * flame and a short smoke trail behind it that grows as it gets going.
 */
export function drawRocket(dc: DrawContext, projectile: ProjectileView): void {
  const { surface } = dc;
  const cx = projectile.x + projectile.w / 2;
  const cy = projectile.y + projectile.h / 2;
  const speed = Math.hypot(projectile.vx, projectile.vy) || 1;
  const back = { x: -projectile.vx / speed, y: -projectile.vy / speed };

  // Smoke trail: puffs further back are older, larger and darker.
  const puffs = Math.min(3, Math.floor(projectile.age / 3));
  for (let i = puffs; i >= 1; i--) {
    const wobble = ((projectile.age + i) % 2) * 2 - 1;
    const distance = TAIL + 2 + i * 4;
    fillDisc(
      surface,
      cx + back.x * distance - back.y * wobble,
      cy + back.y * distance + back.x * wobble,
      1 + Math.ceil(i / 2),
      SMOKE[i - 1] ?? P.grey2,
    );
  }
  // Exhaust flame, flickering between a long and a short tongue around a white-hot core: the
  // brightest point of the rocket, so it reads over the dark skyline and the blue glass too
  // (consistency pass, #30).
  const long = projectile.age % 4 < 2;
  const flame = FLAME[projectile.age % FLAME.length] ?? P.sunYellow;
  fillDisc(surface, cx + back.x * (TAIL + 1), cy + back.y * (TAIL + 1), long ? 3 : 2, flame);
  fillDisc(surface, cx + back.x * TAIL, cy + back.y * TAIL, 1, P.light);

  drawAimed(dc, rocketTurns, projectile.vx, projectile.vy, cx, cy);
}
