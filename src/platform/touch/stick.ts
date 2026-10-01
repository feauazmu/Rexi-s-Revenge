/**
 * Twin-stick math, pure: finger positions in game coordinates in, stick vectors and input
 * values out. Sticks float: each appears where its finger lands (see `followFinger`).
 */
import type { Vec2 } from '../../core';

export interface StickConfig {
  /** Finger travel from the origin to full deflection, game px. */
  readonly radius: number;
  /** Share of the radius (0..1) around the origin that reads as centered. */
  readonly deadZone: number;
}

const ZERO: Vec2 = { x: 0, y: 0 };

/**
 * The stick vector for a finger at `point` on a stick based at `origin`: same direction as
 * the finger, length 0..1. The dead zone is radial, and the length is rescaled from its edge,
 * so output grows smoothly from 0 instead of jumping to the dead-zone value.
 */
export function readStick(origin: Vec2, point: Vec2, config: StickConfig): Vec2 {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  const dead = config.deadZone * config.radius;
  if (distance <= dead) return ZERO;
  const length = Math.min(1, (distance - dead) / (config.radius - dead));
  return { x: (dx / distance) * length, y: (dy / distance) * length };
}

/**
 * Where a floating stick's base is after its finger moves to `point`: unchanged while the
 * finger stays within `radius`, otherwise dragged along so the finger sits on the rim. The
 * thumb never "falls off" the stick, and reversing direction responds immediately.
 */
export function followFinger(origin: Vec2, point: Vec2, radius: number): Vec2 {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return origin;
  const k = radius / distance;
  return { x: point.x - dx * k, y: point.y - dy * k };
}

/** Stick deflection (0..1) at which movement reaches full speed. */
export const MOVE_SATURATION = 0.6;

/** Horizontal movement (-1..1) from the move stick: analog, full speed from 60% deflection. */
export function stickToMove(stick: Vec2): number {
  return Math.max(-1, Math.min(1, stick.x / MOVE_SATURATION));
}

/** Downward deflection (0..1) past which the move stick drops through platforms. */
export const DROP_THRESHOLD = 0.6;

/**
 * Drop through one-way platforms (the keyboard's S/↓): the move stick pulled down past
 * {@link DROP_THRESHOLD} and within 45° of straight down. Running sideways, even with some
 * downward slant, never drops by accident.
 */
export function wantsDrop(stick: Vec2): boolean {
  return stick.y >= DROP_THRESHOLD && stick.y >= Math.abs(stick.x);
}

/** The aim point `distance` px from `shoulder` along `direction` (only its angle matters). */
export function aimTarget(shoulder: Vec2, direction: Vec2, distance: number): Vec2 {
  const length = Math.hypot(direction.x, direction.y);
  if (length === 0) return shoulder;
  return {
    x: shoulder.x + (direction.x / length) * distance,
    y: shoulder.y + (direction.y / length) * distance,
  };
}
