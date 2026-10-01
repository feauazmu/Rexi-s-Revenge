import { masterPalette, type PaletteColorName } from './palette';
import { defineSprite, TRANSPARENT, type SpriteDef } from './sprite';
import type { Color } from './surface';

/**
 * Compact sprite data for generated art (ADR 0002): palette indices, run-length encoded, in
 * base64. `scripts/art/export_ts.py` writes it for large frames and scene layers; decoding gives
 * an ordinary {@link SpriteDef}, so the renderer's determinism rule is unchanged.
 *
 * Format: row-major runs as byte pairs `(index, length - 1)` (runs of 1..256 pixels, may cross
 * rows); index 0 is transparent, index i is `colors[i - 1]`, a master-palette color name.
 */
export interface EncodedSprite {
  readonly width: number;
  readonly height: number;
  readonly colors: readonly PaletteColorName[];
  readonly data: string;
}

/** Palette keys for decoded sprites: one character per color index (`.` stays transparent). */
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let out = 0;
  for (const char of clean) {
    const digit = BASE64.indexOf(char);
    if (digit < 0) throw new Error(`Invalid base64 character "${char}"`);
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[out++] = (value >> bits) & 0xff;
    }
  }
  return bytes;
}

/** Decodes {@link EncodedSprite} data into a palette-indexed sprite. */
export function decodeSprite(encoded: EncodedSprite): SpriteDef {
  const { width, height, colors, data } = encoded;
  if (colors.length > KEYS.length) throw new Error(`At most ${KEYS.length} colors per sprite`);
  const bytes = fromBase64(data);
  if (bytes.length % 2 !== 0) throw new Error('Sprite data ends in the middle of a run');
  const indices: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const index = bytes[i] ?? 0;
    const run = (bytes[i + 1] ?? 0) + 1;
    if (index > colors.length) throw new Error(`Color index ${index} out of range`);
    for (let k = 0; k < run; k++) indices.push(index);
  }
  if (indices.length !== width * height) {
    throw new Error(`Sprite data holds ${indices.length} pixels, expected ${width * height}`);
  }
  const palette: Record<string, Color> = {};
  colors.forEach((name, i) => {
    palette[KEYS.charAt(i)] = masterPalette[name];
  });
  const rows = Array.from({ length: height }, (_, y) =>
    indices
      .slice(y * width, (y + 1) * width)
      .map((index) => (index === 0 ? TRANSPARENT : KEYS.charAt(index - 1)))
      .join(''),
  );
  return defineSprite(palette, rows);
}
