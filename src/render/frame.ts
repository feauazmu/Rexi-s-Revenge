/**
 * Frame building blocks shared by the UI layers (HUD, Crates, Dialogue Box, menu screens):
 * solid rectangles only, per the determinism rule.
 */
import type { Color, Surface } from './surface';

/**
 * A rectangle with its four corner pixels cut off: the outline shape every UI frame (panels,
 * plates, slots, keys, Crates) starts from.
 */
export function fillCutRect(
  surface: Surface,
  x: number,
  y: number,
  w: number,
  h: number,
  color: Color,
): void {
  surface.fillRect(x + 1, y, w - 2, h, color);
  surface.fillRect(x, y + 1, w, h - 2, color);
}

/**
 * L-shaped brackets, `arm` px long, in the four inner corners of the box (x, y, w, h), each
 * corner pixel lit with `rivet`.
 */
export function drawCornerBrackets(
  surface: Surface,
  box: { readonly x: number; readonly y: number; readonly w: number; readonly h: number },
  arm: number,
  color: Color,
  rivet: Color,
): void {
  const { x, y, w, h } = box;
  for (const [cx, cy, sx, sy] of [
    [x, y, 1, 1],
    [x + w - 1, y, -1, 1],
    [x, y + h - 1, 1, -1],
    [x + w - 1, y + h - 1, -1, -1],
  ] as const) {
    surface.fillRect(sx > 0 ? cx : cx - arm + 1, cy, arm, 1, color);
    surface.fillRect(cx, sy > 0 ? cy : cy - arm + 1, 1, arm, color);
    surface.fillRect(cx, cy, 1, 1, rivet);
  }
}
