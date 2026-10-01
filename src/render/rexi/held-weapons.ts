import type { WeaponId } from '../../core';
import type { ArmArt } from './art';

/**
 * How each Weapon looks in Rexi's fist: the aiming-arm art that holds it, pre-rotated by the art
 * pipeline (`WEAPONS` in `scripts/art/characters/rexi.py`). A `Record<WeaponId, …>`, so a new
 * Weapon fails to typecheck until its held look is drawn and exported.
 */
export const heldWeapons: Readonly<Record<WeaponId, ArmArt>> = {
  'mazo-automatico': 'mazo-automatico',
  'lluvia-de-sellos': 'lluvia-de-sellos',
  'citaciones-teledirigidas': 'citaciones-teledirigidas',
  'sentencia-firme': 'sentencia-firme',
  mancuernas: 'mancuernas',
  'codigo-penal': 'codigo-penal',
};
