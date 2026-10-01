import type { RunView } from '../../core';
import {
  drawSpriteCentered,
  silhouetteContext,
  translatedContext,
  type DrawContext,
} from '../draw-context';
import { armSprite, FIST_REACH, stepDirection } from '../rexi/arm';
import {
  ARM_PIVOT,
  BODY_ANCHOR_X,
  BODY_HEIGHT,
  BODY_WIDTH,
  bodySprite,
  capSprite,
} from '../rexi/body';
import { heldWeapons } from '../rexi/held-weapons';
import { drawRexiTrails } from './power-up-effects';
import { rexiPalette } from '../rexi/palette';
import { rexiPose } from '../rexi/pose';
import { palette } from '../palette';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

// prettier-ignore
const MUZZLE_FLASH = [
  defineSprite(rexiPalette, ['.y.', 'yty', '.y.']),
  defineSprite(rexiPalette, ['..y..', '.yty.', 'yttty', '.yty.', '..y..']),
] as const;

/** Inmunidad Judicial's glow: a 1 px outline alternating gold and white. */
const IMMUNITY_GLOW: readonly Color[] = ['#ffd84a', '#fff8e0'];
const IMMUNITY_GLOW_TICKS = 4;
/** During its last seconds the glow flickers, warning that it is about to end. */
const IMMUNITY_WARNING_TICKS = 120;
const OUTLINE_OFFSETS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;

/**
 * Rexi, over the trails his Power-ups leave (Pre-entreno's speed lines, Día de Pierna's jet) and
 * outlined by a glow while Inmunidad Judicial protects him.
 */
export function drawRexi(dc: DrawContext, run: RunView): void {
  drawRexiTrails(dc, run);
  const immunity = run.rexi.powerUps.find((p) => p.id === 'inmunidad-judicial');
  const flickerOff =
    immunity !== undefined &&
    immunity.ticksLeft <= IMMUNITY_WARNING_TICKS &&
    Math.floor(immunity.ticksLeft / IMMUNITY_GLOW_TICKS) % 2 === 1;
  if (immunity && !flickerOff) {
    const color =
      IMMUNITY_GLOW[Math.floor(run.tick / IMMUNITY_GLOW_TICKS) % IMMUNITY_GLOW.length] ??
      palette.white;
    const glow = silhouetteContext(dc, color);
    for (const [dx, dy] of OUTLINE_OFFSETS) drawFigure(translatedContext(glow, dx, dy), run);
  }
  drawFigure(dc, run);
}

/**
 * Rexi's figure: the composed body for his pose, then the aiming arm with his Weapon in one of
 * 16 directions, the deltoid cap over the arm's root. The sleeve tattoo on his left upper arm is
 * part of the body, arm and cap sprites (whichever of them is his left arm for the facing).
 */
function drawFigure(dc: DrawContext, run: RunView): void {
  const { surface, sprites } = dc;
  const { rexi } = run;
  const { facing } = rexi;
  const pose = rexiPose(rexi, run.tick);

  // The body canvas stands on the hitbox's bottom edge, centered on it.
  const left = Math.round(rexi.x + rexi.w / 2) - BODY_ANCHOR_X;
  const top = Math.round(rexi.y + rexi.h) - BODY_HEIGHT;
  surface.drawBitmap(sprites.get(bodySprite(pose.body, facing, pose.flash)), left, top);

  // Upper-body offsets are authored facing right; mirror them with the body.
  const ux = pose.body.upperX * facing;
  const uy = pose.body.upperY;
  const pivotX = left + ux + (facing === 1 ? ARM_PIVOT.x : BODY_WIDTH - 1 - ARM_PIVOT.x);
  const pivotY = top + uy + ARM_PIVOT.y;

  const weapon = heldWeapons[rexi.weapon.id];
  const arm = armSprite(weapon, pose.armStep, facing, pose.flash);
  const step = stepDirection(pose.armStep);
  const dir = { x: step.x * facing, y: step.y };
  const kickX = Math.round(-dir.x * pose.recoil);
  const kickY = Math.round(-dir.y * pose.recoil);
  surface.drawBitmap(
    sprites.get(arm.sprite),
    pivotX - arm.pivotX + kickX,
    pivotY - arm.pivotY + kickY,
  );

  const cap = capSprite(facing, pose.flash);
  surface.drawBitmap(sprites.get(cap.sprite), left + ux + cap.x, top + uy + cap.y);

  const flash = pose.muzzleFlash > 0 ? MUZZLE_FLASH[pose.muzzleFlash - 1] : undefined;
  if (flash) {
    const reach = FIST_REACH + weapon.length + 2;
    drawSpriteCentered(
      dc,
      flash,
      pivotX + 0.5 + kickX + dir.x * reach,
      pivotY + 0.5 + kickY + dir.y * reach,
    );
  }
}
