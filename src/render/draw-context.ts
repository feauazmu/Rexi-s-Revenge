import type { GameView } from '../core';
import type { SpriteBank, SpriteDef } from './sprite';
import type { Surface } from './surface';

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
