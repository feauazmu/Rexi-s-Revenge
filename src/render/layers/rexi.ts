import type { RunView } from '../../core';
import {
  drawSpriteCentered,
  silhouetteContext,
  translatedContext,
  type DrawContext,
} from '../draw-context';
import { armAngleIndex, stepDirection } from '../rexi/arm';
import {
  armReach,
  armSprite,
  bodyOrigin,
  bodyPoint,
  bodySprite,
  capSprite,
  shoulderOf,
} from '../rexi/art';
import { heldWeapons } from '../rexi/held-weapons';
import { drawRexiTrails } from './power-up-effects';
import { rexiPose, type RexiPose } from '../rexi/pose';
import { masterPalette as P } from '../palette';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

/** The shot's flash at the muzzle: a small and a big star in the fire ramp's light end. */
const FLASH = { y: P.gold, l: P.light, w: P.white };
// prettier-ignore
const MUZZLE_FLASH = [
  defineSprite(FLASH, ['..y..', '.yly.', 'ylwly', '.yly.', '..y..']),
  defineSprite(FLASH, ['...y...', '..yly..', '.ylwly.', 'ylwwwly', '.ylwly.', '..yly..', '...y...']),
] as const;

/** Inmunidad Judicial's glow: a 1 px outline alternating gold and light. */
const IMMUNITY_GLOW: readonly Color[] = [P.gold, P.light];
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
 * Rexi, over the trails his Power-ups leave (Pre-entreno's speed lines, Día de Pierna's jets) and
 * outlined by a glow while Inmunidad Judicial protects him.
 */
export function drawRexi(dc: DrawContext, run: RunView): void {
  const pose = rexiPose(run.rexi, run.tick);
  drawRexiTrails(dc, run, pose.frame);
  const immunity = run.rexi.powerUps.find((p) => p.id === 'inmunidad-judicial');
  const flickerOff =
    immunity !== undefined &&
    immunity.ticksLeft <= IMMUNITY_WARNING_TICKS &&
    Math.floor(immunity.ticksLeft / IMMUNITY_GLOW_TICKS) % 2 === 1;
  if (immunity && !flickerOff) {
    const color =
      IMMUNITY_GLOW[Math.floor(run.tick / IMMUNITY_GLOW_TICKS) % IMMUNITY_GLOW.length] ?? P.white;
    const glow = silhouetteContext(dc, color);
    for (const [dx, dy] of OUTLINE_OFFSETS) {
      drawFigure(translatedContext(glow, dx, dy), run, pose);
    }
  }
  drawFigure(dc, run, pose);
}

/**
 * Rexi's figure (pipeline art, ADR 0002): the body frame for his pose and facing, then the
 * aiming arm holding his Weapon in one of 16 directions at the frame's shoulder, the lapel over
 * its root, and the muzzle flash. The sleeve is on his right arm in every facing: in the body
 * frame facing right (the near arm) and on the aiming arm facing left. `pose` is
 * `rexiPose(run.rexi, run.tick)`.
 */
export function drawFigure(dc: DrawContext, run: RunView, pose: RexiPose): void {
  const { surface, sprites } = dc;
  const { rexi } = run;
  const { facing } = rexi;

  const origin = bodyOrigin(rexi, facing);
  surface.drawBitmap(sprites.get(bodySprite(pose.frame, facing, pose.flash)), origin.x, origin.y);

  const art = heldWeapons[rexi.weapon.id];
  const arm = armSprite(art, armAngleIndex(pose.armStep), facing, pose.flash);
  const step = stepDirection(pose.armStep);
  const dir = { x: step.x * facing, y: step.y };
  const kickX = Math.round(-dir.x * pose.recoil);
  const kickY = Math.round(-dir.y * pose.recoil);
  const s = shoulderOf(pose.frame);
  const shoulder = bodyPoint(s.x, s.y, facing);
  const pivotX = origin.x + shoulder.x;
  const pivotY = origin.y + shoulder.y;
  surface.drawBitmap(
    sprites.get(arm.sprite),
    Math.round(pivotX - arm.pivotX) + kickX,
    Math.round(pivotY - arm.pivotY) + kickY,
  );

  const cap = capSprite(pose.frame, facing, pose.flash);
  surface.drawBitmap(sprites.get(cap.sprite), origin.x + cap.x, origin.y + cap.y);

  const flash = pose.muzzleFlash > 0 ? MUZZLE_FLASH[pose.muzzleFlash - 1] : undefined;
  if (flash) {
    const reach = armReach(art) + 2;
    drawSpriteCentered(
      dc,
      flash,
      pivotX + 0.5 + kickX + dir.x * reach,
      pivotY + 0.5 + kickY + dir.y * reach,
    );
  }
}
