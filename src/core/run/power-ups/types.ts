import type { PowerUpId } from '../../ids';
import type { RunContext } from '../context';

/**
 * Behavior of one Power-up. Numbers (duration, strength) live in the tuning catalog; its
 * Crate weight lives in `tuning.crates.weights.powerUps`. The Crate system calls `collect`
 * when Rexi picks up a Crate carrying it.
 */
export interface PowerUpDef {
  readonly id: PowerUpId;
  collect(ctx: RunContext): void;
}
