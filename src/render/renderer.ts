import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView, type RunView } from '../core';
import type { DrawContext } from './draw-context';
import { drawEnemies } from './enemies';
import { drawHud } from './hud/hud';
import { drawArena } from './layers/arena';
import { drawCrates } from './layers/crates';
import { drawCrosshair } from './layers/crosshair';
import { drawRexi } from './layers/rexi';
import { palette } from './palette';
import { drawProjectiles } from './projectiles';
import { createSpriteBank } from './sprite';
import type { BitmapFactory, Surface } from './surface';

export type RunLayer = (dc: DrawContext, run: RunView) => void;

/** Run layers, back to front. New layers (Crates, effects, Dialogue Box) slot in here. */
const RUN_LAYERS: readonly RunLayer[] = [
  drawArena,
  drawCrates,
  drawEnemies,
  drawProjectiles,
  drawRexi,
  drawHud,
  drawCrosshair,
];

export interface Renderer {
  /** Draws one complete 480×270 frame of `view`. Pure: same view, same pixels. */
  render(surface: Surface, view: GameView): void;
}

/** Creates a renderer; sprites are rasterized through `createBitmap` once, on first use. */
export function createRenderer(createBitmap: BitmapFactory): Renderer {
  const sprites = createSpriteBank(createBitmap);
  return {
    render(surface, view) {
      surface.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, palette.letterbox);
      const dc: DrawContext = { surface, sprites, view };
      if (view.run) {
        const run = view.run;
        for (const layer of RUN_LAYERS) layer(dc, run);
      }
    },
  };
}
