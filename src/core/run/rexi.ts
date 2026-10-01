import { DT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { InputFrame } from '../input';
import { clamp, directionTo, overlaps, type Vec2 } from '../math';
import type { Tuning } from '../tuning';
import type { RunContext } from './context';
import { stepBody, type World } from './physics';
import type { RexiState } from './state';

/** `shotAge` stops counting here; animation only cares about the first few ticks. */
const SHOT_AGE_CAP = 600;

export function createRexi(tuning: Tuning): RexiState {
  const { rexi, arena } = tuning;
  return {
    x: rexi.spawnX,
    y: arena.groundY - rexi.height,
    w: rexi.width,
    h: rexi.height,
    vx: 0,
    vy: 0,
    grounded: true,
    rising: false,
    facing: 1,
    aim: { x: rexi.spawnX + 100, y: arena.groundY - rexi.height },
    fireCooldown: 0,
    shotAge: SHOT_AGE_CAP,
    hurtTicks: 0,
    weapon: 'mazo-automatico',
  };
}

export function worldOf(tuning: Tuning): World {
  return {
    width: SCREEN_WIDTH,
    groundY: tuning.arena.groundY,
    gravity: tuning.arena.gravity,
    maxFallSpeed: tuning.arena.maxFallSpeed,
  };
}

/** Rexi controller: running, jumping, gravity and aiming from one input frame. */
export function stepRexi(ctx: RunContext, input: InputFrame): void {
  const { rexi } = ctx.state;
  const { tuning } = ctx;

  if (rexi.shotAge < SHOT_AGE_CAP) rexi.shotAge += 1;
  if (rexi.hurtTicks > 0) rexi.hurtTicks -= 1;

  rexi.vx = clamp(input.move, -1, 1) * tuning.rexi.runSpeed;
  if (input.jump && rexi.grounded) {
    rexi.vy = -tuning.rexi.jumpSpeed;
    rexi.grounded = false;
    rexi.rising = true;
  } else if (rexi.rising && (!input.jump || rexi.vy >= 0)) {
    if (rexi.vy < 0) rexi.vy *= tuning.rexi.jumpCutFactor;
    rexi.rising = false;
  }
  stepBody(rexi, worldOf(tuning), DT);

  rexi.aim = input.aim;
  rexi.facing = input.aim.x < rexi.x + rexi.w / 2 ? -1 : 1;
}

/** Pivot of the aiming arm, mirrored with Rexi's facing. */
export function shoulderOf(rexi: Readonly<RexiState>, tuning: Tuning): Vec2 {
  const { shoulderOffsetX, shoulderOffsetY } = tuning.rexi;
  const offsetX = rexi.facing === 1 ? shoulderOffsetX : rexi.w - shoulderOffsetX;
  return { x: rexi.x + offsetX, y: rexi.y + shoulderOffsetY };
}

/** Unit vector from the shoulder toward the aim target. */
export function aimDirectionOf(rexi: Readonly<RexiState>, tuning: Tuning): Vec2 {
  return directionTo(shoulderOf(rexi, tuning), rexi.aim, { x: rexi.facing, y: 0 });
}

/** Where shots leave: the tip of the held Weapon, at arm's reach from the shoulder. */
export function muzzleOf(rexi: Readonly<RexiState>, tuning: Tuning): Vec2 {
  const shoulder = shoulderOf(rexi, tuning);
  const direction = aimDirectionOf(rexi, tuning);
  const reach = tuning.rexi.muzzleReach;
  return { x: shoulder.x + direction.x * reach, y: shoulder.y + direction.y * reach };
}

/**
 * Starts Rexi's hurt reaction unless one is already running. Health, damage and the Run end
 * arrive with the Enemy fire ticket; this is the shared hit entry point for it.
 */
export function hurtRexi(ctx: RunContext): void {
  const { rexi } = ctx.state;
  if (rexi.hurtTicks > 0) return;
  rexi.hurtTicks = Math.max(1, secondsToTicks(ctx.tuning.rexi.hurtDuration));
  ctx.emit({ type: 'rexi-hit' });
}

/** Touching an Enemy's body hurts Rexi. */
export function stepRexiContacts(ctx: RunContext): void {
  const { rexi, enemies } = ctx.state;
  if (enemies.some((enemy) => enemy.health > 0 && overlaps(rexi, enemy))) hurtRexi(ctx);
}
