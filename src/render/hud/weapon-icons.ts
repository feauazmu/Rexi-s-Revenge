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

/** Lluvia de Sellos: a red rubber stamp on a blue ink pad (11×12). */
const LLUVIA_DE_SELLOS = defineSprite(
  { k: palette.outline, R: '#ff7a64', r: '#d42a2a', d: '#8a1a1a', B: '#3a4ec0' },
  [
    '...kkkkk...',
    '..kRRrrrk..',
    '..kRrrrdk..',
    '...krrdk...',
    '....krk....',
    '....krk....',
    '.kkkkkkkkk.',
    'kRRrrrrrrrk',
    'krrrrrrrrdk',
    'kkkkkkkkkkk',
    'kBBBBBBBBBk',
    '.kkkkkkkkk.',
  ],
);

/**
 * HUD icon of each Weapon, also shown on Crates (at most 12×12 to fit a Crate's label).
 * A new Weapon fails to typecheck until it gets an icon here.
 */
export const weaponIcons: Readonly<Record<WeaponId, SpriteDef>> = {
  'mazo-automatico': MAZO_AUTOMATICO,
  'lluvia-de-sellos': LLUVIA_DE_SELLOS,
};
