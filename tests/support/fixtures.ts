/** Reusable tuning overrides for staging test scenarios. */
import type { TuningOverrides } from '../../src/core';

/**
 * `tuning` plus Enemies that hover where they were placed instead of drifting around the
 * Arena, for scenarios that aim at fixed points. Enemies that drift add their kind here.
 */
export function holdStill(tuning: TuningOverrides = {}): TuningOverrides {
  return {
    ...tuning,
    enemies: {
      ...tuning.enemies,
      'maletin-coptero': { driftSpeed: 0, ...tuning.enemies?.['maletin-coptero'] },
      'banca-artillada': { driftSpeed: 0, ...tuning.enemies?.['banca-artillada'] },
    },
  };
}
