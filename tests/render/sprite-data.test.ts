import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { masterPalette, type PaletteColorName } from '../../src/render/palette';
import { defineSprite, rasterizeSprite } from '../../src/render/sprite';
import { decodeSprite, encodeSprite, type EncodedSprite } from '../../src/render/sprite-data';

interface Fixture {
  readonly encoded: EncodedSprite;
  readonly codes: Readonly<Record<string, PaletteColorName>>;
  readonly rows: readonly string[];
}

/** Written by the Python exporter (scripts/art/export_ts.py) from a version C frame. */
const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/art/rexi-idle.json', import.meta.url), 'utf8'),
) as Fixture;

describe('sprite data (generated art)', () => {
  it('decodes the Python exporter’s RLE into the same pixels as its pixel-text rows', () => {
    const decoded = decodeSprite(fixture.encoded);
    const palette = Object.fromEntries(
      Object.entries(fixture.codes).map(([code, name]) => [code, masterPalette[name]]),
    );
    const expected = defineSprite(palette, fixture.rows);
    expect(decoded.width).toBe(expected.width);
    expect(decoded.height).toBe(expected.height);
    expect(rasterizeSprite(decoded)).toEqual(rasterizeSprite(expected));
  });

  it('encodes back to the exporter’s exact data', () => {
    expect(encodeSprite(decodeSprite(fixture.encoded))).toEqual(fixture.encoded);
  });

  it('round-trips runs longer than 256 pixels and transparent edges', () => {
    const wide = defineSprite({ a: masterPalette.skyIndigo, b: masterPalette.outline }, [
      `${'a'.repeat(300)}..`,
      `b${'.'.repeat(301)}`,
    ]);
    const encoded = encodeSprite(wide);
    expect(encoded.colors).toEqual(['skyIndigo', 'outline']);
    expect(rasterizeSprite(decodeSprite(encoded))).toEqual(rasterizeSprite(wide));
  });

  it('rejects data that does not fill the sprite or colors off the palette', () => {
    expect(() => decodeSprite({ ...fixture.encoded, width: fixture.encoded.width + 1 })).toThrow(
      /pixels, expected/,
    );
    expect(() => encodeSprite(defineSprite({ x: '#123456' }, ['x']))).toThrow(/master-palette/);
  });
});
