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
