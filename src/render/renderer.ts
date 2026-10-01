import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView, type RunView, type ScreenKind } from '../core';
import type { DrawContext } from './draw-context';
import { drawEnemies } from './enemies';
import { drawHud } from './hud/hud';
import { drawArena } from './layers/arena';
import { drawCrosshair } from './layers/crosshair';
import { drawRexi } from './layers/rexi';
import { palette } from './palette';
import { drawProjectiles } from './projectiles';
import { drawHowToPlay } from './screens/how-to-play';
import { drawPauseMenu } from './screens/pause-menu';
import { drawTitleScreen } from './screens/title';
import { dimScreen } from './screens/ui';
import { createSpriteBank } from './sprite';
import type { Bitmap, BitmapFactory, Surface } from './surface';

export type RunLayer = (dc: DrawContext, run: RunView) => void;

/** Run layers, back to front. New layers (Crates, effects, Dialogue Box) slot in here. */
const RUN_LAYERS: readonly RunLayer[] = [
  drawArena,
  drawEnemies,
  drawProjectiles,
  drawRexi,
  drawHud,
  drawCrosshair,
];

/** The frozen Run under the pause menu, dimmed: every layer except the HUD and crosshair. */
const PAUSED_RUN_LAYERS = RUN_LAYERS.filter(
  (layer) => layer !== drawCrosshair && layer !== drawHud,
);

export interface RendererOptions {
  /**
   * The bundled 480×270 title illustration, already decoded by the platform. Without it the
   * Title screen draws its code-drawn backdrop.
   */
  readonly titleIllustration?: Bitmap | null;
}

type ScreenDrawer = (dc: DrawContext, view: GameView) => void;

function drawRun(dc: DrawContext, layers: readonly RunLayer[]): void {
  const { run } = dc.view;
  if (run) for (const layer of layers) layer(dc, run);
}

export interface Renderer {
  /** Draws one complete 480×270 frame of `view`. Pure: same view, same pixels. */
  render(surface: Surface, view: GameView): void;
}

/** Creates a renderer; sprites are rasterized through `createBitmap` once, on first use. */
export function createRenderer(
  createBitmap: BitmapFactory,
  options: RendererOptions = {},
): Renderer {
  const sprites = createSpriteBank(createBitmap);
  const screens: Readonly<Record<ScreenKind, ScreenDrawer>> = {
    title: (dc) => {
      drawTitleScreen(dc, options.titleIllustration ?? null);
    },
    'how-to-play': drawHowToPlay,
    run: (dc) => {
      drawRun(dc, RUN_LAYERS);
    },
    paused: (dc, view) => {
      drawRun(dc, PAUSED_RUN_LAYERS);
      dimScreen(dc);
      drawRun(dc, [drawHud]); // the HUD stays legible above the dimmer
      if (view.pauseMenu) drawPauseMenu(dc, view.pauseMenu);
    },
  };
  return {
    render(surface, view) {
      surface.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, palette.letterbox);
      screens[view.screen]({ surface, sprites, view }, view);
    },
  };
}
