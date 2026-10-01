import type { RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import type { Color } from '../surface';

/** Sunset sky as flat color bands, top to bottom (placeholder until the Arena art ticket). */
const SKY_BANDS: readonly Color[] = [
  '#2b1e4a',
  '#3d2457',
  '#5a2c62',
  '#7d3565',
  '#a3435f',
  '#c95a55',
  '#e57a4a',
  '#f39c48',
  '#f8bd5a',
];

const GROUND: Color = '#6b5a4e';
const GROUND_EDGE: Color = '#a08c72';
const GROUND_SHADE: Color = '#4e4038';

/** Placeholder Arena: banded sunset sky and a flat plaza floor. */
export function drawArena(dc: DrawContext, run: RunView): void {
  const { surface } = dc;
  const { width, height, groundY } = run.arena;

  const bandHeight = Math.ceil(groundY / SKY_BANDS.length);
  SKY_BANDS.forEach((color, i) => {
    surface.fillRect(0, i * bandHeight, width, bandHeight, color);
  });

  surface.fillRect(0, groundY, width, height - groundY, GROUND);
  surface.fillRect(0, groundY, width, 2, GROUND_EDGE);
  for (let x = 0; x < width; x += 32) {
    surface.fillRect(x, groundY + 2, 1, height - groundY - 2, GROUND_SHADE);
  }
}
