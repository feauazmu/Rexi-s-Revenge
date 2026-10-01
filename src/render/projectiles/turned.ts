import type { DrawContext } from '../draw-context';
import { mirroredSprite, type SpriteDef } from '../sprite';

/** Where a part's pivot landed in each pre-rotated sprite (`art.py bake`'s pivots.json). */
export interface TurnSet {
  readonly pivots: Readonly<Record<string, readonly number[]>>;
}

/** The sprites of one baked part, by angle key ('+022.5'). */
export type TurnSprites = Readonly<Record<string, SpriteDef>>;

/** The baked angle key for `degrees` (as `art.py bake` names its files: '+022.5', '-090.0'). */
export function turnKey(degrees: number): string {
  const rounded = Math.round(degrees * 10) / 10;
  const sign = rounded < 0 ? '-' : '+';
  return sign + Math.abs(rounded).toFixed(1).padStart(5, '0');
}

/**
 * Draws the part pre-rotated to `degrees` (a baked angle: counter-clockwise on screen, so +90
 * points a right-facing part up) with its pivot on (cx, cy). `mirror` flips it left to right
 * around the pivot, for the left-facing half of the circle.
 */
export function drawTurned(
  dc: DrawContext,
  sprites: TurnSprites,
  set: TurnSet,
  degrees: number,
  cx: number,
  cy: number,
  mirror = false,
): void {
  const key = turnKey(degrees);
  const sprite = sprites[key];
  const pivot = set.pivots[key];
  if (!sprite || !pivot) throw new Error(`No baked sprite at ${key}`);
  const [px = 0, py = 0] = pivot;
  const x = mirror ? sprite.width - 1 - px : px;
  dc.surface.drawBitmap(
    dc.sprites.get(mirror ? mirroredSprite(sprite) : sprite),
    Math.round(cx - x - 0.5),
    Math.round(cy - py - 0.5),
  );
}

/** Degrees between baked angles of an aim set (-90..90 in 9 steps). */
const AIM_STEP = 22.5;

/**
 * Draws a part baked from -90° to 90° pointing along (vx, vy): headings to the left use the
 * mirrored set, so 9 baked angles give 16 directions and the part stays upright.
 */
export function drawAimed(
  dc: DrawContext,
  sprites: TurnSprites,
  set: TurnSet,
  vx: number,
  vy: number,
  cx: number,
  cy: number,
): void {
  const left = vx < 0;
  // Screen y points down, baked angles turn counter-clockwise: aim up = positive angle.
  const degrees = (Math.atan2(-vy, Math.abs(vx)) * 180) / Math.PI;
  const snapped = Math.max(-90, Math.min(90, Math.round(degrees / AIM_STEP) * AIM_STEP));
  drawTurned(dc, sprites, set, snapped, cx, cy, left);
}

/** The sprites of baked part `name` from an exported module's sprite table ('turn/<name>/<key>'). */
export function turnSprites(table: Readonly<Record<string, SpriteDef>>, name: string): TurnSprites {
  const prefix = `turn/${name}/`;
  const out: Record<string, SpriteDef> = {};
  for (const [key, sprite] of Object.entries(table)) {
    if (key.startsWith(prefix)) out[key.slice(prefix.length)] = sprite;
  }
  if (Object.keys(out).length === 0) throw new Error(`No baked sprites for ${name}`);
  return out;
}
