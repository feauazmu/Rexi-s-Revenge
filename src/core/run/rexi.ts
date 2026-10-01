import { DT, SCREEN_WIDTH } from '../constants';
import type { InputFrame } from '../input';
import { clamp, directionTo, type Vec2 } from '../math';
import type { Tuning } from '../tuning';
import type { RunContext } from './context';
import { stepBody, type World } from './physics';
import type { RexiState } from './state';
import { createInventory } from './weapons/inventory';

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
    health: rexi.maxHealth,
    maxHealth: rexi.maxHealth,
    facing: 1,
    aim: { x: rexi.spawnX + 100, y: arena.groundY - rexi.height },
    inventory: createInventory(),
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

/** Where shots leave Rexi's arm, mirrored with his facing. */
export function muzzleOf(rexi: Readonly<RexiState>, tuning: Tuning): Vec2 {
  const offsetX =
    rexi.facing === 1 ? tuning.rexi.muzzleOffsetX : rexi.w - tuning.rexi.muzzleOffsetX;
  return { x: rexi.x + offsetX, y: rexi.y + tuning.rexi.muzzleOffsetY };
}

export function aimDirectionOf(rexi: Readonly<RexiState>, tuning: Tuning): Vec2 {
  return directionTo(muzzleOf(rexi, tuning), rexi.aim, { x: rexi.facing, y: 0 });
}
