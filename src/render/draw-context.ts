import type { GameView } from '../core';
import { silhouetteSprite, type SpriteBank, type SpriteDef } from './sprite';
import type { Color, Surface } from './surface';

/** What every draw function receives. Animation phase comes from `view.tick`, never a clock. */
export interface DrawContext {
  readonly surface: Surface;
  readonly sprites: SpriteBank;
  readonly view: GameView;
}

/** Draws a sprite with its center at (cx, cy), snapped to whole pixels. */
export function drawSpriteCentered(
  dc: DrawContext,
  sprite: SpriteDef,
  cx: number,
  cy: number,
): void {
  dc.surface.drawBitmap(
    dc.sprites.get(sprite),
    Math.round(cx - sprite.width / 2),
    Math.round(cy - sprite.height / 2),
  );
}

/** The same context drawn shifted by whole pixels (screen shake). */
export function translatedContext(dc: DrawContext, dx: number, dy: number): DrawContext {
  if (dx === 0 && dy === 0) return dc;
  const { surface } = dc;
  return {
    ...dc,
    surface: {
      fillRect: (x, y, w, h, color) => {
        surface.fillRect(x + dx, y + dy, w, h, color);
      },
      drawBitmap: (bitmap, x, y) => {
        surface.drawBitmap(bitmap, x + dx, y + dy);
      },
    },
  };
}

/**
 * A context in which everything is drawn as a solid silhouette of `color`: rectangles take the
 * color and sprites become silhouettes. Wrapping any drawer with it gives a hit flash for free.
 */
export function silhouetteContext(dc: DrawContext, color: Color): DrawContext {
  const { surface, sprites } = dc;
  return {
    ...dc,
    surface: {
      fillRect: (x, y, w, h) => {
        surface.fillRect(x, y, w, h, color);
      },
      drawBitmap: (bitmap, x, y) => {
        surface.drawBitmap(bitmap, x, y);
      },
    },
    sprites: { get: (sprite) => sprites.get(silhouetteSprite(sprite, color)) },
  };
}
