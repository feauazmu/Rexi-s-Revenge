import type { Bitmap, BitmapFactory, Color } from './surface';

/**
 * A sprite drawn in code (ADR 0001): a palette-indexed pixel grid. Each character of `rows`
 * is a palette key; `.` is transparent. All rows must have the same length.
 *
 * ```ts
 * const coin = defineSprite({ y: '#f0c040', o: '#a06010' }, ['.oo.', 'oyyo', '.oo.']);
 * ```
 */
export interface SpriteDef {
  readonly palette: Readonly<Record<string, Color>>;
  readonly rows: readonly string[];
  readonly width: number;
  readonly height: number;
}

export const TRANSPARENT = '.';

export function defineSprite(
  palette: Readonly<Record<string, Color>>,
  rows: readonly string[],
): SpriteDef {
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error('Sprite must have at least one non-empty row');
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Sprite row ${y} is ${row.length} pixels wide, expected ${width}`);
    }
    for (const key of row) {
      if (key !== TRANSPARENT && !(key in palette)) {
        throw new Error(`Sprite row ${y} uses "${key}", which is not in its palette`);
      }
    }
  });
  return { palette, rows, width, height: rows.length };
}

/** The same sprite mirrored horizontally (e.g. for facing left). */
export function mirrorSprite(sprite: SpriteDef): SpriteDef {
  return defineSprite(
    sprite.palette,
    sprite.rows.map((row) => Array.from(row).reverse().join('')),
  );
}

const silhouettes = new WeakMap<SpriteDef, Map<Color, SpriteDef>>();

/**
 * The sprite's shape filled with one color (e.g. a white hit flash). Memoized per sprite and
 * color, so the SpriteBank rasterizes each silhouette only once.
 */
export function silhouetteSprite(sprite: SpriteDef, color: Color): SpriteDef {
  let byColor = silhouettes.get(sprite);
  if (!byColor) {
    byColor = new Map();
    silhouettes.set(sprite, byColor);
  }
  let silhouette = byColor.get(color);
  if (!silhouette) {
    const solid = Object.fromEntries(Object.keys(sprite.palette).map((key) => [key, color]));
    silhouette = defineSprite(solid, sprite.rows);
    byColor.set(color, silhouette);
  }
  return silhouette;
}

const rotations = new WeakMap<SpriteDef, SpriteDef[]>();

/** The sprite turned clockwise by `quarterTurns` × 90° (any integer). Memoized per sprite. */
export function rotateSprite(sprite: SpriteDef, quarterTurns: number): SpriteDef {
  const turns = ((Math.round(quarterTurns) % 4) + 4) % 4;
  if (turns === 0) return sprite;
  let cached = rotations.get(sprite);
  if (!cached) {
    const quarter = (s: SpriteDef): SpriteDef =>
      defineSprite(
        s.palette,
        Array.from({ length: s.width }, (_, x) =>
          s.rows.map((_row, y) => s.rows[s.height - 1 - y]?.charAt(x) ?? TRANSPARENT).join(''),
        ),
      );
    const once = quarter(sprite);
    const twice = quarter(once);
    cached = [sprite, once, twice, quarter(twice)];
    rotations.set(sprite, cached);
  }
  return cached[turns] ?? sprite;
}

/** Rasterizes a sprite to straight-alpha RGBA pixels. */
export function rasterizeSprite(sprite: SpriteDef): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(sprite.width * sprite.height * 4);
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = sprite.palette[row.charAt(x)];
      if (color === undefined) continue; // transparent
      const i = (y * sprite.width + x) * 4;
      rgba[i] = parseInt(color.slice(1, 3), 16);
      rgba[i + 1] = parseInt(color.slice(3, 5), 16);
      rgba[i + 2] = parseInt(color.slice(5, 7), 16);
      rgba[i + 3] = 255;
    }
  });
  return rgba;
}

/** Rasterizes each sprite once, on first use, and hands back the cached bitmap afterwards. */
export interface SpriteBank {
  get(sprite: SpriteDef): Bitmap;
}

export function createSpriteBank(createBitmap: BitmapFactory): SpriteBank {
  const cache = new Map<SpriteDef, Bitmap>();
  return {
    get(sprite) {
      let bitmap = cache.get(sprite);
      if (!bitmap) {
        bitmap = createBitmap(sprite.width, sprite.height, rasterizeSprite(sprite));
        cache.set(sprite, bitmap);
      }
      return bitmap;
    },
  };
}
