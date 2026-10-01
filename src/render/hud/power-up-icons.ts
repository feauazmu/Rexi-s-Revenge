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

/** Pre-entreno: a blue-lidded shaker of orange pre-workout, with a gold stopwatch (12×12). */
const PRE_ENTRENO = defineSprite(
  {
    k: palette.outline,
    B: '#3a78d8',
    b: '#244e9c',
    W: '#f2f2f2',
    w: '#b8c4d0',
    O: '#f08a3c',
    o: '#c0602a',
    C: '#ffe070',
  },
  [
    '..kkk...kkk.',
    '.kBBBk.kCkCk',
    'kBBBBBkkCkkk',
    'kbbbbbkkCCCk',
    'kWwwwWk.kkk.',
    'kWOOOwk.....',
    'kOOOOOk.....',
    'kOoOOOk.....',
    'kOOOOOk.....',
    'kOOOOok.....',
    'kWWWWwk.....',
    '.kkkkk......',
  ],
);

/** Día de Pierna: a muscular leg with a jet nozzle on the thigh, firing (12×12). */
const DIA_DE_PIERNA = defineSprite(
  {
    k: palette.outline,
    G: '#9a9aaa',
    g: '#5a5a6a',
    S: '#e8a888',
    s: '#b87060',
    Y: '#ffd84a',
    R: '#f06a2a',
  },
  [
    '.kkk.kkkkk..',
    'kGGkkSSSSSk.',
    'kGgkSSSSSSSk',
    'kGgkSSsssSSk',
    'kggk.kkkkSSk',
    '.kk.....kSSk',
    '.kYk....kSsk',
    'kYRYk...kSsk',
    'kRYRk...kSSk',
    '.kRk...kSSSk',
    '..k...kSSSSk',
    '......kkkkk.',
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
  'pre-entreno': PRE_ENTRENO,
  'dia-de-pierna': DIA_DE_PIERNA,
};
