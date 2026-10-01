import type { WeaponId } from '../../core';
import { sprites } from '../art/generated/icons';
import type { SpriteDef } from '../sprite';

/** Side of every Weapon and Power-up icon, px (pipeline art, `art/sprites/icons/`). */
export const ICON_SIZE = 16;

/**
 * HUD icon of each Weapon, also shown on Crates. A new Weapon fails to typecheck until it gets
 * an icon here (drawn through the art pipeline: `scripts/art/ui/icons.py`).
 */
export const weaponIcons: Readonly<Record<WeaponId, SpriteDef>> = {
  'mazo-automatico': sprites['mazo-automatico'],
  'lluvia-de-sellos': sprites['lluvia-de-sellos'],
  'citaciones-teledirigidas': sprites['citaciones-teledirigidas'],
  'sentencia-firme': sprites['sentencia-firme'],
  mancuernas: sprites.mancuernas,
  'codigo-penal': sprites['codigo-penal'],
};
