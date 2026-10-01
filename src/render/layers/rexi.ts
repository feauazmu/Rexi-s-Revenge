import type { RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import type { Color } from '../surface';

const HAIR: Color = '#b5835a';
const SKIN: Color = '#e8b48a';
const ROBE: Color = '#23202e';
const TANK_TOP: Color = '#f2f2f2';
const LEGS: Color = '#3a3448';
const ARM: Color = '#e8b48a';
const MAZO: Color = '#8a5a34';

/** While invulnerable, Rexi blinks: hidden for this many ticks, then shown for as many. */
const BLINK_TICKS = 4;

/**
 * Placeholder Rexi: blocky body plus an "arm" of pixels toward the aim point. Replaced by the
 * code-drawn sprite and animations in the Rexi sprite ticket.
 */
export function drawRexi(dc: DrawContext, run: RunView): void {
  const { surface } = dc;
  const { x, y, w, h, facing, muzzle, aimDirection, invulnerableTicks } = run.rexi;
  // Placeholder hurt feedback (blink); the hurt animation arrives with the Rexi sprite ticket.
  if (invulnerableTicks > 0 && Math.floor(invulnerableTicks / BLINK_TICKS) % 2 === 1) return;

  surface.fillRect(x + 3, y, w - 6, 4, HAIR);
  surface.fillRect(x + 3, y + 4, w - 6, 5, SKIN);
  surface.fillRect(x, y + 9, w, 12, ROBE);
  surface.fillRect(x + 4, y + 9, w - 8, 8, TANK_TOP);
  surface.fillRect(x + 2, y + 21, w - 4, h - 21, LEGS);
  // Eye on the facing side.
  surface.fillRect(facing === 1 ? x + w - 6 : x + 5, y + 5, 1, 1, ROBE);

  // Arm: a short chain of pixels from the shoulder to the muzzle, then the Weapon.
  for (let step = 6; step >= 1; step -= 1) {
    surface.fillRect(
      muzzle.x - aimDirection.x * step - 1,
      muzzle.y - aimDirection.y * step - 1,
      2,
      2,
      ARM,
    );
  }
  surface.fillRect(
    muzzle.x + aimDirection.x * 2 - 1.5,
    muzzle.y + aimDirection.y * 2 - 1.5,
    3,
    3,
    MAZO,
  );
}
