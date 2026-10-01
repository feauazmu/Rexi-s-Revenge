import type { PowerUpId } from '../../core';
import { sprites } from '../art/generated/icons';
import type { SpriteDef } from '../sprite';

/**
 * HUD icon of each Power-up, also shown on Crates (16×16, like the Weapon icons). A new Power-up
 * fails to typecheck until it gets an icon here (drawn through the art pipeline:
 * `scripts/art/ui/icons.py`).
 */
export const powerUpIcons: Readonly<Record<PowerUpId, SpriteDef>> = {
  receso: sprites.receso,
  'inmunidad-judicial': sprites['inmunidad-judicial'],
  creatina: sprites.creatina,
  'pre-entreno': sprites['pre-entreno'],
  'dia-de-pierna': sprites['dia-de-pierna'],
};
