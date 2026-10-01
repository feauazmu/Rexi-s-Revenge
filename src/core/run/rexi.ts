import { DT, SCREEN_WIDTH, secondsToTicks } from '../constants';
import type { InputFrame } from '../input';
import { clamp, directionTo, type Vec2 } from '../math';
import type { Tuning } from '../tuning';
import type { RunContext } from './context';
import { stepBody, type World } from './physics';
import { applyFlightThrust, stopAtFlightCeiling } from './power-ups/dia-de-pierna';
import { hasInmunidadJudicial } from './power-ups/inmunidad-judicial';
import type { RexiState } from './state';
import { createInventory } from './weapons/inventory';

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
    flying: false,
    health: rexi.maxHealth,
    maxHealth: rexi.maxHealth,
    facing: 1,
    aim: { x: rexi.spawnX + 133, y: arena.groundY - rexi.height },
    shotAge: SHOT_AGE_CAP,
    invulnerableTicks: 0,
    hurtTicks: 0,
    inventory: createInventory(),
    powerUps: new Map(),
  };
}

export function worldOf(tuning: Tuning): World {
  return {
    width: SCREEN_WIDTH,
    groundY: tuning.arena.groundY,
    gravity: tuning.arena.gravity,
    maxFallSpeed: tuning.arena.maxFallSpeed,
    platforms: tuning.arena.platforms,
  };
}

/**
 * Rexi controller: running, jumping, gravity and aiming from one input frame, plus Día de
 * Pierna's flight while jump is held.
 */
export function stepRexi(ctx: RunContext, input: InputFrame): void {
  const { rexi } = ctx.state;
  const { tuning } = ctx;

  if (rexi.invulnerableTicks > 0) rexi.invulnerableTicks -= 1;
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
  rexi.flying = applyFlightThrust(ctx, input);
  stepBody(rexi, worldOf(tuning), DT, { dropThrough: input.drop });
  stopAtFlightCeiling(ctx);

  rexi.aim = input.aim;
  rexi.facing = input.aim.x < rexi.x + rexi.w / 2 ? -1 : 1;
}

/**
 * Whether an Enemy projectile touching Rexi now would hurt him: not after defeat, during the
 * invulnerability window after a hit, or while Inmunidad Judicial blocks all damage.
 */
export function canHurtRexi(rexi: Readonly<RexiState>): boolean {
  return rexi.health > 0 && rexi.invulnerableTicks === 0 && !hasInmunidadJudicial(rexi);
}

/** Restores up to `amount` health, never above max health (Receso). */
export function healRexi(ctx: RunContext, amount: number): void {
  const { rexi } = ctx.state;
  const health = Math.min(rexi.maxHealth, rexi.health + amount);
  ctx.emit({ type: 'rexi-healed', amount: health - rexi.health, health });
  rexi.health = health;
}

/**
 * Applies an Enemy hit: health, the hurt reaction and the invulnerability window. Callers check
 * `canHurtRexi` first. The Run notices zero health and ends itself at the end of the tick.
 */
export function damageRexi(ctx: RunContext, damage: number): void {
  const { rexi } = ctx.state;
  rexi.health = Math.max(0, rexi.health - damage);
  rexi.invulnerableTicks = secondsToTicks(ctx.tuning.rexi.invulnerability);
  rexi.hurtTicks = secondsToTicks(ctx.tuning.rexi.hurtDuration);
  ctx.emit({ type: 'rexi-hit', damage, health: rexi.health });
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
