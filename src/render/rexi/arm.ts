import type { Vec2 } from '../../core';
import { ARM_ANGLES } from './art';

/**
 * Rexi's aiming arm in 16 discrete directions. The arm art is pre-rotated by the art pipeline
 * with RotSprite into 9 angles from straight down to straight up (ADR 0002, rule 8); facing left
 * mirrors them, which gives the other 7 directions.
 */

/** Number of discrete aim directions around the full circle. */
export const AIM_DIRECTIONS = 16;
const STEP = (2 * Math.PI) / AIM_DIRECTIONS;
/** Facing right covers steps -4 (straight down) … 4 (straight up); facing left mirrors them. */
export const MAX_AIM_STEP = AIM_DIRECTIONS / 4;

/**
 * The discrete arm step that points at `aim` from `shoulder`, for the given facing: the
 * angle above the horizontal (toward the facing side) rounded to the nearest 22.5°, clamped to
 * straight up/down when the aim is slightly behind the shoulder.
 */
export function aimStep(shoulder: Vec2, aim: Vec2, facing: 1 | -1): number {
  const dx = (aim.x - shoulder.x) * facing;
  const dy = shoulder.y - aim.y;
  if (dx === 0 && dy === 0) return 0;
  let angle = Math.atan2(dy, dx);
  if (angle > Math.PI / 2) angle = Math.PI / 2;
  if (angle < -Math.PI / 2) angle = -Math.PI / 2;
  return Math.max(-MAX_AIM_STEP, Math.min(MAX_AIM_STEP, Math.round(angle / STEP)));
}

/** Screen-space unit vector of an arm step (facing right; mirror x for facing left). */
export function stepDirection(step: number): Vec2 {
  const angle = step * STEP;
  return { x: Math.cos(angle), y: -Math.sin(angle) };
}

/** The index into the pre-rotated arm angles ({@link ARM_ANGLES}) of an arm step. */
export function armAngleIndex(step: number): number {
  const index = ARM_ANGLES.indexOf((step * 360) / AIM_DIRECTIONS);
  if (index < 0) throw new Error(`No pre-rotated arm for step ${step}`);
  return index;
}
