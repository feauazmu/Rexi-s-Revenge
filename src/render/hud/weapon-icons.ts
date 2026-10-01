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

/** Citaciones Teledirigidas: a manila envelope locked on by a red target reticle (12×12). */
const CITACIONES_TELEDIRIGIDAS = defineSprite(
  { k: palette.outline, p: '#f0dcb0', f: '#b89464', r: '#e02828', w: '#ffffff' },
  [
    'kkkkkkkkkk..',
    'kfppppppfk..',
    'kpffppffpk..',
    'kpppffpppk..',
    'kppppppppk..',
    'kppppppppk..',
    'kppppprrrk..',
    'kppppr.r.rk.',
    'kkkkkrrwrrk.',
    '.....r.r.rk.',
    '......rrrk..',
    '.......kk...',
  ],
);

/** Sentencia Firme: a rolled-out sentence firing a golden beam (12×12). */
const SENTENCIA_FIRME = defineSprite(
  {
    k: palette.outline,
    W: '#ffffff',
    Y: '#ffe066',
    o: '#ffa030',
    P: '#f4e4bc',
    p: '#c9ae7c',
    l: '#8a6a44',
  },
  [
    '........kkk.',
    '.......kWYok',
    '......kWYok.',
    '.....kWYok..',
    '....kWYok...',
    '...kWYok....',
    '.kkkkkkkkk..',
    'kpPPPPPPPpk.',
    'kpPllllPPpk.',
    'kpPPPPPPPpk.',
    'kpPlllPPPpk.',
    '.kkkkkkkkk..',
  ],
);

/**
 * HUD icon of each Weapon, also shown on Crates (at most 12×12 to fit a Crate's label).
 * A new Weapon fails to typecheck until it gets an icon here.
 */
export const weaponIcons: Readonly<Record<WeaponId, SpriteDef>> = {
  'mazo-automatico': MAZO_AUTOMATICO,
  'lluvia-de-sellos': LLUVIA_DE_SELLOS,
  'citaciones-teledirigidas': CITACIONES_TELEDIRIGIDAS,
  'sentencia-firme': SENTENCIA_FIRME,
};
