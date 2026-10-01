import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { drive } from '../support/driver';
import { renderView } from '../support/render-node';
import { compareImages, decodePng, encodePng, matchGolden, type RgbaImage } from './golden';

function withPixel(image: RgbaImage, x: number, y: number, rgba: readonly number[]): RgbaImage {
  const data = new Uint8ClampedArray(image.data);
  data.set(rgba, (y * image.width + x) * 4);
  return { ...image, data };
}

function pixelAt(image: RgbaImage, x: number, y: number): number[] {
  const i = (y * image.width + x) * 4;
  return [...image.data.slice(i, i + 4)];
}

describe('golden-image harness', () => {
  let dir: string;
  const frame = (): RgbaImage => {
    const game = drive({ overrides: { spawns: [{ kind: 'maletin-coptero', x: 300, y: 60 }] } });
    game.seconds(0.5, { fire: true, aim: { x: 312, y: 69 } });
    return renderView(game.view);
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'rexi-golden-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const options = (update = false) => ({
    goldenDir: join(dir, 'goldens'),
    outputDir: join(dir, 'out'),
    update,
  });

  it('renders frames deterministically', () => {
    expect(compareImages(frame(), frame()).mismatchedPixels).toBe(0);
  });

  it('round-trips frames through PNG without changing a pixel', async () => {
    const image = frame();
    const decoded = await decodePng(await encodePng(image));
    expect(compareImages(decoded, image).mismatchedPixels).toBe(0);
  });

  it('never creates a missing golden on its own', async () => {
    const result = await matchGolden('scene', frame(), options());
    expect(result.status).toBe('missing');
    expect(existsSync(join(dir, 'goldens', 'scene.png'))).toBe(false);
  });

  it('matches a golden written with the update flag', async () => {
    expect((await matchGolden('scene', frame(), options(true))).status).toBe('updated');
    expect((await matchGolden('scene', frame(), options())).status).toBe('match');
  });

  it('fails on a single changed pixel and writes a diff artifact', async () => {
    await matchGolden('scene', frame(), options(true));
    const changed = withPixel(frame(), 10, 20, [1, 2, 3, 255]);

    const result = await matchGolden('scene', changed, options());

    expect(result).toMatchObject({ status: 'mismatch', mismatchedPixels: 1 });
    const out = join(dir, 'out');
    expect(existsSync(join(out, 'scene.actual.png'))).toBe(true);
    expect(existsSync(join(out, 'scene.expected.png'))).toBe(true);
    const diff = await decodePng(await readFile(join(out, 'scene.diff.png')));
    expect(pixelAt(diff, 10, 20)).toEqual([255, 0, 0, 255]);
    expect(pixelAt(diff, 11, 20)).not.toEqual([255, 0, 0, 255]);
  });

  it('treats a size difference as a mismatch', () => {
    const image = frame();
    const smaller = { width: 1, height: 1, data: image.data.slice(0, 4) };
    expect(compareImages(smaller, image).mismatchedPixels).toBeGreaterThan(0);
  });
});
