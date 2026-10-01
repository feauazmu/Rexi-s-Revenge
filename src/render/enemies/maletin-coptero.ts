import type { EnemyView, RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite, mirrorSprite } from '../sprite';
import type { Color } from '../surface';

/** Rotor blur and the darker blade sweeping through it. */
const BLUR: Color = '#f4d27a';
const BLADE: Color = '#c8902c';

const COLORS = {
  k: '#2a1a14', // outline
  B: '#c27a40', // leather, lit
  b: '#9a5530', // leather
  d: '#6a3418', // leather, shade and stitching
  g: '#f0c040', // brass clasps and rotor hub
  G: '#a87820', // brass, shade
  w: '#8fcdf2', // cockpit glass
  W: '#e8f8ff', // glass glint, shirt
  t: '#1a1a24', // the lawyer's slicked hair and eye
  s: '#f0c090', // skin
  u: '#2a3458', // suit
  r: '#d02828', // tie
  m: '#6a6a78', // metal
  M: '#34343e', // gun barrel
  o: BLUR,
} as const satisfies Record<string, Color>;

/**
 * Facing left: the gun under the cockpit nose sticks out 2 px left of the hitbox and the
 * tail boom 8 px right of it. Drawn one row below the hitbox top, under the main rotor.
 */
const BODY_LEFT = defineSprite(COLORS, [
  '.................gg...............',
  '.................mm...............',
  '...............kkkkkk.............',
  '..............kBBBBBBk............',
  '......kkkkk...kbk..kbk............',
  '....kkttttwkkkkkkkkkkkkkkkkk......',
  '...kWtttttwkBBBBBBBBBBBBBBBk......',
  '..kWwstsstwkbdbdbdbdbdbdbdbk......',
  '..kWwsssstwkbbbbbbbbbbbbbbbkkkkk..',
  '..kwwuWruuwkddgdddddddddgddkBBBk..',
  '..kwuuuruuwkbbgbbbbbbbbbgbbkdddk..',
  '...kkkkkkkkkbbGbbkkkkkbbGbbkkkkk..',
  '..kBBBBBBBBkbbbbbkdddkbbbbbk......',
  '..kbbbbbbbbkbbbbbbbbbbbbbbbk......',
  'mMMMMkdddddkdddddddddddddddk......',
  '.mmmmkkkkkkkkkkkkkkkkkkkkkkk......',
]);
const BODY_RIGHT = mirrorSprite(BODY_LEFT);

/** How far the sprite sticks out left of the hitbox when facing left. */
const OVERHANG_LEFT = 2;
/** Column of the left mast pixel and of the tail rotor, in BODY_LEFT. */
const MAST_X = 17;
const TAIL_ROTOR_X = 32;
const ROTOR_HALF_WIDTH = 13;

/**
 * Maletín-cóptero: a leather briefcase with a glass cockpit, a tiny slick-haired lawyer pilot,
 * brass clasps, a tail boom and a paper gun under the nose. It always faces Rexi.
 */
export function drawMaletinCoptero(dc: DrawContext, enemy: EnemyView, run: RunView): void {
  const { surface, sprites } = dc;
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const facingLeft = run.rexi.x + run.rexi.w / 2 < enemy.x + enemy.w / 2;
  const sprite = facingLeft ? BODY_LEFT : BODY_RIGHT;
  const left = facingLeft ? x - OVERHANG_LEFT : x + enemy.w + OVERHANG_LEFT - sprite.width;
  /** Sprite column `c` of the left-facing art, in screen space for the current facing. */
  const column = (c: number) => (facingLeft ? left + c : left + sprite.width - 1 - c);

  // Main rotor: a flat blur disc with a blade sweeping across it (3 frames).
  const mast = facingLeft ? column(MAST_X) : column(MAST_X + 1);
  const frame = Math.floor(enemy.age / 2) % 3;
  surface.fillRect(mast - ROTOR_HALF_WIDTH, y, ROTOR_HALF_WIDTH * 2 + 2, 1, BLUR);
  const bladeX = mast - ROTOR_HALF_WIDTH + frame * 9;
  surface.fillRect(bladeX, y, 10, 1, BLADE);

  surface.drawBitmap(sprites.get(sprite), left, y + 1);

  // Tail rotor: a vertical blur with a blade sweeping down it, around a brass hub.
  const tail = column(TAIL_ROTOR_X);
  const top = y + 5;
  surface.fillRect(tail, top, 1, 9, BLUR);
  surface.fillRect(tail, top + frame * 3, 1, 3, BLADE);
  surface.fillRect(tail, top + 4, 1, 1, COLORS.g);
}

/** Chunks it breaks into when destroyed: rotor, cockpit, lawyer, clasp end. */
export const maletinCopteroDebris = [
  defineSprite(COLORS, ['ooooooooo', '....g....', '....m....']),
  defineSprite(COLORS, [
    '..kkkkk.',
    '.kWwwwwk',
    'kWwwwwwk',
    'kwwwwwwk',
    'kkkkkkkk',
    'kBBBBBBk',
    '.kkkkkk.',
  ]),
  defineSprite(COLORS, ['.ttt.', 'tssst', '.sts.', 'uWruu', '.uru.', '.k.k.']),
  defineSprite(COLORS, ['BBBBBBBk', 'bbbbbbbk', 'ddgdddkk', 'bbgbbbbk', 'bbGbbbbk', 'kkkkkkk.']),
] as const;
