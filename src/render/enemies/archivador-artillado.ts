import type { EnemyView } from '../../core';
import type { DrawContext } from '../draw-context';
import { DRAWER_COLORS, drawDrawerBomb } from '../projectiles/drawer';
import { defineSprite, mirrorSprite } from '../sprite';
import type { Color } from '../surface';

const COLORS = {
  ...DRAWER_COLORS,
  W: '#7a8591', // wing gunmetal, lit
  v: '#535c67', // wing gunmetal
  V: '#2e343c', // wing underside, muzzles
  o: '#d4502e', // wing tip paint
  O: '#8c2c1a', // wing tip paint, shade
  r: '#dde4ea', // rivets
} as const satisfies Record<string, Color>;

/** Flames out of the thrusters: outer, inner, core. */
const FLAME_OUTER: Color = '#ff7a1a';
const FLAME_INNER: Color = '#ffd23a';
const FLAME_CORE: Color = '#fffbe0';
/** Status lamp on the cabinet top: dim while cruising, blinking while arming a drop. */
const LAMP_IDLE: Color = '#b4462a';
const LAMP_ARMED: Color = '#ff3b2f';
const LAMP_FLASH: Color = '#ffe0d0';

/**
 * The cabinet in a slight three-quarter view: the front (exactly the 20×26 hitbox) with three
 * drawers, brass label frames and handles and a lamp; the lit top above it and the shaded
 * riveted side to its right.
 */
const CABINET = defineSprite(COLORS, [
  '...kkkkkkkkkkkkkkkkkkkk',
  '..kHHHHHHHHHHHHHHHHHHLk',
  '.kHHHHHHHHHHHHHHHHHHLdk',
  'kkkkkkkkkkkkkkkkkkkkddk',
  'kLLLLLLLLLLLLLLLL.LkrDk',
  'kLddddddddddddddddDkdDk',
  'kDDDDDDDDDDDDDDDDDDkdDk',
  ...drawerFace(),
  ...drawerFace(),
  // The side panel's bottom edge recedes up and to the right.
  ...drawerFace().map((row, i) => (i < 5 ? row : row.slice(0, 20) + (i === 5 ? 'dk.' : 'k..'))),
  '.kkkkkkkkkkkkkkkkkk....',
]);
/** Rows of the top face above the hitbox. */
const CABINET_TOP = 3;

/** One 7-row drawer face of the cabinet, with the side panel beside it. */
function drawerFace(): string[] {
  return [
    'kLHHHHHHHHHHHHHHHdDkdDk',
    'kLHmmmmggggggmmmmdDkdDk',
    'kLHmmmmgccccgmmmmdDkrDk',
    'kLHmmmmggggggmmmmdDkdDk',
    'kLHmmmmmmmmmmmmmmdDkdDk',
    'kLHmmmmmGggGmmmmmdDkdDk',
    'kLdddddddddddddddDDkdDk',
  ];
}

/**
 * Left wing with its quad-gun pod, drawn from the cabinet's side outward. Its right column
 * tucks under the cabinet outline.
 */
const WING_LEFT = defineSprite(COLORS, [
  '........kkkk',
  '.....kkkWWWk',
  '..kkkWWWvvvk',
  'kooWWvvvvvvk',
  'kOOvvvvVVVVk',
  '.kkkkkkkkkkk',
  '......kvvvk.',
  '.....kVvVvk.',
  '.....kvvvvk.',
  '.....kVvVvk.',
  '......kkkk..',
]);
const WING_RIGHT = mirrorSprite(WING_LEFT);
/** Where the wings attach: rows below the cabinet top, and how far they reach out. */
const WING_TOP = 9;
const WING_REACH = WING_LEFT.width - 1;
/** The right wing attaches to the side panel, this far right of the hitbox. */
const SIDE_DEPTH = 2;

/** A thruster bell under the cabinet. */
const THRUSTER = defineSprite(COLORS, ['kkkkk', 'kdLdk', '.kmk.']);
/** Left edges of the thrusters, relative to the hitbox. */
const THRUSTER_XS = [1, 14] as const;

