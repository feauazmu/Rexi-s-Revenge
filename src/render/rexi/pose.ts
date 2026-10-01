import type { RexiView } from '../../core';
import { aimStep } from './arm';
import { LEG_FRAMES, type BackArmFrame, type BodyPose } from './body';

/**
 * Picks Rexi's animation frame from his view and the Run tick (never a clock). Pure, so the
 * same view always gives the same pose.
 */
export interface RexiPose {
  readonly body: BodyPose;
  /** Discrete arm direction, see `aimStep`. */
  readonly armStep: number;
  /** Pixels the arm is pulled back along the aim by the last shot's kick. */
  readonly recoil: number;
  /** Muzzle flash size right after a shot: 0 (none), 1 (small) or 2 (big). */
  readonly muzzleFlash: number;
  /** Hurt/invulnerability blink: draw this frame in the flash colors. */
  readonly flash: boolean;
}

/** Ticks per frame of the six-frame run cycle (a full stride in 24 ticks ≈ 64 px at run speed). */
export const RUN_FRAME_TICKS = 4;
/** Length of one idle breath, ticks. */
export const BREATH_TICKS = 72;
/** Vertical speed below which an airborne Rexi is at the apex of his jump, px/s. */
const APEX_SPEED = 45;

const RUN_BOB = [0, 1, -1, 0, 1, -1] as const;
const RUN_SWING: readonly BackArmFrame[] = ['forward', 'forward', 'hang', 'back', 'back', 'hang'];

const still = { upperX: 0, upperY: 0, headX: 0, headY: 0 } as const;

function idlePose(tick: number): BodyPose {
  // Inhale for the middle half of the breath; the head trails the chest by a few ticks.
  const phase = tick % BREATH_TICKS;
  const inhaleStart = BREATH_TICKS / 4;
  const inhaleEnd = (BREATH_TICKS * 3) / 4;
  const upperY = phase >= inhaleStart && phase < inhaleEnd ? -1 : 0;
  let headY = 0;
  if (phase >= inhaleStart && phase < inhaleStart + 4) headY = 1;
  if (phase >= inhaleEnd && phase < inhaleEnd + 4) headY = -1;
  return {
    legs: LEG_FRAMES.stand,
    robe: 'stand',
    backArm: 'hang',
    hurt: false,
    ...still,
    upperY,
    headY,
  };
}

function runPose(rexi: RexiView, tick: number): BodyPose {
  let frame = Math.floor(tick / RUN_FRAME_TICKS) % LEG_FRAMES.run.length;
  // Backpedaling (moving away from the aim side) plays the cycle in reverse.
  if (Math.sign(rexi.vx) !== rexi.facing) frame = LEG_FRAMES.run.length - 1 - frame;
  return {
    legs: LEG_FRAMES.run[frame] ?? LEG_FRAMES.stand,
    robe: frame % 2 === 0 ? 'runA' : 'runB',
    backArm: RUN_SWING[frame] ?? 'hang',
    hurt: false,
    ...still,
    upperY: RUN_BOB[frame] ?? 0,
  };
}

function airPose(rexi: RexiView): BodyPose {
  // Flying on Día de Pierna's jets keeps the knees tucked (the flames fire from the soles).
  if (rexi.vy < -APEX_SPEED || rexi.flying) {
    return { legs: LEG_FRAMES.jump, robe: 'jump', backArm: 'back', hurt: false, ...still };
  }
  if (rexi.vy > APEX_SPEED) {
    return {
      legs: LEG_FRAMES.fall,
      robe: 'fall',
      backArm: 'flung',
      hurt: false,
      ...still,
      headY: -1,
    };
  }
  return { legs: LEG_FRAMES.jump, robe: 'stand', backArm: 'back', hurt: false, ...still };
}

/** Rexi's pose for this frame. `tick` is the Run tick (frozen while paused). */
export function rexiPose(rexi: RexiView, tick: number): RexiPose {
  let body: BodyPose;
  if (!rexi.grounded) body = airPose(rexi);
  else if (Math.abs(rexi.vx) > 1) body = runPose(rexi, tick);
  else body = idlePose(tick);

  const hurt = rexi.hurtTicks > 0;
  if (hurt) {
    // Recoil from the hit: lean back, head thrown back, far arm flung out.
    body = { ...body, hurt: true, backArm: 'flung', upperX: -1, headX: -1, headY: -1 };
  }

  // Red blink through the hurt reaction and the invulnerability window after a hit.
  const blinkTicks = Math.max(rexi.hurtTicks, rexi.invulnerableTicks);
  const age = rexi.shotAge;
  return {
    body,
    armStep: aimStep(rexi.shoulder, rexi.aim, rexi.facing),
    recoil: age < 2 ? 2 : age < 4 ? 1 : 0,
    muzzleFlash: age < 2 ? 2 : age < 3 ? 1 : 0,
    flash: blinkTicks > 0 && Math.floor(blinkTicks / 3) % 2 === 1,
  };
}
