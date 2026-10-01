/** A CSS hex color, `#rrggbb`. */
export type Color = `#${string}`;

/** A pre-rasterized pixel image, owned by the platform's canvas implementation. */
export interface Bitmap {
  readonly width: number;
  readonly height: number;
}

/** Turns straight-alpha RGBA pixels into a platform bitmap. Called once per sprite frame. */
export type BitmapFactory = (width: number, height: number, rgba: Uint8ClampedArray) => Bitmap;

/**
 * The only drawing operations the renderer may use (the determinism rule): solid
 * integer-aligned rectangles and unscaled pre-rasterized bitmaps at integer positions.
 * No paths, arcs, gradients or canvas text, so output is pixel-identical everywhere.
 */
export interface Surface {
  fillRect(x: number, y: number, w: number, h: number, color: Color): void;
  drawBitmap(bitmap: Bitmap, x: number, y: number): void;
}

/** The subset of a 2D canvas context that {@link canvasSurface} needs (DOM or Node canvas). */
export interface Canvas2DLike<TImage extends Bitmap> {
  fillStyle: unknown;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(image: TImage, dx: number, dy: number): void;
}

/**
 * Wraps a 2D canvas context as a {@link Surface}, snapping every coordinate to whole pixels.
 * `TImage` is the canvas implementation's image type, as produced by its BitmapFactory.
 */
export function canvasSurface<TImage extends Bitmap>(ctx: Canvas2DLike<TImage>): Surface {
  ctx.imageSmoothingEnabled = false;
  return {
    fillRect(x, y, w, h, color) {
      const left = Math.round(x);
      const top = Math.round(y);
      const width = Math.round(x + w) - left;
      const height = Math.round(y + h) - top;
      if (width <= 0 || height <= 0) return;
      ctx.fillStyle = color;
      ctx.fillRect(left, top, width, height);
    },
    drawBitmap(bitmap, x, y) {
      ctx.drawImage(bitmap as TImage, Math.round(x), Math.round(y));
    },
  };
}
