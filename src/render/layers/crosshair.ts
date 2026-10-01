import type { RunView } from '../../core';
import { drawSpriteCentered, type DrawContext } from '../draw-context';
import { palette } from '../palette';
import { defineSprite } from '../sprite';

const CROSSHAIR = defineSprite({ c: palette.crosshair, k: palette.outline }, [
  '....k....',
  '....c....',
  '....c....',
  '.........',
  'kcc.k.cck',
  '.........',
  '....c....',
  '....c....',
  '....k....',
]);

/** Aim reticle at the aim point (the system cursor is hidden over the canvas). */
export function drawCrosshair(dc: DrawContext, run: RunView): void {
  drawSpriteCentered(dc, CROSSHAIR, run.rexi.aim.x, run.rexi.aim.y);
}
