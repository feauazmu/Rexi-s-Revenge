import type { EnemyView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite, mirrorSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

const COLORS = {
  k: '#1a1020', // outline
  R: '#e8323a', // red frame, lit
  r: '#b81c2c', // red frame
  d: '#701424', // red frame, shade
  w: '#ffd0c8', // shine on the jet cowlings
  g: '#c4c8d4', // chrome, lit
  G: '#7e8292', // chrome
  n: '#4a4c58', // dark steel (nozzles, pylon)
  h: '#9aa0b0', // handlebar mounts, barrel glint
  c: '#2a2a34', // handlebar foam
  b: '#26242e', // belt
  B: '#44424e', // belt slats
  s: '#2a0c12', // console screen
  L: '#ff5a3a', // console LED digits
  y: '#f0c040', // buttons and badge
  o: '#ffb030', // intake fan glow
  m: '#2c2c36', // gatling barrels
  M: '#74748a', // gatling barrels, lit
} as const satisfies Record<string, Color>;

/**
 * Facing right: twin jets at the back, the belt deck in the middle, the console with its
 * handlebars at the front and the gatling under the front of the deck. The hitbox spans
 * columns 5-36 and rows 5-18; the gatling muzzle ends at the hitbox front edge, where the core
 * spawns the bullets.
 */
const BODY_RIGHT = defineSprite(COLORS, [
  '.....kkkkkkkkkk........................',
  '....kngGRwwwRRRk..............kkkkkkk..',
  '...knGgGRRRRRRRdk.....kkkkkkkkRRRRRRRk.',
  '...knngGrrrrrrrok....khcccccccRLLsLLrk.',
  '..kknngGrrrrrrrdk.....kkkkkkkkRsssssrk.',
  '.kngGRwwwRRRdddk.............kRyRnRnrk.',
  'knGgGRRRRRRRdkk..k......kkkkkkrrrrrrrk.',
  'knngGrrrrrrrok..kGk....khcccccccrrrkk..',
  'knngGrrrrrrrdkkkGk......kkkkkkkkkGgk...',
  '.knGndddddddkknnnkkkkkkkkkkkkkkkGgk....',
  '..kkkkgggggggggggggggggggggggggGgkk....',
  '.....kbbBbbbBbbbBbbbBbbbBbbbBbbbRRrk...',
  '....kkbBbbbBbbbBbbbBbbbBbbbBbbbbrgrk...',
  '...kRgRRRRRRRRRRRRRRRRRRRRRRRRRRrGrk...',
  '...krGrrrrrrrdydrrrrrrrrrrrrrrrrrrdkk..',
  '....kddddddddddddddddddddddddddddkkkMk.',
  '.....kkkkrkkkkkkkkkkkkrkkRRRRRMMMhMMmk.',
  '........krkkkkkkkkkkkrk.kryrrrmmmnmmmk.',
  '........krrrrrrrrrrrrk..kdddddkkkkkkmk.',
  '.........kkkkkkkkkkkk....kkkkk......k..',
]);
const BODY_LEFT = mirrorSprite(BODY_RIGHT);

/** Where the hitbox sits inside BODY_RIGHT. */
const HITBOX_LEFT = 5;
const HITBOX_TOP = 5;

/** Jet nozzles in BODY_RIGHT: the column just left of each nozzle outline and its center row. */
const NOZZLES = [
  { column: 2, row: 3 },
  { column: -1, row: 7 },
] as const;

/** Gatling barrels in BODY_RIGHT: the columns that spin, the barrel rows and the muzzle tip. */
const BARREL_COLUMNS = [31, 33, 35] as const;
const BARREL_ROW = 16;
const MUZZLE = { column: 37, row: 16 } as const;

const FLAME = {
  W: '#fff8d8',
  Y: '#ffd040',
  O: '#ff8a20',
  E: '#d8341c',
} as const satisfies Record<string, Color>;

/** Afterburner flicker, pointing left (away from a right-facing nose), root on the right. */
const FLAME_FULL_RIGHT = [
  defineSprite(FLAME, ['...EEOOYY', 'EOOYYWWWW', '...EEOOYY']),
  defineSprite(FLAME, ['.....EOYY', '.EEOOYWWW', '....EEOYY']),
  defineSprite(FLAME, ['....EEOYY', '..EOOYWWW', '.....EOOY']),
];
/** Throttled down while it stands still winding up. */
const FLAME_IDLE_RIGHT = [
  defineSprite(FLAME, ['..OY', 'OYWW', '..OY']),
  defineSprite(FLAME, ['...Y', '.OYW', '...O']),
];
const FLAME_FULL = { right: FLAME_FULL_RIGHT, left: FLAME_FULL_RIGHT.map(mirrorSprite) };
const FLAME_IDLE = { right: FLAME_IDLE_RIGHT, left: FLAME_IDLE_RIGHT.map(mirrorSprite) };

/** Muzzle flash, drawn just past the muzzle, and the windup glow at the muzzle tip. */
const MUZZLE_FLASH = defineSprite(FLAME, ['.Y...', '..Y.Y', 'OWWWY', 'YWWWO', '..Y.Y', '.Y...']);
const MUZZLE_FLASH_LEFT = mirrorSprite(MUZZLE_FLASH);
const GLOW: readonly Color[] = [FLAME.O, FLAME.Y, FLAME.W, FLAME.Y];

/** Gentle 1 px engine bob, in ticks per step. */
const BOB = [0, 0, 1, 1] as const;
const BOB_TICKS = 9;
/** Ticks between muzzle flashes while firing (about the burst spacing). */
const FLASH_PERIOD = 5;

/** Entry `n` of a looping animation (wraps around). */
function nth<T>(items: readonly T[], n: number): T {
  const item = items[n % items.length];
  if (item === undefined) throw new Error('Animation needs at least one frame');
  return item;
}

/**
 * Caminadora a Reacción: a red treadmill strapped to twin jet engines, its console and
 * handlebars at the front and a gatling bolted under the deck. Flies nose first (the way the
 * core says it faces), throttles its jets down and lights up its muzzle while winding up, and
 * spins its barrels with a muzzle flash while firing.
 */
export function drawCaminadoraAReaccion(dc: DrawContext, enemy: EnemyView): void {
  const { surface, sprites } = dc;
  const right = enemy.pose.facing !== -1;
  const { attack } = enemy.pose;
  const y = Math.round(enemy.y) - HITBOX_TOP + nth(BOB, Math.floor(enemy.age / BOB_TICKS));
  const left = right
    ? Math.round(enemy.x) - HITBOX_LEFT
    : Math.round(enemy.x) + enemy.w + HITBOX_LEFT - BODY_RIGHT.width;
  /** Screen x of BODY_RIGHT column `c` for the current facing. */
  const column = (c: number) => (right ? left + c : left + BODY_RIGHT.width - 1 - c);

  surface.drawBitmap(sprites.get(right ? BODY_RIGHT : BODY_LEFT), left, y);

  // Afterburners: long and flickering while strafing, short while winding up.
  const flames = attack === 'windup' ? FLAME_IDLE : FLAME_FULL;
  NOZZLES.forEach((nozzle, i) => {
    const flame = nth(flames[right ? 'right' : 'left'], Math.floor(enemy.age / 2) + i);
    const x = right ? column(nozzle.column) - flame.width + 1 : column(nozzle.column);
    surface.drawBitmap(sprites.get(flame), x, y + nozzle.row - 1);
  });

  if (attack === 'idle') return;

  // Barrels spin up: a glint runs across them.
  const spin = Math.floor(enemy.age / (attack === 'firing' ? 1 : 3));
  surface.fillRect(column(nth(BARREL_COLUMNS, spin)), y + BARREL_ROW, 1, 1, COLORS.g);

  const tip = column(MUZZLE.column);
  if (attack === 'windup') {
    const glow = nth(GLOW, Math.floor(enemy.age / 3));
    surface.fillRect(column(MUZZLE.column - 1), y + MUZZLE.row, 1, 2, glow);
    return;
  }
  if (enemy.age % FLASH_PERIOD < 2) {
    const flash = right ? MUZZLE_FLASH : MUZZLE_FLASH_LEFT;
    const x = right ? tip : tip - flash.width + 1;
    surface.drawBitmap(sprites.get(flash), x, y + MUZZLE.row - 2);
  }
}

/** Chunks it breaks into when destroyed: a jet, the console, belt, gatling, handlebar, drum. */
export const caminadoraAReaccionDebris: readonly SpriteDef[] = [
  defineSprite(COLORS, ['.kkkkkkkkk.', 'knGRwwRRRdk', 'nGgRRRRRRok', 'nGgrrrrrrdk', '.kkkkkkkkk.']),
  defineSprite(COLORS, ['kkkkkkk', 'kRRRRRk', 'kRsLsrk', 'kRLsLrk', 'kryrnrk', 'kkkkkkk']),
  defineSprite(COLORS, ['kkkkkkkkk', 'kgggggggk', 'kbBbbbBbk', 'kRRRRRRRk', 'kkkkkkkkk']),
  defineSprite(COLORS, ['kkkkkkkk.', 'kRRMMMhMk', 'kyrmmmnmk', 'kkkkkkkk.']),
  defineSprite(COLORS, ['kkkkkkk', 'hcccccc', 'kkkkkkk']),
  defineSprite(COLORS, ['.kkk.', 'kRRrk', 'krgrk', 'krGrk', '.kkk.']),
];
