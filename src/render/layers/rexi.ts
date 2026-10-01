import type { RunView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { armSprite, FIST_REACH, stepDirection } from '../rexi/arm';
import {
  ARM_PIVOT,
  BODY_ANCHOR_X,
  BODY_HEIGHT,
  BODY_WIDTH,
  bodySprite,
  capSprite,
  tattooSprite,
} from '../rexi/body';
import { heldWeapons } from '../rexi/held-weapons';
import { rexiPalette } from '../rexi/palette';
import { rexiPose } from '../rexi/pose';
import { defineSprite } from '../sprite';

// prettier-ignore
const MUZZLE_FLASH = [
  defineSprite(rexiPalette, ['.y.', 'yty', '.y.']),
  defineSprite(rexiPalette, ['..y..', '.yty.', 'yttty', '.yty.', '..y..']),
] as const;

/**
 * Rexi: the composed body for his pose, then the aiming arm with his Weapon in one of 16
 * directions, the deltoid cap over the arm's root and the tattoo on his left arm.
 */
export function drawRexi(dc: DrawContext, run: RunView): void {
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
  if (!pose.flash) {
    const tattoo = tattooSprite(facing);
    surface.drawBitmap(sprites.get(tattoo.sprite), left + ux + tattoo.x, top + uy + tattoo.y);
  }

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
