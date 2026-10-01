import { POWER_UP_IDS, SPECIAL_WEAPON_IDS, type CrateContents } from '../../ids';
import type { Tuning } from '../../tuning';
import type { RunContext } from '../context';
import { powerUpCatalog } from '../power-ups/index';
import type { PowerUpDef } from '../power-ups/types';
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

function weightOf(tuning: Tuning, contents: CrateContents): number {
  const { weights } = tuning.crates;
  return contents.kind === 'weapon'
    ? weights.weapons[contents.weapon]
    : weights.powerUps[contents.powerUp];
}

/** Picks the contents of a new Crate, weighted by the tuning catalog (seeded). */
export function rollCrateContents(ctx: RunContext): CrateContents {
  const entries = ALL_CONTENTS.map((c) => [c, weightOf(ctx.tuning, c)] as const);
  if (!entries.some(([, weight]) => weight > 0)) {
    throw new Error('No Crate contents has a positive weight in tuning.crates.weights');
  }
  return ctx.rng.weighted(entries);
}

/** Gives Rexi what a picked-up Crate carries. */
export function collectCrateContents(ctx: RunContext, contents: CrateContents): void {
  if (contents.kind === 'weapon') {
    collectWeapon(ctx, contents.weapon);
    return;
  }
  // Typed explicitly: while POWER_UP_IDS is empty the lookup's type is `never`.
  const powerUp: PowerUpDef = powerUpCatalog[contents.powerUp];
  powerUp.collect(ctx);
}
