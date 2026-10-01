import type { WeaponId } from '../../core';
import { palette } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';

/** Mazo Automático: a judge's gavel with brass bands (11×10). */
const MAZO_AUTOMATICO = defineSprite(
  { k: palette.outline, B: '#b0703c', b: '#7a4524', g: '#e8c050', H: '#c89058' },
  [
    '.kkkkkkkkk.',
    'kBgBBBBBgBk',
    'kbgbbbbbgbk',
    'kbgbbbbbgbk',
    '.kkkkkkkkk.',
    '....kHk....',
    '....kHk....',
    '....kHk....',
    '....kHk....',
    '....kkk....',
  ],
);

/** HUD icon of each Weapon. A new Weapon fails to typecheck until it gets an icon here. */
export const weaponIcons: Readonly<Record<WeaponId, SpriteDef>> = {
  'mazo-automatico': MAZO_AUTOMATICO,
};
