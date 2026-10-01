import { POWER_UP_IDS, SPECIAL_WEAPON_IDS, type CrateContents } from '../../ids';
import type { RunContext } from '../context';
import { collectPowerUp } from '../power-ups/system';
import { collectWeapon } from '../weapons/inventory';

/**
 * Crate contents: what can be in a Crate, how likely each is, and what picking it up does.
 * The list is derived from the Weapon and Power-up registries, so a new special Weapon or
 * Power-up becomes Crate content through its id, its weight in `tuning.crates.weights` and
 * its behavior catalog entry, without touching the Crate system.
 */
const ALL_CONTENTS: readonly CrateContents[] = [
  ...SPECIAL_WEAPON_IDS.map((weapon): CrateContents => ({ kind: 'weapon', weapon })),
  ...POWER_UP_IDS.map((powerUp): CrateContents => ({ kind: 'power-up', powerUp })),
];

function weightOf(ctx: RunContext, contents: CrateContents): number {
  const { weights, recesoBoost } = ctx.tuning.crates;
  if (contents.kind === 'weapon') return weights.weapons[contents.weapon];
  const weight = weights.powerUps[contents.powerUp];
  const { health, maxHealth } = ctx.state.rexi;
  const boosted = contents.powerUp === 'receso' && health <= maxHealth * recesoBoost.belowHealth;
  return boosted ? weight * recesoBoost.weightMultiplier : weight;
}

/** Picks the contents of a new Crate, weighted by the tuning catalog (seeded). */
export function rollCrateContents(ctx: RunContext): CrateContents {
  const entries = ALL_CONTENTS.map((c) => [c, weightOf(ctx, c)] as const);
  if (!entries.some(([, weight]) => weight > 0)) {
    throw new Error('No Crate contents has a positive weight in tuning.crates.weights');
  }
  return ctx.rng.weighted(entries);
}

/** Gives Rexi what a picked-up Crate carries. */
export function collectCrateContents(ctx: RunContext, contents: CrateContents): void {
  if (contents.kind === 'weapon') collectWeapon(ctx, contents.weapon);
  else collectPowerUp(ctx, contents.powerUp);
}
