import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView, type RunView, type ScreenKind } from '../core';
import { translatedContext, type DrawContext } from './draw-context';
import { drawEffects } from './effects';
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

/**
 * Run layers, back to front. World layers move with the screen shake; screen layers (HUD,
 * crosshair, Dialogue Box) stay fixed. New layers (Crates, Dialogue Box) slot in here.
 */
const WORLD_LAYERS: readonly RunLayer[] = [
  drawArena,
  drawEnemies,
  drawProjectiles,
  drawRexi,
  drawEffects,
];
const SCREEN_LAYERS: readonly RunLayer[] = [drawHud, drawCrosshair];

export interface RendererOptions {
  /**
   * The bundled 480×270 title illustration, already decoded by the platform. Without it the
   * Title screen draws its code-drawn backdrop.
   */
  readonly titleIllustration?: Bitmap | null;
}

type ScreenDrawer = (dc: DrawContext, view: GameView) => void;

/** Draws world layers offset by the screen shake, then fixed screen layers. */
function drawRun(
  dc: DrawContext,
  worldLayers: readonly RunLayer[],
  screenLayers: readonly RunLayer[],
): void {
  const { run } = dc.view;
  if (!run) return;
  const world = translatedContext(dc, run.effects.shake.x, run.effects.shake.y);
  for (const layer of worldLayers) layer(world, run);
  for (const layer of screenLayers) layer(dc, run);
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
      drawRun(dc, WORLD_LAYERS, SCREEN_LAYERS);
    },
    paused: (dc, view) => {
      // The frozen Run, dimmed, without HUD and crosshair; then the HUD stays legible above it.
      drawRun(dc, WORLD_LAYERS, []);
      dimScreen(dc);
      drawRun(dc, [], [drawHud]);
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
