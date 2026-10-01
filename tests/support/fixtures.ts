/** Reusable tuning overrides for staging test scenarios. */
import type { TuningOverrides } from '../../src/core';

/**
 * `tuning` plus Enemies that hover where they were placed instead of drifting or patrolling
 * around the Arena, for scenarios that aim at fixed points. Enemies that drift add their kind here.
 */
export function holdStill(tuning: TuningOverrides = {}): TuningOverrides {
  return {
    ...tuning,
    enemies: {
      ...tuning.enemies,
      'maletin-coptero': { driftSpeed: 0, ...tuning.enemies?.['maletin-coptero'] },
      'archivador-artillado': { patrolSpeed: 0, ...tuning.enemies?.['archivador-artillado'] },
    },
  };
}
