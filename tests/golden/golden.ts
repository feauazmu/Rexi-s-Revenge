/**
 * Golden-image harness: pixel-exact comparison of rendered frames against committed PNGs.
 *
 * - Goldens live in tests/golden/__goldens__/<name>.png and are committed.
 * - On mismatch the test fails and writes <name>.actual.png, <name>.expected.png and
 *   <name>.diff.png (differing pixels in red over a faded copy) to test-results/golden/.
 * - Goldens are created or replaced only with `npm run golden:update` (UPDATE_GOLDENS=1).
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

const here = dirname(fileURLToPath(import.meta.url));
export const GOLDEN_DIR = join(here, '__goldens__');
export const OUTPUT_DIR = join(here, '..', '..', 'test-results', 'golden');

export interface ImageComparison {
  /** Number of pixels whose RGBA differs. */
  readonly mismatchedPixels: number;
  /** Differing pixels in red over a faded grayscale copy of the expected image. */
  readonly diff: RgbaImage;
}

export function compareImages(actual: RgbaImage, expected: RgbaImage): ImageComparison {
  if (actual.width !== expected.width || actual.height !== expected.height) {
    return {
      mismatchedPixels: Math.max(actual.width * actual.height, expected.width * expected.height),
      diff: actual,
    };
  }
  const diff = new Uint8ClampedArray(actual.data.length);
  let mismatchedPixels = 0;
  for (let i = 0; i < actual.data.length; i += 4) {
    const same =
      actual.data[i] === expected.data[i] &&
      actual.data[i + 1] === expected.data[i + 1] &&
      actual.data[i + 2] === expected.data[i + 2] &&
      actual.data[i + 3] === expected.data[i + 3];
    if (same) {
      const luma =
        0.299 * (expected.data[i] ?? 0) +
        0.587 * (expected.data[i + 1] ?? 0) +
        0.114 * (expected.data[i + 2] ?? 0);
      const faded = 160 + luma * 0.3;
      diff[i] = diff[i + 1] = diff[i + 2] = faded;
    } else {
      mismatchedPixels += 1;
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
    }
    diff[i + 3] = 255;
  }
  return { mismatchedPixels, diff: { width: actual.width, height: actual.height, data: diff } };
}

export async function encodePng(image: RgbaImage): Promise<Buffer> {
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(image.width, image.height);
  imageData.data.set(image.data);
  ctx.putImageData(imageData, 0, 0);
  return canvas.encode('png');
}

export async function decodePng(png: Buffer): Promise<RgbaImage> {
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, img.width, img.height);
  return { width: img.width, height: img.height, data: new Uint8ClampedArray(data) };
}

export interface GoldenOptions {
  readonly goldenDir?: string;
  readonly outputDir?: string;
  /** Write the image as the new golden instead of comparing. Default: UPDATE_GOLDENS=1. */
  readonly update?: boolean;
}

export type GoldenResult =
  | { readonly status: 'match' | 'updated' }
  | { readonly status: 'missing'; readonly message: string }
  | { readonly status: 'mismatch'; readonly message: string; readonly mismatchedPixels: number };

/** Compares `image` with the golden called `name`, writing artifacts on mismatch. */
export async function matchGolden(
  name: string,
  image: RgbaImage,
  options: GoldenOptions = {},
): Promise<GoldenResult> {
  const goldenDir = options.goldenDir ?? GOLDEN_DIR;
  const outputDir = options.outputDir ?? OUTPUT_DIR;
  const update = options.update ?? process.env.UPDATE_GOLDENS === '1';
  const goldenPath = join(goldenDir, `${name}.png`);

  if (update) {
    await mkdir(goldenDir, { recursive: true });
    await writeFile(goldenPath, await encodePng(image));
    return { status: 'updated' };
  }
  if (!existsSync(goldenPath)) {
    return {
      status: 'missing',
      message: `No golden image "${name}" at ${goldenPath}. Create it with: npm run golden:update`,
    };
  }

  const expected = await decodePng(await readFile(goldenPath));
  const { mismatchedPixels, diff } = compareImages(image, expected);
  if (mismatchedPixels === 0) return { status: 'match' };

  await mkdir(outputDir, { recursive: true });
  const artifact = (suffix: string) => join(outputDir, `${name}.${suffix}.png`);
  await writeFile(artifact('actual'), await encodePng(image));
  await writeFile(artifact('expected'), await encodePng(expected));
  await writeFile(artifact('diff'), await encodePng(diff));
  return {
    status: 'mismatch',
    mismatchedPixels,
    message:
      `Golden "${name}" differs in ${mismatchedPixels} pixel(s). See ${artifact('diff')}. ` +
      `If the change is intended, run: npm run golden:update`,
  };
}

/** Test assertion: throws unless `image` matches the golden (or goldens are being updated). */
export async function expectGolden(name: string, image: RgbaImage): Promise<void> {
  const result = await matchGolden(name, image);
  if (result.status === 'missing' || result.status === 'mismatch') {
    throw new Error(result.message);
  }
}
