import type { PowerUpId } from '../../ids';
import type { TimedPowerUpId } from '../../tuning';
import type { RunContext } from '../context';

/** A Power-up applied once, on pickup (Receso). */
export interface InstantPowerUpDef<Id extends PowerUpId = Exclude<PowerUpId, TimedPowerUpId>> {
  readonly id: Id;
  readonly kind: 'instant';
  apply(ctx: RunContext): void;
}

/**
 * A Power-up that lasts `tuning.powerUps[id].duration` seconds. The Power-up system owns the
 * timer, the `power-up-started`/`power-up-ended` events and the HUD view; the effect itself
 * lives in the subsystem it changes, which asks through a hook exported by the Power-up's own
 * file (e.g. `rexiDamageMultiplier` in ./creatina, read by the Enemy damage rule).
 */
export interface TimedPowerUpDef<Id extends TimedPowerUpId = TimedPowerUpId> {
  readonly id: Id;
  readonly kind: 'timed';
}

export type PowerUpDef = InstantPowerUpDef<PowerUpId> | TimedPowerUpDef;

/**
 * The definition a Power-up id needs: timed exactly when its tuning has a `duration`, so a
 * catalog entry of the wrong kind fails to typecheck.
 */
export type PowerUpDefFor<Id extends PowerUpId> = Id extends TimedPowerUpId
  ? TimedPowerUpDef<Id>
  : InstantPowerUpDef<Id>;
