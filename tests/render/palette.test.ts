import { describe, expect, it } from 'vitest';
import { fonts } from '../../src/render';
import { masterPalette, paletteRamps } from '../../src/render/palette';
import {
  findOffPaletteColors,
  findOffPaletteSpriteColors,
  formatOffPaletteReport,
  isPaletteColor,
  nearestPaletteColor,
} from '../../src/render/palette-audit';
import { defineSprite } from '../../src/render/sprite';
import { expectOnPalette, loadGoldens, SWATCH_LABEL_WIDTH } from '../support/palette';

function luma(color: string): number {
  const value = Number.parseInt(color.slice(1), 16);
  return 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
}

describe('master palette', () => {
  it('has 48 to 56 distinct #rrggbb colors (ADR 0002)', () => {
    const colors = Object.values(masterPalette);
    expect(colors.length).toBeGreaterThanOrEqual(48);
    expect(colors.length).toBeLessThanOrEqual(56);
    for (const color of colors) expect(color).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('lists every ramp dark to light and uses every color in some ramp', () => {
    const used = new Set<string>();
    for (const [ramp, names] of Object.entries(paletteRamps)) {
      const lumas = names.map((name) => luma(masterPalette[name]));
      for (let i = 1; i < lumas.length; i++) {
        expect(lumas[i], `${ramp} step ${i}`).toBeGreaterThan(lumas[i - 1] ?? 0);
      }
      names.forEach((name) => used.add(name));
    }
    expect([...used].sort()).toEqual(Object.keys(masterPalette).sort());
  });

  it('keeps every color name short enough for its swatch label', () => {
    for (const name of Object.keys(masterPalette)) {
      expect(fonts.regular.measure(name), name).toBeLessThanOrEqual(SWATCH_LABEL_WIDTH);
    }
  });
});

describe('palette audit', () => {
  it('reports off-palette pixels with counts, position and nearest color', () => {
    // 3×2: palette white, off-palette red twice, transparent, half-transparent black, black.
    const data = new Uint8ClampedArray([
      0xff, 0xfa, 0xf0, 255, 0xd0, 0x30, 0x30, 255, 0xd0, 0x30, 0x30, 255, 1, 2, 3, 0, 0, 0, 0, 128,
      0, 0, 0, 255,
    ]);
    const report = findOffPaletteColors({ width: 3, height: 2, data });
    expect(report).toEqual([
      { color: '#d03030', count: 2, firstSeen: '1,0', nearest: masterPalette.red3 },
      { color: '#000000@128', count: 1, firstSeen: '1,1', nearest: masterPalette.outline },
    ]);
    expect(formatOffPaletteReport('scene', report)).toContain(
      '2 color(s) not in the master palette',
    );
  });

  it('checks sprite definitions and single colors', () => {
    const onPalette = defineSprite({ a: masterPalette.skin3 }, ['a']);
    const offPalette = defineSprite({ a: masterPalette.skin3, b: '#123456' }, ['ab']);
    expect(findOffPaletteSpriteColors([onPalette])).toEqual([]);
    expect(findOffPaletteSpriteColors([onPalette, offPalette])).toMatchObject([
      { color: '#123456', count: 1, firstSeen: 'key "b"' },
    ]);
    expect(isPaletteColor('#D42C2C')).toBe(true);
    expect(nearestPaletteColor('#fefefe')).toBe(masterPalette.white);
  });

  // TODO(art pass, #24): the existing art predates the master palette, so this is skipped.
  // The art pass remaps every sprite and drawer to `masterPalette` and then enables it
  // (`it.skip` → `it`): any off-palette color in a golden frame then fails with a report
  // naming the color, where it first appears and its nearest palette color.
  it.skip('every golden frame uses only master-palette colors', async () => {
    for (const { name, image } of await loadGoldens()) expectOnPalette(name, image);
  });
});
