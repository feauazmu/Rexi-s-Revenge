import { DT, SCREEN_WIDTH, secondsToTicks } from '../../constants';
import type { CrateContents } from '../../ids';
import { overlaps } from '../../math';
import type { Tuning } from '../../tuning';
import type { CrateView } from '../../view';
import type { RunContext } from '../context';
import { stepBody, type World } from '../physics';
import { worldOf } from '../rexi';
import type { CrateState } from '../state';
import { collectCrateContents, rollCrateContents } from './contents';

/**
 * Crates: automatic drops on a seeded timer, parachute fall, landing (on whatever stops
 * bodies in the Arena), a lifetime that starts on landing, expiry and pickup on touch.
 * What a Crate carries is decided and delivered by ./contents.
 */

/** Drops a Crate with its left edge at `x`; `y` defaults to just above the top of the screen. */
export function spawnCrate(
  ctx: RunContext,
  contents: CrateContents,
  x: number,
  y?: number,
): CrateState {
  const { size, fallSpeed } = ctx.tuning.crates;
  const crate: CrateState = {
    id: ctx.nextId(),
    contents,
    x,
    y: y ?? -size,
    w: size,
    h: size,
    vx: 0,
    vy: fallSpeed,
    grounded: false,
    ttl: null,
    age: 0,
  };
  ctx.state.crates.push(crate);
  ctx.emit({ type: 'crate-spawned', crateId: crate.id, contents, x });
  return crate;
}

/** Run tick of the first automatic drop. */
export function firstCrateDrop(tuning: Tuning): number {
  return secondsToTicks(tuning.crates.firstDrop);
}

export function stepCrates(ctx: RunContext): void {
  dropOnSchedule(ctx);

  const { state, tuning } = ctx;
  // A parachute: Crates fall like any body but never faster than the parachute speed.
  const world: World = { ...worldOf(tuning), maxFallSpeed: tuning.crates.fallSpeed };
  state.crates = state.crates.filter((crate) => {
    crate.age += 1;
    stepBody(crate, world, DT);

    if (overlaps(crate, state.rexi)) {
      ctx.emit({ type: 'crate-picked', crateId: crate.id, contents: crate.contents });
      collectCrateContents(ctx, crate.contents);
      return false;
    }
    if (crate.ttl === null) {
      if (crate.grounded) {
        crate.ttl = secondsToTicks(tuning.crates.lifetime);
        ctx.emit({ type: 'crate-landed', crateId: crate.id });
      }
      return true;
    }
    crate.ttl -= 1;
    if (crate.ttl > 0) return true;
    ctx.emit({ type: 'crate-expired', crateId: crate.id });
    return false;
  });
}

function dropOnSchedule(ctx: RunContext): void {
  const { state, tuning, rng } = ctx;
  if (state.nextCrateDrop === null || state.tick < state.nextCrateDrop) return;

  const { size, spawnMargin, dropInterval, dropIntervalJitter } = tuning.crates;
  const contents = rollCrateContents(ctx);
  const x = Math.round(rng.range(spawnMargin, SCREEN_WIDTH - spawnMargin - size));
  spawnCrate(ctx, contents, x);
  const interval = dropInterval + rng.range(-dropIntervalJitter, dropIntervalJitter);
  state.nextCrateDrop = state.tick + Math.max(1, secondsToTicks(interval));
}

export function viewCrate(crate: Readonly<CrateState>, tuning: Tuning): CrateView {
  return {
    id: crate.id,
    contents: crate.contents,
    x: crate.x,
    y: crate.y,
    w: crate.w,
    h: crate.h,
    landed: crate.ttl !== null,
    ticksLeft: crate.ttl,
    blinking: crate.ttl !== null && crate.ttl <= secondsToTicks(tuning.crates.blinkTime),
    age: crate.age,
  };
}
