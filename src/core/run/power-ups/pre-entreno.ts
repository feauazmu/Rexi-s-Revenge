import type { RunContext } from '../context';
import { isPowerUpActive } from './active';
import type { TimedPowerUpDef } from './types';

/** Pre-entreno: Enemies and their projectiles slow down while Rexi keeps his normal speed. */
export const preEntreno: TimedPowerUpDef<'pre-entreno'> = { id: 'pre-entreno', kind: 'timed' };

/**
 * Effect hook: the rate Enemy time runs at, as a fraction of normal (1 when inactive). The
 * Enemy step scales the `dt` it hands to behaviors by it, and the projectile step scales Enemy
 * projectiles' flight and lifetime, so every Enemy-side timer slows together.
 */
export function enemyTimeScale(ctx: RunContext): number {
  return isPowerUpActive(ctx.state.rexi, 'pre-entreno')
    ? ctx.tuning.powerUps['pre-entreno'].enemyTimeScale
    : 1;
}
