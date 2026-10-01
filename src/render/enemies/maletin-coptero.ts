import type { EnemyView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

const ROTOR: Color = '#d8d8e0';

/** Placeholder briefcase body (24×16) with a tiny lawyer in the window; final art: ticket #11. */
const COLORS = {
  k: '#2a1a14',
  m: '#5a5a66',
  B: '#b06a3c',
  b: '#8a4b2a',
  g: '#e8c050',
  w: '#9fd8ff',
  s: '#f0c090',
  t: '#20202a',
  r: ROTOR,
} as const satisfies Record<string, Color>;

const BODY = defineSprite(COLORS, [
  '...........mm...........',
  '...........mm...........',
  '........kkkkkkkk........',
  '........k......k........',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBbbbbbkkkkkkkbbbbbbbbbk',
  'kBbbbbkwwssswwkbbbbbbbbk',
  'kBbbbbkwwtttwwkbbbbbbbbk',
  'kbbbbbkkkkkkkkkbbbbbbbbk',
  'kkkkkkkkkggkkkkkkkkkkkkk',
  'kbbbbbbbbggbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbbbbbbbbbk',
  'kbbbbbbbbbbbbbbbbbbbbbbk',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
]);

export function drawMaletinCoptero(dc: DrawContext, enemy: EnemyView): void {
  const { surface } = dc;
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const cx = x + Math.floor(enemy.w / 2);

  // Two-frame spinning rotor above the mast.
  const wide = Math.floor(enemy.age / 3) % 2 === 0;
  const half = wide ? 12 : 6;
  surface.fillRect(cx - half, y, half * 2, 1, ROTOR);
  surface.fillRect(cx - 1, y + 1, 2, 1, ROTOR);

  surface.drawBitmap(dc.sprites.get(BODY), x, y + enemy.h - BODY.height);
}

/** Chunks it breaks into when destroyed, left to right: rotor, cockpit, lawyer, clasp end. */
export const maletinCopteroDebris = [
  defineSprite(COLORS, ['rrrrrrrrr', '....m....', '....m....']),
  defineSprite(COLORS, [
    'kkkkkkkk',
    'kBBBBBBB',
    'kBbbbkww',
    'kBbbbkws',
    'kbbbbkkk',
    'kbbbbbbb',
    '.kkkkkkk',
  ]),
  defineSprite(COLORS, ['.ttt.', 'tssst', '.sss.', 'kwgwk', '.kgk.', '.k.k.']),
  defineSprite(COLORS, ['BBBBBBBk', 'bbbbbbbk', 'kkggkkkk', 'bbggbbbk', 'bbbbbbbk', 'kkkkkkk.']),
] as const;
