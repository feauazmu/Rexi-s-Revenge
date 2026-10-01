import type { EnemyView } from '../../core';
import { sprites as art } from '../art/generated/enemies';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { defineSprite, mirroredSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

/**
 * The pipeline sprite, facing right (art/sheets.json `enemy_caminadora`, scripts/art/enemies.py):
 * twin jets at the back, the belt deck in the middle, the console and handlebars at the front and
 * the gatling under the front of the deck.
 */
const BODY_RIGHT = art['caminadora/body'];
const BODY_LEFT = mirroredSprite(BODY_RIGHT);

/** Where the 43×19 hitbox (the deck and engines) sits in BODY_RIGHT. */
const HITBOX = { x: 4, y: 5 } as const;

/** Jet nozzles in BODY_RIGHT: the column just left of each nozzle and its center row. */
const NOZZLES = [
  { column: 3, row: 4 },
  { column: -1, row: 11 },
] as const;

/** Gatling barrels in BODY_RIGHT: the columns a glint runs across, their row and the muzzle. */
const BARREL_COLUMNS = [43, 45, 47] as const;
const BARREL_ROW = 22;
const MUZZLE = { column: 50, row: 23 } as const;

/** Afterburner colors, hottest first (the palette's fire ramp). */
const FLAME = {
  W: P.light,
  Y: P.sunYellow,
  O: P.skyOrange,
  E: P.redLight,
} as const satisfies Record<string, Color>;

/** Afterburner flicker, pointing left (away from a right-facing nose), root on the right. */
const FLAME_FULL_RIGHT = [
  defineSprite(FLAME, ['....EEOOYY', 'EOOOYYWWWW', '....EEOOYY']),
  defineSprite(FLAME, ['......EOYY', '..EEOOYWWW', '.....EEOYY']),
  defineSprite(FLAME, ['.....EEOYY', '...EOOYWWW', '......EOOY']),
];
/** Throttled down while it stands still winding up. */
const FLAME_IDLE_RIGHT = [
  defineSprite(FLAME, ['..OY', 'OYWW', '..OY']),
  defineSprite(FLAME, ['...Y', '.OYW', '...O']),
];
const FLAME_FULL = { right: FLAME_FULL_RIGHT, left: FLAME_FULL_RIGHT.map(mirroredSprite) };
const FLAME_IDLE = { right: FLAME_IDLE_RIGHT, left: FLAME_IDLE_RIGHT.map(mirroredSprite) };

/** Muzzle flash, drawn just past the muzzle, and the windup glow at the muzzle tip. */
const MUZZLE_FLASH = defineSprite(FLAME, ['.Y...', '..Y.Y', 'OWWWY', 'YWWWO', '..Y.Y', '.Y...']);
const GLOW: readonly Color[] = [FLAME.O, FLAME.Y, FLAME.W, FLAME.Y];
const GLINT: Color = P.grey3;

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
  const y = Math.round(enemy.y) - HITBOX.y + nth(BOB, Math.floor(enemy.age / BOB_TICKS));
  const left = right
    ? Math.round(enemy.x) - HITBOX.x
    : Math.round(enemy.x) + enemy.w + HITBOX.x - BODY_RIGHT.width;
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
  surface.fillRect(column(nth(BARREL_COLUMNS, spin)), y + BARREL_ROW, 1, 1, GLINT);

  if (attack === 'windup') {
    const glow = nth(GLOW, Math.floor(enemy.age / 3));
    surface.fillRect(column(MUZZLE.column - 1), y + MUZZLE.row, 1, 2, glow);
    return;
  }
  if (enemy.age % FLASH_PERIOD < 2) {
    const flash = right ? MUZZLE_FLASH : mirroredSprite(MUZZLE_FLASH);
    const tip = column(MUZZLE.column + 1);
    const x = right ? tip : tip - flash.width + 1;
    surface.drawBitmap(sprites.get(flash), x, y + MUZZLE.row - 2);
  }
}

/** Chunks it breaks into when destroyed: a jet, the console, belt, gatling, handlebar, a jet. */
export const caminadoraAReaccionDebris: readonly SpriteDef[] = [
  art['caminadora/debris_0_jet'],
  art['caminadora/debris_1_console'],
  art['caminadora/debris_2_belt'],
  art['caminadora/debris_3_gatling'],
  art['caminadora/debris_4_handlebar'],
  art['caminadora/debris_5_jet'],
];
