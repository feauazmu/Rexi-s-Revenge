import type { BitmapFactory } from '../render';

/** Browser BitmapFactory: each sprite frame becomes a small offscreen canvas. */
export const createCanvasBitmap: BitmapFactory = (width, height, rgba) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return canvas;
};

/**
 * Loads and decodes an image file into an offscreen canvas the renderer can draw unscaled
 * (e.g. the title illustration). Resolves to null when it cannot be loaded or decoded, or is
 * not `width`×`height`, so the caller can fall back to code-drawn art.
 */
export async function loadBitmap(
  url: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (image.naturalWidth !== width || image.naturalHeight !== height) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0);
    return canvas;
  } catch {
    return null;
  }
}
