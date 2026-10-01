/** Test helpers for the master palette: the swatch sheet and the off-palette color check. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { drawText, fonts, type Color, type TextTarget } from '../../src/render';
import { masterPalette, type PaletteColorName } from '../../src/render/palette';
import { findOffPaletteColors, formatOffPaletteReport } from '../../src/render/palette-audit';
import { decodePng, GOLDEN_DIR, type RgbaImage } from '../golden/golden';

const COLUMNS = 8;
const CELL_WIDTH = 80;
const CELL_HEIGHT = 51;
const SWATCH_HEIGHT = 30;

/** Widest a color name may be to fit under its swatch. */
export const SWATCH_LABEL_WIDTH = CELL_WIDTH - 4;

/** Light text over dark swatches and dark text over light ones, both from the palette. */
function inkOn(color: Color): Color {
  const value = Number.parseInt(color.slice(1), 16);
  const luma = 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255);
  return luma < 128 ? masterPalette.white : masterPalette.outline;
}

/**
 * Draws every master-palette color as a labeled swatch (hex inside, name below) in an 8×7
 * grid over `night`, filling a 640×360 frame. Uses only palette colors.
 */
export function drawPaletteSheet(target: TextTarget): void {
  const names = Object.keys(masterPalette) as PaletteColorName[];
  names.forEach((name, i) => {
    const color = masterPalette[name];
    const x = (i % COLUMNS) * CELL_WIDTH + 2;
    const y = Math.floor(i / COLUMNS) * CELL_HEIGHT;
    target.surface.fillRect(x - 1, y + 1, CELL_WIDTH - 2, SWATCH_HEIGHT + 2, masterPalette.outline);
    target.surface.fillRect(x, y + 2, CELL_WIDTH - 4, SWATCH_HEIGHT, color);
    drawText(target, fonts.regular, color, x + 3, y + 11, { color: inkOn(color) });
    drawText(target, fonts.regular, name, x + 1, y + SWATCH_HEIGHT + 4, {
      color: masterPalette.marble,
    });
  });
}

/** Throws with a per-color report unless every opaque pixel of `image` is a palette color. */
export function expectOnPalette(label: string, image: RgbaImage): void {
  const offPalette = findOffPaletteColors(image);
  if (offPalette.length > 0) throw new Error(formatOffPaletteReport(label, offPalette));
}

/** Every committed golden image, decoded, by name. */
export async function loadGoldens(): Promise<{ name: string; image: RgbaImage }[]> {
  const files = readdirSync(GOLDEN_DIR).filter((file) => file.endsWith('.png'));
  return Promise.all(
    files.map(async (file) => ({
      name: file.replace(/\.png$/, ''),
      image: await decodePng(readFileSync(join(GOLDEN_DIR, file))),
    })),
  );
}
