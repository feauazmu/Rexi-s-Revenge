import { healRexi } from '../rexi';
import type { InstantPowerUpDef } from './types';

/** Receso: restores a tuned share of max health at once. */
export const receso: InstantPowerUpDef = {
  id: 'receso',
  kind: 'instant',
  apply(ctx) {
    const { rexi } = ctx.state;
    healRexi(ctx, Math.round(rexi.maxHealth * ctx.tuning.powerUps.receso.healShare));
  },
};
