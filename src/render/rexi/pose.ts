import { TICKS_PER_SECOND, type RexiView } from '../../core';
import { aimStep } from './arm';
import { REXI_ANIMS as anims, type BodyFrame } from './art';

/**
 * Picks Rexi's animation frame from his view and the Run tick (never a clock). Pure, so the
 * same view always gives the same pose. The animation table (frames, fps) is the art pipeline's
 * (`ANIMS` in `scripts/art/characters/rexi.py`); this maps game state onto it.
 */
export interface RexiPose {
  readonly frame: BodyFrame;
  /** Discrete arm direction, see `aimStep`. */
  readonly armStep: number;
  /** Pixels the arm is pulled back along the aim by the last shot's kick. */
  readonly recoil: number;
  /** Muzzle flash size right after a shot: 0 (none), 1 (small) or 2 (big). */
  readonly muzzleFlash: number;
  /** Hurt/invulnerability blink: draw this frame in the flash colors. */
  readonly flash: boolean;
}

/** Ticks each frame of an animation is shown. */
function frameTicks(fps: number): number {
  return TICKS_PER_SECOND / fps;
}

/** The frame of a looping animation at `tick`. */
function looped(frames: readonly BodyFrame[], fps: number, tick: number): BodyFrame {
  const i = Math.floor(tick / frameTicks(fps)) % frames.length;
  return frames[i] ?? frames[0] ?? 'rest';
}

/**
 * The frame of a one-shot animation with `left` ticks to go, counted from its end (the view
 * knows how long a reaction has left, not how long it lasts). Holds the first frame before that.
 */
function fromEnd(frames: readonly BodyFrame[], fps: number, left: number): BodyFrame {
  const fromLast = Math.min(frames.length - 1, Math.floor((left - 1) / frameTicks(fps)));
  return frames[frames.length - 1 - fromLast] ?? 'rest';
}

/** Vertical speed below which an airborne Rexi is at the apex of his jump, px/s. */
const APEX_SPEED = 60;

function bodyFrame(rexi: RexiView, tick: number): BodyFrame {
  if (rexi.hurtTicks > 0) {
    // The hurt frames read the same backwards (hurt_0, hurt_1, hurt_1, hurt_0).
    const { frames, fps } = anims.hurt;
    return fromEnd(frames, fps, rexi.hurtTicks);
  }
  const [rise, apex, fall, land] = anims.jump.frames;
  if (!rexi.grounded) {
    // Flying on Día de Pierna's jets keeps the knees tucked (the flames fire from the soles).
    if (rexi.flying) return apex;
    if (rexi.vy < -APEX_SPEED) return rise;
    if (rexi.vy > APEX_SPEED) return fall;
    return apex;
  }
  // The landing squat, for one frame of the jump's timing.
  if (rexi.landedTicks < frameTicks(anims.jump.fps) / 2) return land;
  if (Math.abs(rexi.vx) > 1) {
    // Backpedaling (moving away from the aim side) plays the cycle in reverse.
    const run = Math.sign(rexi.vx) === rexi.facing ? anims.run : anims['run-back'];
    return looped(run.frames, run.fps, tick);
  }
  return looped(anims.idle.frames, anims.idle.fps, tick);
}

/** Rexi's pose for this frame. `tick` is the Run tick (frozen while paused). */
export function rexiPose(rexi: RexiView, tick: number): RexiPose {
  // Red blink through the hurt reaction and the invulnerability window after a hit.
  const blinkTicks = Math.max(rexi.hurtTicks, rexi.invulnerableTicks);
  // The shot: recoil and muzzle flash per frame of the shoot animation, which lasts one
  // Mazo Automático fire interval.
  const { recoil, flash, fps } = anims.shoot;
  const shotFrame = Math.floor(rexi.shotAge / frameTicks(fps));
  return {
    frame: bodyFrame(rexi, tick),
    armStep: aimStep(rexi.shoulder, rexi.aim, rexi.facing),
    recoil: recoil[shotFrame] ?? 0,
    muzzleFlash: flash[shotFrame] ?? 0,
    flash: blinkTicks > 0 && Math.floor(blinkTicks / 3) % 2 === 1,
  };
}
