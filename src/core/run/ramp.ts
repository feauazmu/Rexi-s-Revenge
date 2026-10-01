/**
 * The ramp clock and the current fire rate. Kept apart from the Director so Enemy behaviors
 * can read the current fire rate without depending on spawning. The ramp table lookup itself
 * (`rampAt`) is pure and lives with the table in `tuning/director.ts`.
 */
import { TICKS_PER_SECOND } from '../constants';
import { rampAt } from '../tuning';
import type { RunContext } from './context';
import type { RunState } from './state';

/**
 * Advances the ramp clock by one tick. Called once per simulated Run tick, so whatever
 * freezes the simulation (pause, Hit-stop) leaves the ramp where it was.
 */
export function advanceRampClock(state: RunState): void {
  state.rampTicks += 1;
}

/** Seconds of ramp clock elapsed in this Run. */
export function rampSeconds(ctx: RunContext): number {
  return ctx.state.rampTicks / TICKS_PER_SECOND;
}

/** Current multiplier on Enemy fire rates: Enemies run their attack cooldowns this much faster. */
export function enemyFireRate(ctx: RunContext): number {
  return rampAt(ctx.tuning.director, rampSeconds(ctx)).fireRate;
}
