import type { RunContext } from '../context';
import { isPowerUpActive } from './active';
import type { TimedPowerUpDef } from './types';

/** Creatina: multiplies the damage of every hit Rexi lands while it lasts. */
export const creatina: TimedPowerUpDef<'creatina'> = { id: 'creatina', kind: 'timed' };

/**
 * Effect hook, read by the Enemy damage rule (`damageEnemy`) when a hit lands, so it covers
 * every Weapon, splash included.
 */
export function rexiDamageMultiplier(ctx: RunContext): number {
  return isPowerUpActive(ctx.state.rexi, 'creatina')
    ? ctx.tuning.powerUps.creatina.damageMultiplier
    : 1;
}
