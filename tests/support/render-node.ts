/** Renders Game core views in Node with @napi-rs/canvas, exactly as the browser shell does. */
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView } from '../../src/core';
import { canvasSurface, createRenderer, type BitmapFactory } from '../../src/render';
import type { RgbaImage } from '../golden/golden';

const createBitmap: BitmapFactory = (width, height, rgba) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return canvas;
};

const renderer = createRenderer(createBitmap);

/** Renders one frame of `view` to raw RGBA pixels at 480×270. */
export function renderView(view: GameView): RgbaImage {
  const canvas = createCanvas(SCREEN_WIDTH, SCREEN_HEIGHT);
  const ctx = canvas.getContext('2d');
  renderer.render(canvasSurface<Canvas>(ctx), view);
  const { data } = ctx.getImageData(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  return { width: SCREEN_WIDTH, height: SCREEN_HEIGHT, data: new Uint8ClampedArray(data) };
}
