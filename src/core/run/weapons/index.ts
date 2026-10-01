import type { WeaponId } from '../../ids';
import { lluviaDeSellos } from './lluvia-de-sellos';
import { mazoAutomatico } from './mazo-automatico';
import type { WeaponDef } from './types';

/** Weapon behavior catalog: one file per Weapon, one line per entry here. */
export const weaponCatalog: Readonly<Record<WeaponId, WeaponDef>> = {
  'mazo-automatico': mazoAutomatico,
  'lluvia-de-sellos': lluviaDeSellos,
};
