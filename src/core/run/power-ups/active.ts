import type { TimedPowerUpId } from '../../tuning';
import type { ActivePowerUpView } from '../../view';
import type { RexiState } from '../state';

/**
 * Queries on Rexi's active timed Power-ups. Effect hooks (in each Power-up's file) build on
 * `isPowerUpActive`; kept apart from ./system so hooks never import the catalog.
 */

export function isPowerUpActive(rexi: Readonly<RexiState>, id: TimedPowerUpId): boolean {
  return rexi.powerUps.has(id);
}

/** Active timed Power-ups in pickup order (the HUD timers). */
export function viewPowerUps(rexi: Readonly<RexiState>): ActivePowerUpView[] {
  return [...rexi.powerUps].map(([id, { ticksLeft, totalTicks }]) => ({
    id,
    ticksLeft,
    totalTicks,
  }));
}
