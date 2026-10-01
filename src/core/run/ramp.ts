/**
 * The ramp clock and the ramp table lookup. Kept apart from the Director so Enemy behaviors
 * can read the current fire rate without depending on spawning.
 */
import { TICKS_PER_SECOND } from '../constants';
import type { DirectorTuning, RampStage } from '../tuning';
import type { RunContext } from './context';
import type { RunState } from './state';

/** The ramp's values at one moment of the ramp clock. */
export type RampValues = Omit<RampStage, 'from'>;

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

/** Looks up the ramp table at `seconds` of ramp clock, including growth past the last stage. */
export function rampAt(director: DirectorTuning, seconds: number): RampValues {
  const { stages, growth } = director;
  let stage = stages[0];
  if (!stage) throw new Error('The ramp table needs at least one stage');
  for (const candidate of stages) if (candidate.from <= seconds) stage = candidate;

  const last = stages[stages.length - 1] ?? stage;
  const steps =
    stage === last && growth.every > 0 ? Math.floor((seconds - last.from) / growth.every) : 0;
  if (steps <= 0) return stage;
  return {
    onScreenCap: Math.min(
      Math.max(stage.onScreenCap, growth.onScreenCapMax),
      stage.onScreenCap + steps * growth.onScreenCap,
    ),
    spawnInterval: Math.max(
      Math.min(stage.spawnInterval, growth.spawnIntervalMin),
      stage.spawnInterval + steps * growth.spawnInterval,
    ),
    fireRate: Math.min(
      Math.max(stage.fireRate, growth.fireRateMax),
      stage.fireRate + steps * growth.fireRate,
    ),
  };
}

/** Current multiplier on Enemy fire rates: Enemies run their attack cooldowns this much faster. */
export function enemyFireRate(ctx: RunContext): number {
  return rampAt(ctx.tuning.director, rampSeconds(ctx)).fireRate;
}
