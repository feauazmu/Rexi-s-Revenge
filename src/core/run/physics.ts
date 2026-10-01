import { clamp } from '../math';
import type { Body } from './state';

/** The static geometry bodies collide with. Platforms arrive with the Arena ticket. */
export interface World {
  readonly width: number;
  readonly groundY: number;
  readonly gravity: number;
  readonly maxFallSpeed: number;
}

/**
 * Advances a body by `dt` seconds: gravity, integration, landing on the ground and staying
 * inside the Arena's horizontal bounds. Velocity is set by the caller beforehand.
 */
export function stepBody(body: Body, world: World, dt: number): void {
  body.vy = Math.min(body.vy + world.gravity * dt, world.maxFallSpeed);
  body.x = clamp(body.x + body.vx * dt, 0, world.width - body.w);
  body.y += body.vy * dt;

  const floor = world.groundY - body.h;
  if (body.y >= floor) {
    body.y = floor;
    body.vy = 0;
    body.grounded = true;
  } else {
    body.grounded = false;
  }
}
