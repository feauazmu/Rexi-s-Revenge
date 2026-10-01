import { clamp } from '../math';
import type { PlatformTuning } from '../tuning';
import type { Body } from './state';

/** The static geometry bodies collide with: the ground floor and one-way platforms. */
export interface World {
  readonly width: number;
  readonly groundY: number;
  readonly gravity: number;
  readonly maxFallSpeed: number;
  readonly platforms: readonly PlatformTuning[];
}

export interface StepOptions {
  /** Fall through the one-way platform the body is standing on (never through the ground). */
  readonly dropThrough?: boolean;
}

/**
 * Advances a body by `dt` seconds: gravity, integration, landing on the ground or on a one-way
 * platform, and staying inside the Arena's horizontal bounds. Velocity is set by the caller.
 *
 * A one-way platform only stops a body whose feet cross its top surface while moving down, so
 * bodies pass up through it from below. The crossing test uses the previous and next feet
 * position, so fast falls never tunnel through.
 */
export function stepBody(
  body: Body,
  world: World,
  dt: number,
  { dropThrough = false }: StepOptions = {},
): void {
  const feetBefore = body.y + body.h;
  // Dropping ignores the platforms the body stands on this tick; once its feet are below
  // their surface, the crossing test ignores them on its own.
  const ignoreUpTo = dropThrough && body.grounded ? feetBefore : -Infinity;

  body.vy = Math.min(body.vy + world.gravity * dt, world.maxFallSpeed);
  body.x = clamp(body.x + body.vx * dt, 0, world.width - body.w);
  body.y += body.vy * dt;

  const feetAfter = body.y + body.h;
  let landingY = feetAfter >= world.groundY ? world.groundY : Infinity;
  if (body.vy >= 0) {
    for (const p of world.platforms) {
      const crossesTop = feetBefore <= p.y && feetAfter >= p.y && p.y > ignoreUpTo;
      const overlapsX = body.x < p.x + p.w && p.x < body.x + body.w;
      if (crossesTop && overlapsX && p.y < landingY) landingY = p.y;
    }
  }

  if (landingY !== Infinity) {
    body.y = landingY - body.h;
    body.vy = 0;
    body.grounded = true;
  } else {
    body.grounded = false;
  }
}
