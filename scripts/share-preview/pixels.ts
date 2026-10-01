/**
 * Pure pixel helpers for the share preview images: nearest-neighbor scaling, padding onto a
 * background, and the `.ico` container. No canvas, so tests can use them directly.
 */

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

/**
 * Scales with nearest-neighbor sampling (each output pixel copies the source pixel under its
 * top-left corner), so pixel art stays crisp. Whole factors give perfectly even pixels.
 */
export function scaleNearest(src: RgbaImage, width: number, height: number): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y * src.height) / height);
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x * src.width) / width);
      const from = (sy * src.width + sx) * 4;
      data.set(src.data.subarray(from, from + 4), (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

/** `src` centered on an opaque `size`×`size` square of `background` (`#rrggbb`). */
export function padSquare(src: RgbaImage, size: number, background: string): RgbaImage {
  const data = new Uint8ClampedArray(size * size * 4);
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(background.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r ?? 0;
    data[i + 1] = g ?? 0;
    data[i + 2] = b ?? 0;
    data[i + 3] = 255;
  }
  const left = Math.floor((size - src.width) / 2);
  const top = Math.floor((size - src.height) / 2);
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const from = (y * src.width + x) * 4;
      if ((src.data[from + 3] ?? 0) === 0) continue;
      data.set(src.data.subarray(from, from + 4), ((top + y) * size + left + x) * 4);
    }
  }
  return { width: size, height: size, data };
}

/**
 * An `.ico` file holding PNG images (supported by every current browser), one directory entry
 * per image, smallest first.
 */
export function encodeIco(images: readonly { readonly size: number; readonly png: Uint8Array }[]) {
  const header = 6;
  const entry = 16;
  let offset = header + entry * images.length;
  const total = offset + images.reduce((sum, { png }) => sum + png.length, 0);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // type: icon
  view.setUint16(4, images.length, true);
  images.forEach(({ size, png }, i) => {
    const at = header + i * entry;
    view.setUint8(at, size >= 256 ? 0 : size);
    view.setUint8(at + 1, size >= 256 ? 0 : size);
    view.setUint8(at + 2, 0); // palette colors
    view.setUint8(at + 3, 0); // reserved
    view.setUint16(at + 4, 1, true); // color planes
    view.setUint16(at + 6, 32, true); // bits per pixel
    view.setUint32(at + 8, png.length, true);
    view.setUint32(at + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return out;
}

/** The images inside an `.ico` file written by {@link encodeIco}: size and PNG bytes each. */
export function decodeIco(file: Uint8Array): { size: number; png: Uint8Array }[] {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) {
    throw new Error('Not an .ico file');
  }
  return Array.from({ length: view.getUint16(4, true) }, (_, i) => {
    const at = 6 + i * 16;
    const length = view.getUint32(at + 8, true);
    const offset = view.getUint32(at + 12, true);
    return { size: view.getUint8(at) || 256, png: file.subarray(offset, offset + length) };
  });
}
