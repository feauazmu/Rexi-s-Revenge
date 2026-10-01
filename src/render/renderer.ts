import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView, type RunView, type ScreenKind } from '../core';
import { drawDialogueBox } from './dialogue/dialogue-box';
import { translatedContext, type DrawContext } from './draw-context';
import { drawEffects } from './effects';
import { drawEnemies } from './enemies';
import { drawHud } from './hud/hud';
import { ARENA_BLEED, drawArena } from './layers/arena';
import { drawCrates } from './layers/crates';
import { drawCrosshair } from './layers/crosshair';
import { drawSlowMotionTint } from './layers/power-up-effects';
import { drawRexi } from './layers/rexi';
import { palette } from './palette';
import { drawProjectiles } from './projectiles';
import { drawHowToPlay } from './screens/how-to-play';
import { drawPauseMenu } from './screens/pause-menu';
import { drawTitleScreen } from './screens/title';
import { dimScreen } from './screens/ui';
import { dimDefeat, drawDefeatBanner, drawVerdict } from './screens/verdict';
import { createSpriteBank } from './sprite';
import type { Bitmap, BitmapFactory, Surface } from './surface';
import type { TouchOverlayView } from './touch/layout';
import { drawTouchOverlay } from './touch/overlay';
import { drawRotatePrompt } from './touch/rotate-prompt';

export type RunLayer = (dc: DrawContext, run: RunView) => void;

/**
 * Run layers, back to front. World layers move with the screen shake; screen layers (HUD,
 * Dialogue Box, crosshair) stay fixed.
 */
const WORLD_LAYERS: readonly RunLayer[] = [
  drawArena,
  drawCrates,
  drawEnemies,
  drawProjectiles,
  drawSlowMotionTint,
  drawRexi,
  drawEffects,
];
const SCREEN_LAYERS: readonly RunLayer[] = [drawHud, drawDialogueBox, drawCrosshair];

export interface RendererOptions {
  /**
   * The bundled 640×360 title illustration (`public/title.png`), already decoded by the
   * platform. Without it the Title screen draws its code-drawn backdrop.
   */
  readonly titleIllustration?: Bitmap | null;
}

type ScreenDrawer = (dc: DrawContext, view: GameView) => void;

/**
 * Draws world layers offset by the screen shake (clamped to the Arena's bleed, so the edges
 * never show the letterbox), then fixed screen layers.
 */
function drawRun(
  dc: DrawContext,
  worldLayers: readonly RunLayer[],
  screenLayers: readonly RunLayer[],
): void {
  const { run } = dc.view;
  if (!run) return;
  const clampShake = (offset: number) => Math.max(-ARENA_BLEED, Math.min(ARENA_BLEED, offset));
  const { x, y } = run.effects.shake;
  const world = translatedContext(dc, clampShake(x), clampShake(y));
  for (const layer of worldLayers) layer(world, run);
  for (const layer of screenLayers) layer(dc, run);
}

export interface Renderer {
  /**
   * Draws one complete 640×360 frame of `view`, with the touch controls on top when an
   * `overlay` is given. Pure: same inputs, same pixels.
   */
  render(surface: Surface, view: GameView, overlay?: TouchOverlayView | null): void;
  /**
   * Draws the "Gira tu teléfono" prompt on a portrait ROTATE_PROMPT_WIDTH×ROTATE_PROMPT_HEIGHT
   * surface (touch devices held upright). `tick` drives its animation.
   */
  renderRotatePrompt(surface: Surface, tick: number): void;
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
    run: (dc, view) => {
      if (view.defeatAge === null) {
        drawRun(dc, WORLD_LAYERS, SCREEN_LAYERS);
        return;
      }
      // Defeat beat: the frozen Run darkens under its HUD (no crosshair) and a banner.
      drawRun(dc, WORLD_LAYERS, []);
      dimDefeat(dc, view.defeatAge);
      drawRun(dc, [], [drawHud]);
      drawDefeatBanner(dc, view.defeatAge);
    },
    paused: (dc, view) => {
      // The frozen Run (and Dialogue Box), dimmed, without HUD and crosshair; then the HUD stays
      // legible above it.
      drawRun(dc, WORLD_LAYERS, [drawDialogueBox]);
      dimScreen(dc);
      drawRun(dc, [], [drawHud]);
      if (view.pauseMenu) drawPauseMenu(dc, view.pauseMenu);
    },
    verdict: (dc, view) => {
      drawRun(dc, WORLD_LAYERS, []);
      dimScreen(dc);
      if (view.verdict) drawVerdict(dc, view.verdict);
    },
  };
  return {
    render(surface, view, overlay) {
      surface.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, palette.letterbox);
      const dc: DrawContext = { surface, sprites, view };
      screens[view.screen](dc, view);
      if (overlay) drawTouchOverlay(dc, overlay);
    },
    renderRotatePrompt(surface, tick) {
      drawRotatePrompt({ surface, sprites }, tick);
    },
  };
}
