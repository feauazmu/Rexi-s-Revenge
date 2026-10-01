import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';
import type { Color } from '../surface';

/** Steel and brass shared with the Archivador Artillado, so the bomb reads as one of its drawers. */
export const DRAWER_COLORS = {
  k: '#1c2026', // outline
  H: '#c9d2da', // steel, highlight
  L: '#a3afba', // steel, lit
  m: '#7f8c99', // steel
  d: '#5b6774', // steel, shade
  D: '#353d47', // drawer interior
  g: '#e2b264', // brass label frame and handle
  G: '#9c6c36', // brass, shade
  c: '#f4e8c8', // index card
  w: '#ffffff', // paper
  l: '#9aa4bc', // paper, lines
  f: '#5a3a22', // fuse
} as const satisfies Record<string, Color>;

/**
 * A drawer yanked out of a filing cabinet, stuffed with files, a lit fuse curling out of its
 * back corner. 12×11: the box with its files is the left 10 columns.
 */
const DRAWER = defineSprite(DRAWER_COLORS, [
  '.kk.kkkk..f.',
  'kwwkwwwwkf..',
  'kwlwwlwwkf..',
  'kDDDDDDDDk..',
  'kHHHHHHHHk..',
  'kLmggggmdk..',
  'kLmgccgmdk..',
  'kLmggggmdk..',
  'kLmmmmmmdk..',
  'kLmGggGmdk..',
  '.kkkkkkkk...',
]);

/** Fuse spark: a flickering ember with hot sparks around the fuse tip. */
const SPARK_CORE: Color = '#fff6c0';
const SPARK_HOT: Color = '#ffb020';
const SPARK_EMBER: Color = '#ff5a1a';

/** Offset of the sprite's top-left from the drawer box center. */
const BOX_CENTER_X = 5;
const BOX_CENTER_Y = 6.5;
/** Fuse tip, in sprite coordinates. */
const FUSE_TIP = { x: 10, y: 0 } as const;

/**
 * Draws a drawer bomb with its box centered at (cx, cy). `age` (ticks) animates the fuse spark.
 * Also used by the Archivador Artillado while it lowers the drawer out of its bomb bay.
 */
export function drawDrawerBomb(dc: DrawContext, cx: number, cy: number, age: number): void {
  const left = Math.round(cx - BOX_CENTER_X);
  const top = Math.round(cy - BOX_CENTER_Y);
  dc.surface.drawBitmap(dc.sprites.get(DRAWER), left, top);

  const tipX = left + FUSE_TIP.x;
  const tipY = top + FUSE_TIP.y;
  const frame = Math.floor(age / 2) % 4;
  const { surface } = dc;
  surface.fillRect(tipX, tipY - 1, 1, 1, frame % 2 === 0 ? SPARK_CORE : SPARK_HOT);
  // Sparks pop out around the tip in a rotating pattern.
  const sparks = [
    [-1, -2],
    [1, -2],
    [1, -1],
    [-1, -1],
  ] as const;
  const [ax, ay] = sparks[frame] ?? sparks[0];
  surface.fillRect(tipX + ax, tipY + ay, 1, 1, SPARK_HOT);
  const [bx, by] = sparks[(frame + 2) % 4] ?? sparks[0];
  if (frame % 2 === 1) surface.fillRect(tipX + bx * 2, tipY + by - 1, 1, 1, SPARK_EMBER);
}

export function drawDrawer(dc: DrawContext, projectile: ProjectileView): void {
  drawDrawerBomb(
    dc,
    projectile.x + projectile.w / 2,
    projectile.y + projectile.h / 2,
    projectile.age,
  );
}
