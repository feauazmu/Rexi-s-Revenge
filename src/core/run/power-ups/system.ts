import { secondsToTicks } from '../../constants';
import type { PowerUpId } from '../../ids';
import type { TimedPowerUpId } from '../../tuning';
import type { RunContext } from '../context';
import { powerUpCatalog } from './index';
import type { PowerUpDef } from './types';

/**
 * The Power-up system: delivers a collected Power-up and runs the timers of timed ones.
 * A timed Power-up collected during Run tick T is active for the rest of tick T and the next
 * `duration − 1` ticks; picking it up again while active restarts it at full duration.
 */

/** Gives Rexi a Power-up (called by the Crate system on pickup). */
export function collectPowerUp(ctx: RunContext, id: PowerUpId): void {
  const def: PowerUpDef = powerUpCatalog[id];
  if (def.kind === 'instant') def.apply(ctx);
  else startTimed(ctx, def.id);
}

function startTimed(ctx: RunContext, id: TimedPowerUpId): void {
  const { powerUps } = ctx.state.rexi;
  const ticks = Math.max(1, secondsToTicks(ctx.tuning.powerUps[id].duration));
  const refreshed = powerUps.has(id);
  powerUps.set(id, { ticksLeft: ticks, totalTicks: ticks });
  ctx.emit({ type: 'power-up-started', powerUp: id, ticks, refreshed });
}

/** Counts every active timed Power-up down one tick and ends the ones that run out. */
export function stepPowerUps(ctx: RunContext): void {
  const { powerUps } = ctx.state.rexi;
  for (const [id, active] of powerUps) {
    active.ticksLeft -= 1;
    if (active.ticksLeft > 0) continue;
    powerUps.delete(id);
    ctx.emit({ type: 'power-up-ended', powerUp: id });
  }
}
