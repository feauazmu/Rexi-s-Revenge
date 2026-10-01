import { DT } from '../../constants';
import type { InputFrame } from '../../input';
import type { RunContext } from '../context';
import { isPowerUpActive } from './active';
import type { TimedPowerUpDef } from './types';

/** Día de Pierna: jetpack-like flight while jump is held. */
export const diaDePierna: TimedPowerUpDef<'dia-de-pierna'> = {
  id: 'dia-de-pierna',
  kind: 'timed',
};

/**
 * Effect hook for Rexi's controller, called just before his body steps (which adds gravity):
 * while Día de Pierna is active and jump is held, thrust pushes him up until he climbs at
 * `riseSpeed`. A jump's faster kick is left alone and eases down to it under gravity. Returns
 * whether Rexi is flying this tick.
 */
export function applyFlightThrust(ctx: RunContext, input: Readonly<InputFrame>): boolean {
  const { rexi } = ctx.state;
  if (!input.jump || !isPowerUpActive(rexi, 'dia-de-pierna')) return false;
  const { thrust, riseSpeed } = ctx.tuning.powerUps['dia-de-pierna'];
  // The body step adds a tick of gravity after this, landing exactly on -riseSpeed.
  const fastest = -riseSpeed - ctx.tuning.arena.gravity * DT;
  if (rexi.vy > fastest) rexi.vy = Math.max(rexi.vy - thrust * DT, fastest);
  return true;
}

/**
 * Effect hook for Rexi's controller, called after his body steps: keeps a flight from carrying
 * him past the top of the Arena (he hovers there while jump is held).
 */
export function stopAtFlightCeiling(ctx: RunContext): void {
  const { rexi } = ctx.state;
  const { ceiling } = ctx.tuning.powerUps['dia-de-pierna'];
  if (rexi.y >= ceiling) return;
  rexi.y = ceiling;
  rexi.vy = Math.max(rexi.vy, 0);
}
