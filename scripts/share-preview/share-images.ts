/**
 * Renders every share preview image with the game's own renderer in Node (@napi-rs/canvas,
 * exactly as the golden tests do): the favicons, the app icons and the 1200×630 link preview.
 * `make-share-preview.ts` writes them to `public/`; a test checks the committed files match.
 */
import { createCanvas, loadImage, type Canvas } from '@napi-rs/canvas';
import {
  APP_ICON_ART,
  APP_ICON_BACKGROUND,
  appIconArt,
  canvasSurface,
  createSpriteBank,
  drawShareCard,
  favicon,
  FAVICON_SIZES,
  rasterizeSprite,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  type BitmapFactory,
  type SpriteDef,
} from '../../src/render';
import { encodeIco, padSquare, scaleNearest, type RgbaImage } from './pixels';

/** The link preview's size (Open Graph and Twitter's large image card). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/** Every generated file under `public/`. */
export const SHARE_FILES = {
  favicons: Object.fromEntries(FAVICON_SIZES.map((size) => [size, `favicon-${size}.png`])),
  faviconIco: 'favicon.ico',
  appleTouchIcon: 'apple-touch-icon.png',
  manifestIcons: { 192: 'icon-192.png', 512: 'icon-512.png' },
  ogImage: 'og-image.png',
} as const;

const createBitmap: BitmapFactory = (width, height, rgba) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  image.data.set(rgba);
  ctx.putImageData(image, 0, 0);
  return canvas;
};

function spriteImage(sprite: SpriteDef): RgbaImage {
  return { width: sprite.width, height: sprite.height, data: rasterizeSprite(sprite) };
}

/** The app icon art scaled by the largest whole factor that fits `size`, padded to it. */
function appIcon(size: number): RgbaImage {
  const scale = Math.floor(size / APP_ICON_ART);
  const art = APP_ICON_ART * scale;
  return padSquare(scaleNearest(spriteImage(appIconArt()), art, art), size, APP_ICON_BACKGROUND);
}

/** Decodes the title illustration PNG into a canvas the renderer can draw. */
export async function decodeIllustration(png: Buffer | string): Promise<Canvas> {
  const image = await loadImage(png);
  const canvas = createCanvas(image.width, image.height);
  canvas.getContext('2d').drawImage(image, 0, 0);
  return canvas;
}

/** The share card at game resolution, then scaled 2× (nearest-neighbor) to 1200×630. */
export function ogImage(illustration: Canvas): RgbaImage {
  const canvas = createCanvas(SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  const ctx = canvas.getContext('2d');
  drawShareCard(
    { surface: canvasSurface<Canvas>(ctx), sprites: createSpriteBank(createBitmap) },
    illustration,
  );
  const { data } = ctx.getImageData(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  const card = {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    data: new Uint8ClampedArray(data),
  };
  return scaleNearest(card, OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT);
}

/** Every PNG image by file name (the `.ico` is built from the favicon PNGs). */
export function shareImages(illustration: Canvas): Map<string, RgbaImage> {
  const images = new Map<string, RgbaImage>();
  for (const size of FAVICON_SIZES)
    images.set(SHARE_FILES.favicons[size] ?? '', spriteImage(favicon(size)));
  images.set(SHARE_FILES.appleTouchIcon, appIcon(180));
  images.set(SHARE_FILES.manifestIcons[192], appIcon(192));
  images.set(SHARE_FILES.manifestIcons[512], appIcon(512));
  images.set(SHARE_FILES.ogImage, ogImage(illustration));
  return images;
}

export async function encodePng(image: RgbaImage): Promise<Buffer> {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(image.width, image.height);
  data.data.set(image.data);
  ctx.putImageData(data, 0, 0);
  return canvas.encode('png');
}

/** `favicon.ico` with the 16, 32 and 48 px favicons. */
export async function faviconIco(): Promise<Uint8Array> {
  return encodeIco(
    await Promise.all(
      FAVICON_SIZES.map(async (size) => ({
        size,
        png: await encodePng(spriteImage(favicon(size))),
      })),
    ),
  );
}
