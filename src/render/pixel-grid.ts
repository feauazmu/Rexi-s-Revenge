import { defineSprite, TRANSPARENT, type SpriteDef } from './sprite';
import type { Color } from './surface';

/** Characters available as palette keys when a grid becomes a sprite (`.` is transparent). */
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+-/:;<=>?@^_~';

/**
 * A procedural pixel canvas for large code-drawn art (ADR 0001), such as the Arena's sign lettering.
 * Paint with named palette colors, then turn it into an ordinary {@link SpriteDef} that the
 * SpriteBank rasterizes once. Pixels outside the grid are ignored, so shapes may overhang.
 */
export interface PixelGrid<K extends string> {
  readonly width: number;
  readonly height: number;
  /** Paints one pixel (coordinates are floored). */
  px(x: number, y: number, color: K): void;
  /** Paints a solid rectangle. */
  rect(x: number, y: number, w: number, h: number, color: K): void;
  /** Paints every other pixel of a rectangle in a checkerboard (2-color dithering). */
  checker(x: number, y: number, w: number, h: number, color: K, phase?: 0 | 1): void;
  /** Clears a rectangle back to transparent. */
  clear(x: number, y: number, w: number, h: number): void;
  /** The color at a pixel, or null when transparent or outside the grid. */
  get(x: number, y: number): K | null;
  /** The finished picture as a palette-indexed sprite. */
  toSprite(): SpriteDef;
}

export function createPixelGrid<K extends string>(
  width: number,
  height: number,
  colors: Readonly<Record<K, Color>>,
): PixelGrid<K> {
  const names = Object.keys(colors) as K[];
  if (names.length > KEYS.length) throw new Error(`At most ${KEYS.length} colors per grid`);
  const indexOf = new Map<K, number>(names.map((name, i) => [name, i + 1]));
  const pixels = new Uint8Array(width * height); // 0 = transparent, else index + 1

  const set = (x: number, y: number, index: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;
    pixels[iy * width + ix] = index;
  };
  const fill = (x: number, y: number, w: number, h: number, index: number, step = 1) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    for (let yy = y0; yy < y0 + Math.floor(h); yy++) {
      for (let xx = x0; xx < x0 + Math.floor(w); xx++) {
        if (step === 1 || (xx + yy) % 2 === step - 2) set(xx, yy, index);
      }
    }
  };
  const idx = (color: K): number => {
    const index = indexOf.get(color);
    if (index === undefined) throw new Error(`Unknown grid color: ${color}`);
    return index;
  };

  return {
    width,
    height,
    px: (x, y, color) => {
      set(x, y, idx(color));
    },
    rect: (x, y, w, h, color) => {
      fill(x, y, w, h, idx(color));
    },
    checker: (x, y, w, h, color, phase = 0) => {
      fill(x, y, w, h, idx(color), 2 + phase);
    },
    clear: (x, y, w, h) => {
      fill(x, y, w, h, 0);
    },
    get(x, y) {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      const index = pixels[Math.floor(y) * width + Math.floor(x)] ?? 0;
      return index === 0 ? null : (names[index - 1] ?? null);
    },
    toSprite() {
      const palette: Record<string, Color> = {};
      names.forEach((name, i) => (palette[KEYS.charAt(i)] = colors[name]));
      const rows: string[] = [];
      for (let y = 0; y < height; y++) {
        let row = '';
        for (let x = 0; x < width; x++) {
          const index = pixels[y * width + x] ?? 0;
          row += index === 0 ? TRANSPARENT : KEYS.charAt(index - 1);
        }
        rows.push(row);
      }
      return defineSprite(palette, rows);
    },
  };
}
