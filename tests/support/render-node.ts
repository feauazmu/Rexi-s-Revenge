/** Renders Game core views in Node with @napi-rs/canvas, exactly as the browser shell does. */
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import { fileURLToPath } from 'node:url';
import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView } from '../../src/core';
import {
  canvasSurface,
  createRenderer,
  type Bitmap,
  type BitmapFactory,
  type Renderer,
  type Color,
  type Surface,
  type TextTarget,
  type TouchOverlayView,
  ROTATE_PROMPT_HEIGHT,
  ROTATE_PROMPT_WIDTH,
} from '../../src/render';
import { createSpriteBank } from '../../src/render/sprite';
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

/** Path of the bundled title illustration, as the browser shell loads it. */
export const TITLE_ILLUSTRATION_PATH = fileURLToPath(
  new URL('../../public/title.png', import.meta.url),
);

let titleIllustration: Promise<Bitmap> | null = null;

/** Decodes `public/title.png` once into a canvas bitmap, as the shell does in the browser. */
export function loadTitleIllustration(): Promise<Bitmap> {
  titleIllustration ??= loadImage(TITLE_ILLUSTRATION_PATH).then((image) => {
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas;
  });
  return titleIllustration;
}

const illustratedRenderers = new Map<Bitmap, Renderer>();

export interface RenderViewOptions {
  /** The decoded title illustration ({@link loadTitleIllustration}); omitted: code backdrop. */
  readonly titleIllustration?: Bitmap;
}

/** Renders one frame of `view` (and the touch overlay, if given) to raw RGBA pixels at 640×360. */
export function renderView(
  view: GameView,
  overlay?: TouchOverlayView | null,
  options: RenderViewOptions = {},
): RgbaImage {
  const { titleIllustration: illustration } = options;
  let chosen = renderer;
  if (illustration) {
    chosen =
      illustratedRenderers.get(illustration) ??
      createRenderer(createBitmap, { titleIllustration: illustration });
    illustratedRenderers.set(illustration, chosen);
  }
  return renderFrame((surface) => {
    chosen.render(surface, view, overlay);
  });
}

/** Renders the portrait "Gira tu teléfono" prompt at animation tick `tick`. */
export function renderRotatePrompt(tick: number): RgbaImage {
  return renderFrame(
    (surface) => {
      renderer.renderRotatePrompt(surface, tick);
    },
    ROTATE_PROMPT_WIDTH,
    ROTATE_PROMPT_HEIGHT,
  );
}

/**
 * Renders a renderer building block (e.g. text) outside a full frame, on a solid
 * `background`, to raw RGBA pixels (640×360 unless another size is given). For specimens of
 * fonts and icons.
 */
export function renderPart(
  background: Color,
  paint: (target: TextTarget) => void,
  size: { readonly width: number; readonly height: number } = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
): RgbaImage {
  const sprites = createSpriteBank(createBitmap);
  return renderFrame(
    (surface) => {
      surface.fillRect(0, 0, size.width, size.height, background);
      paint({ surface, sprites });
    },
    size.width,
    size.height,
  );
}

function renderFrame(
  paint: (surface: Surface) => void,
  width = SCREEN_WIDTH,
  height = SCREEN_HEIGHT,
): RgbaImage {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  paint(canvasSurface<Canvas>(ctx));
  const { data } = ctx.getImageData(0, 0, width, height);
  return { width, height, data: new Uint8ClampedArray(data) };
}