/** The bomb bay hatch between the thrusters, closed. */
const HATCH = defineSprite(COLORS, ['kDDDDk', '.kkkk.']);
const HATCH_X = 7;

/** How far the drawer travels out of the bomb bay during the windup, px. */
const DRAWER_TRAVEL = 10;

/**
 * Archivador Artillado: a steel filing cabinet on jet thrusters, stubby wings with gun pods
 * and a bomb bay underneath. Before each drop the lamp blinks and a lit drawer slides down out
 * of the bay, then falls as the drawer bomb.
 */
export function drawArchivadorArtillado(dc: DrawContext, enemy: EnemyView): void {
  const { surface, sprites } = dc;
  const x = Math.round(enemy.x);
  const y = Math.round(enemy.y);
  const bottom = y + enemy.h;
  const winding = enemy.pose.attack === 'windup';

  // Thruster flames: flickering cones (3 frames), offset per side so they do not pulse together.
  THRUSTER_XS.forEach((tx, side) => {
    const frame = (Math.floor(enemy.age / 2) + side) % 3;
    const length = [6, 8, 7][frame] ?? 6;
    const fx = x + tx + 1;
    const fy = bottom + 3;
    surface.fillRect(fx, fy, 3, length - 2, FLAME_OUTER);
    surface.fillRect(fx + 1, fy + length - 2, 1, 2, FLAME_OUTER);
    surface.fillRect(fx + 1, fy, 1, length - 3, FLAME_INNER);
    surface.fillRect(fx + 1, fy, 1, 1, FLAME_CORE);
  });

  // The armed drawer slides down out of the bay, behind the cabinet.
  if (winding) {
    const cx = x + enemy.w / 2;
    const cy = bottom + 5 - Math.round((1 - enemy.pose.windup) * DRAWER_TRAVEL);
    drawDrawerBomb(dc, cx, cy, enemy.age);
  }

  surface.drawBitmap(sprites.get(WING_LEFT), x - WING_REACH, y + WING_TOP);
  surface.drawBitmap(sprites.get(WING_RIGHT), x + enemy.w - 1 + SIDE_DEPTH, y + WING_TOP);
  for (const tx of THRUSTER_XS) surface.drawBitmap(sprites.get(THRUSTER), x + tx, bottom);
  surface.drawBitmap(sprites.get(CABINET), x, y - CABINET_TOP);

  if (winding) {
    // Bay doors swung open on both sides of the drawer.
    surface.fillRect(x + HATCH_X, bottom, 1, 3, COLORS.k);
    surface.fillRect(x + HATCH_X + 5, bottom, 1, 3, COLORS.k);
  } else {
    surface.drawBitmap(sprites.get(HATCH), x + HATCH_X, bottom);
  }

  const lamp = winding
    ? Math.floor(enemy.age / 3) % 2 === 0
      ? LAMP_FLASH
      : LAMP_ARMED
    : LAMP_IDLE;
  surface.fillRect(x + 17, y + 1, 1, 1, lamp);
}

/** Chunks it breaks into when destroyed: a drawer, a wing, a thruster, a corner, a file. */
export const archivadorArtilladoDebris = [
  defineSprite(COLORS, [
    'kkkkkkkkkk',
    'kHHHHHHHHk',
    'kHmggggmdk',
    'kHmgccgmdk',
    'kHmGggGmdk',
    'kddddddddk',
    'kkkkkkkkkk',
  ]),
  defineSprite(COLORS, ['....kkkk', '.kkkWWWk', 'kooWvvvk', 'kOOvVVVk', '.kkkkkkk']),
  defineSprite(COLORS, ['kkkkk', 'kdLdk', '.kmk.']),
  defineSprite(COLORS, ['.kkkkk', 'kHHHHk', 'kHrLLk', 'kLdddk', 'kLHHHk', 'kkkkkk']),
  defineSprite(COLORS, ['wwwwk', 'wllwk', 'wwwwk', 'wllwk', 'kkkkk']),
] as const;
