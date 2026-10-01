/** Crops of rendered frames laid out side by side, for compact multi-pose golden images. */
import type { RgbaImage } from '../golden/golden';

export interface Crop {
  /** Center of the crop in the source frame. */
  readonly cx: number;
  readonly cy: number;
}

/** Cuts a `size`×`size` square centered on (cx, cy) out of `image` (outside = black). */
export function cropImage(image: RgbaImage, crop: Crop, size: number): RgbaImage {
  const data = new Uint8ClampedArray(size * size * 4);
  const left = Math.round(crop.cx - size / 2);
  const top = Math.round(crop.cy - size / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = left + x;
      const sy = top + y;
      const o = (y * size + x) * 4;
      data[o + 3] = 255;
      if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) continue;
      const i = (sy * image.width + sx) * 4;
      data[o] = image.data[i] ?? 0;
      data[o + 1] = image.data[i + 1] ?? 0;
      data[o + 2] = image.data[i + 2] ?? 0;
    }
  }
  return { width: size, height: size, data };
}

/** Lays equally sized tiles out in rows of `columns`, separated by 1px black gutters. */
export function tileImages(tiles: readonly RgbaImage[], columns: number): RgbaImage {
  const first = tiles[0];
  if (!first) throw new Error('tileImages needs at least one tile');
  const { width: tw, height: th } = first;
  const rows = Math.ceil(tiles.length / columns);
  const width = columns * (tw + 1) - 1;
  const height = rows * (th + 1) - 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  tiles.forEach((tile, index) => {
    const ox = (index % columns) * (tw + 1);
    const oy = Math.floor(index / columns) * (th + 1);
    for (let y = 0; y < th; y++) {
      const src = tile.data.subarray(y * tw * 4, (y + 1) * tw * 4);
      data.set(src, ((oy + y) * width + ox) * 4);
    }
  });
  return { width, height, data };
}
