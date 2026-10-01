import type { RunView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { masterPalette } from '../palette';
import { defineSprite } from '../sprite';

/**
 * Light strokes fully outlined in black, so the reticle reads over the white marble and the
 * pale sky as well as over the dark skyline (consistency pass, #30).
 */
const CROSSHAIR = defineSprite({ c: masterPalette.light, k: masterPalette.outline }, [
  '.....k.....',
  '....kck....',
  '....kck....',
  '.....k.....',
  '.kk.....kk.',
  'kcck.k.kcck',
  '.kk.....kk.',
  '.....k.....',
  '....kck....',
  '....kck....',
  '.....k.....',
]);

/** Aim reticle at the aim point (the system cursor is hidden over the canvas). */
export function drawCrosshair(dc: DrawContext, run: RunView): void {
  drawSpriteCentered(dc, CROSSHAIR, run.rexi.aim.x, run.rexi.aim.y);
}
