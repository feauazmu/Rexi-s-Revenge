/**
 * The encoder for `src/render/sprite-data.ts`, for tests only: the game ships just the decoder,
 * and the art pipeline encodes in Python (`scripts/art/export_ts.py`).
 */
import { masterPalette, type PaletteColorName } from '../../src/render/palette';
import { TRANSPARENT, type SpriteDef } from '../../src/render/sprite';
import { BASE64, type EncodedSprite } from '../../src/render/sprite-data';

function toBase64(bytes: readonly number[]): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]];
    const n = (a << 16) | (b << 8) | c;
    const chars = [18, 12, 6, 0].map((shift) => BASE64.charAt((n >> shift) & 63));
    const kept = i + 1 >= bytes.length ? 2 : i + 2 >= bytes.length ? 3 : 4;
    text += chars.slice(0, kept).join('') + '='.repeat(4 - kept);
  }
  return text;
}

const NAME_OF_COLOR = new Map<string, PaletteColorName>(
  (Object.keys(masterPalette) as PaletteColorName[]).map((name) => [masterPalette[name], name]),
);

/** Encodes a sprite drawn with master-palette colors (the inverse of {@link decodeSprite}). */
export function encodeSprite(sprite: SpriteDef): EncodedSprite {
  const colors: PaletteColorName[] = [];
  const indices: number[] = [];
  for (const row of sprite.rows) {
    for (const key of row) {
      if (key === TRANSPARENT) {
        indices.push(0);
        continue;
      }
      const color = sprite.palette[key]?.toLowerCase() ?? '';
      const name = NAME_OF_COLOR.get(color);
      if (name === undefined) throw new Error(`${color} is not a master-palette color`);
      if (!colors.includes(name)) colors.push(name);
      indices.push(colors.indexOf(name) + 1);
    }
  }
  const bytes: number[] = [];
  for (let i = 0; i < indices.length;) {
    const value = indices[i] ?? 0;
    let run = 1;
    while (i + run < indices.length && indices[i + run] === value && run < 256) run++;
    bytes.push(value, run - 1);
    i += run;
  }
  return { width: sprite.width, height: sprite.height, colors, data: toBase64(bytes) };
}
