import type { PowerUpId } from '../../core';
import { palette } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';

/** Receso: a paper coffee cup with a red health cross (12×12). */
const RECESO = defineSprite(
  {
    k: palette.outline,
    W: '#f2f2f2',
    w: '#b8c4d0',
    B: '#b0703c',
    S: '#e8d8b0',
    b: '#7a4524',
    R: '#e8433a',
  },
  [
    '.kkkkkkkk...',
    'kWWWWWWWWk..',
    'kwwwwwwwwk..',
    '.kBBBBBBk...',
    '.kBBBBBBk...',
    '.kSSSSSkkk..',
    '.kSbSSSkRk..',
    '.kSSSkkkRkkk',
    '.kBBBkRRRRRk',
    '.kBBBkkkRkkk',
    '..kBBBkkRk..',
    '..kkkkkkkk..',
  ],
);

/** Inmunidad Judicial: a golden shield bearing the scales of justice (11×12). */
const INMUNIDAD_JUDICIAL = defineSprite(
  { k: palette.outline, Y: '#ffd84a', y: '#e8a020', d: '#8a5a10' },
  [
    '.kkkkkkkkk.',
    'kYYYYYYYYyk',
    'kYYYYdYYYyk',
    'kYdddddddyk',
    'kYdYYdYYdyk',
    'kdddYdYdddk',
    'kYYYYdYYYyk',
    '.kYYdddYyk.',
    '.kYYYYYYyk.',
    '..kYYYYyk..',
    '...kYYyk...',
    '....kkk....',
  ],
);

/** Creatina: a supplement tub with an "x3" label (12×12). */
const CREATINA = defineSprite(
  {
    k: palette.outline,
    L: '#3a3a4a',
    l: '#6a6a80',
    W: '#f2f2f2',
    w: '#b8c4d0',
    Y: '#ffd84a',
    r: '#d42a2a',
  },
  [
    '.kkkkkkkkkk.',
    'kLllLLLLLLLk',
    'kLLLLLLLLLLk',
    'kkkkkkkkkkkk',
    'kWWWWWWWWWwk',
    'kYYYYYYYYYYk',
    'kYrYrYrrrYYk',
    'kYYrYYYYrYYk',
    'kYrYrYYrrYYk',
    'kYYYYYYYrYYk',
    'kWWWWWrrrWwk',
    '.kkkkkkkkkk.',
  ],
);

/**
 * HUD icon of each Power-up, also shown on Crates (at most 12×12 to fit a Crate's label).
 * A new Power-up fails to typecheck until it gets an icon here.
 */
export const powerUpIcons: Readonly<Record<PowerUpId, SpriteDef>> = {
  receso: RECESO,
  'inmunidad-judicial': INMUNIDAD_JUDICIAL,
  creatina: CREATINA,
};
