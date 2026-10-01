import type { EnemyView } from '../../core';
import { sprites as art } from '../art/generated/enemies';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { drawDrawerBomb } from '../projectiles/drawer';
import type { SpriteDef } from '../sprite';
import type { Color, Surface } from '../surface';

/**
 * The pipeline sprite (art/sheets.json `enemy_archivador`, scripts/art/enemies.py): the cabinet
 * seen from the front with its shaded right side, stub wings with gun pods and two thrusters.
 * It is symmetric enough to need no facing. The bomb-bay hatch is cut out into HATCH.
 */
const BODY = art['archivador/body'];
const HATCH = art['archivador/hatch'];

/** Where the 27×35 hitbox (the cabinet's front face) sits in BODY. */
const HITBOX = { x: 16, y: 4 } as const;
/** The hatch's top-left in BODY. */
const HATCH_AT = { x: 25, y: 39 } as const;
/** Thruster bells: the center column of each and the row their flames start on. */
const THRUSTERS = [20, 38] as const;
const FLAME_ROW = 41;
/** The status lamp, 2×2, on the cabinet's top front corner. */
const LAMP = { x: 37, y: 7 } as const;

/** Thruster flames, outer to core (the palette's fire ramp). */
const FLAME_OUTER: Color = P.skyOrange;
const FLAME_INNER: Color = P.sunYellow;
const FLAME_CORE: Color = P.white;
/** Status lamp: dim while cruising, blinking while arming a drop. */
const LAMP_IDLE: Color = P.red2;
const LAMP_ARMED: Color = P.redLight;
const LAMP_FLASH: Color = P.light;
/** The open bomb bay and its swung-open doors. */
const BAY: Color = P.night;
const DOOR: Color = P.grey1;

/** How far the drawer travels out of the bomb bay during the windup, px. */
const DRAWER_TRAVEL = 13;

/**
 * Archivador Artillado: a riveted steel filing cabinet on jet thrusters, stubby wings with gun
 * pods and a bomb bay underneath. Before each drop the lamp blinks, the bay doors swing open and
 * the lit drawer slides down out of it, then falls as the drawer bomb.
 */
export function drawArchivadorArtillado(dc: DrawContext, enemy: EnemyView): void {
  const { surface, sprites } = dc;
  const left = Math.round(enemy.x) - HITBOX.x;
  const top = Math.round(enemy.y) - HITBOX.y;
  const winding = enemy.pose.attack === 'windup';

  // Thruster flames: flickering cones (3 frames), offset per side so they do not pulse together.
  THRUSTERS.forEach((cx, side) => {
    const frame = (Math.floor(enemy.age / 2) + side) % 3;
    drawFlame(surface, left + cx, top + FLAME_ROW, [9, 12, 10][frame] ?? 9);
  });

  // The armed drawer slides down out of the bay, behind the cabinet.
  if (winding) {
    const cx = left + HITBOX.x + enemy.w / 2;
    const cy = top + HATCH_AT.y + 8 - Math.round((1 - enemy.pose.windup) * DRAWER_TRAVEL);
    drawDrawerBomb(dc, cx, cy, enemy.age);
  }

  surface.drawBitmap(sprites.get(BODY), left, top);

  const hatchX = left + HATCH_AT.x;
  const hatchY = top + HATCH_AT.y;
  if (winding) {
    // The bay's dark mouth above the drawer, and the doors swung down on either side.
    surface.fillRect(hatchX + 1, hatchY - 1, HATCH.width - 2, 1, BAY);
    for (const x of [hatchX, hatchX + HATCH.width - 1]) {
      surface.fillRect(x, hatchY, 1, 5, P.outline);
      surface.fillRect(x + (x === hatchX ? 1 : -1), hatchY, 1, 4, DOOR);
    }
  } else {
    surface.drawBitmap(sprites.get(HATCH), hatchX, hatchY);
  }

  const lamp = winding
    ? Math.floor(enemy.age / 3) % 2 === 0
      ? LAMP_FLASH
      : LAMP_ARMED
    : LAMP_IDLE;
  surface.fillRect(left + LAMP.x, top + LAMP.y, 2, 2, lamp);
  surface.fillRect(left + LAMP.x, top + LAMP.y, 1, 1, winding ? LAMP_FLASH : LAMP_ARMED);
}

/** A thruster flame `length` px long hanging from (cx, y): 5 wide at the bell, tapering. */
function drawFlame(surface: Surface, cx: number, y: number, length: number): void {
  surface.fillRect(cx - 2, y, 5, Math.round(length * 0.4), FLAME_OUTER);
  surface.fillRect(cx - 1, y, 3, length - 2, FLAME_OUTER);
  surface.fillRect(cx, y, 1, length, FLAME_OUTER);
  surface.fillRect(cx - 1, y, 3, Math.round(length * 0.35), FLAME_INNER);
  surface.fillRect(cx, y, 1, Math.round(length * 0.6), FLAME_INNER);
  surface.fillRect(cx, y, 1, 2, FLAME_CORE);
}

/** Chunks it breaks into when destroyed: a drawer, a wing, a thruster, a corner, a gun pod. */
export const archivadorArtilladoDebris: readonly SpriteDef[] = [
  art['archivador/debris_0_drawer'],
  art['archivador/debris_1_wing'],
  art['archivador/debris_2_thruster'],
  art['archivador/debris_3_corner'],
  art['archivador/debris_4_pod'],
];
