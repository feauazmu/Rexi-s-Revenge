import type { ProjectileView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color } from '../surface';
import { projectileArt } from './art';

/**
 * A drawer yanked out of a filing cabinet, stuffed with files, a fuse curling out of its top
 * right corner. The box is the left 14 columns; the fuse tip is its top right pixel.
 */
const DRAWER = projectileArt.drawer;

/** Fuse spark: a flickering ember with hot sparks around the fuse tip. */
const SPARK_CORE: Color = P.light;
const SPARK_HOT: Color = P.gold;
const SPARK_EMBER: Color = P.skyOrange;

/** Offset of the drawer box center from the sprite's top-left. */
const BOX_CENTER_X = 7;
const BOX_CENTER_Y = 9;
/** Fuse tip, in sprite coordinates. */
const FUSE_TIP = { x: DRAWER.width - 1, y: 0 } as const;

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
