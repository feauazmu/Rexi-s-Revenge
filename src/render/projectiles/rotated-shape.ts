import { TRANSPARENT, defineSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';

/**
 * A projectile shape drawn procedurally in its own space (ADR 0001): `u` runs along its heading
 * and `v` across it (positive = its underside). Returns a palette key, or null where the shape
 * is not.
 */
export type ShapePaint = (u: number, v: number) => string | null;

export interface RotatedShapeOptions {
  /** Palette used by `paint`; must contain `k`, the outline color. */
  readonly palette: Readonly<Record<string, Color>>;
  readonly paint: ShapePaint;
  /** Distance from the center to the farthest painted point, px. */
  readonly radius: number;
  /**
   * Keep the underside down when heading left (mirror instead of turning upside down), for
   * shapes with a top and a bottom like a book.
   */
  readonly upright?: boolean;
}

const OUTLINE = 'k';

/**
 * Rounds away floating-point noise (cos(π/2) is not exactly 0), so a quarter turn samples
 * exactly the same shape points as the unturned sprite.
 */
function snap(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Rasterizes `shape` turned to `angle` (radians, screen coordinates: 0 = right, π/2 = down)
 * with a one-pixel outline. The sprite is square with the shape's center at its center, so it
 * can be drawn with `drawSpriteCentered`. Callers cache the result per discrete angle.
 */
export function rasterizeRotatedShape(shape: RotatedShapeOptions, angle: number): SpriteDef {
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const flip = shape.upright === true && dir.x < -1e-9 ? -1 : 1;
  const side = { x: -dir.y * flip, y: dir.x * flip };
  const size = Math.ceil(shape.radius) * 2 + 3;
  const mid = (size - 1) / 2;

  const keys: (string | null)[][] = [];
  for (let gy = 0; gy < size; gy++) {
    const row: (string | null)[] = [];
    for (let gx = 0; gx < size; gx++) {
      const px = gx - mid;
      const py = gy - mid;
      row.push(shape.paint(snap(px * dir.x + py * dir.y), snap(px * side.x + py * side.y)));
    }
    keys.push(row);
  }

  const filled = (x: number, y: number): boolean => keys[y]?.[x] != null;
  const rows = keys.map((row, y) =>
    row
      .map((key, x) => {
        if (key !== null) return key;
        const edge = filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1);
        return edge ? OUTLINE : TRANSPARENT;
      })
      .join(''),
  );
  return defineSprite(shape.palette, rows);
}

/**
 * Memoizes `rasterizeRotatedShape` for `steps` discrete angles around the full circle:
 * `spriteFor(angle)` snaps the angle to the nearest step.
 */
export function rotatedShapeSprites(
  shape: RotatedShapeOptions,
  steps: number,
): (angle: number) => SpriteDef {
  const cache = new Map<number, SpriteDef>();
  const stepAngle = (2 * Math.PI) / steps;
  return (angle) => {
    const step = ((Math.round(angle / stepAngle) % steps) + steps) % steps;
    let sprite = cache.get(step);
    if (!sprite) {
      sprite = rasterizeRotatedShape(shape, step * stepAngle);
      cache.set(step, sprite);
    }
    return sprite;
  };
}
