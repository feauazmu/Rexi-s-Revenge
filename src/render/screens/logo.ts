/**
 * The "Rexi's Revenge" logo, built in code from the bitmap font: big capitals with an arcade
 * gradient fill, a chunky dark outline and a 3D extrusion below. Produced once as a sprite.
 */
import { defineSprite, type SpriteDef } from '../sprite';
import { fonts, scaleFont } from '../text';

const LOGO_PALETTE = {
  a: '#fffbe0',
  b: '#ffe066',
  c: '#ffb43a',
  d: '#f2683a',
  k: '#1a1020',
  x: '#7a2850',
  X: '#3e1236',
} as const;

/** Fill bands, top to bottom, as the share of a line's cap height where each one ends. */
const FILL_BANDS: readonly (readonly [end: number, key: string])[] = [
  [0.2, 'a'],
  [0.45, 'b'],
  [0.72, 'c'],
  [1, 'd'],
];

const OUTLINE = 2;
const EXTRUDE = 4;
const LINE_GAP = 3;
/** Capital letters span 7 rows of the regular font, starting 3 rows below the cell top. */
const CAP_TOP = 3;
const CAP_ROWS = 7;

export interface LogoLine {
  readonly text: string;
  /** Whole-number scale of the regular font. */
  readonly scale: number;
}

type Grid = string[][];

/** Builds a logo sprite from lines of capitals (and apostrophes), left-aligned. */
export function buildLogo(lines: readonly LogoLine[]): SpriteDef {
  const fills = lines.map(({ text, scale }) => lineFill(text, scale));
  const textWidth = Math.max(...fills.map((rows) => rows[0]?.length ?? 0));
  const pad = OUTLINE;
  const width = textWidth + pad * 2;
  const textHeight = fills.reduce((h, rows) => h + rows.length, 0) + LINE_GAP * (lines.length - 1);
  const height = textHeight + pad * 2 + EXTRUDE;

  const grid: Grid = Array.from({ length: height }, () => Array<string>(width).fill('.'));
  let top = pad;
  for (const rows of fills) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const key = row.charAt(x);
        if (key !== '.') setCell(grid, pad + x, top + y, key);
      }
    });
    top += rows.length + LINE_GAP;
  }

  const fill = grid.map((row) => row.map((key) => key !== '.'));
  const outlined = dilate(fill, OUTLINE);
  // Extrusion: the outlined shape repeated downward, with a darker bottom edge.
  const extruded = outlined.map((row, y) =>
    row.map((on, x) => {
      if (on) return false;
      for (let k = 1; k <= EXTRUDE; k++) if (outlined[y - k]?.[x]) return true;
      return false;
    }),
  );
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (fill[y]?.[x]) continue;
      if (outlined[y]?.[x]) setCell(grid, x, y, 'k');
      else if (extruded[y]?.[x]) setCell(grid, x, y, extruded[y + 1]?.[x] ? 'x' : 'X');
    }
  }
  return defineSprite(
    LOGO_PALETTE,
    grid.map((row) => row.join('')),
  );
}

/** One line's fill pixels, cropped to the capitals, colored by gradient band. */
function lineFill(text: string, scale: number): string[] {
  const font = scaleFont(fonts.regular, scale);
  const top = CAP_TOP * scale;
  const rows = CAP_ROWS * scale;
  const width = font.measure(text);
  const out: string[][] = Array.from({ length: rows }, () => Array<string>(width).fill('.'));
  let penX = 0;
  for (const char of text) {
    const glyph = font.glyph(char);
    for (let y = 0; y < rows; y++) {
      const row = glyph.rows[top + y] ?? '';
      const band = FILL_BANDS.find(([end]) => (y + 0.5) / rows <= end)?.[1] ?? 'd';
      for (let x = 0; x < row.length; x++) {
        if (row.charAt(x) === '#') setCell(out, penX + x, y, band);
      }
    }
    penX += glyph.width + font.letterSpacing;
  }
  return out.map((row) => row.join(''));
}

/** Grows a mask by `r` pixels in every direction, with cut corners for a rounder outline. */
function dilate(mask: readonly (readonly boolean[])[], r: number): boolean[][] {
  return mask.map((row, y) =>
    row.map((_, x) => {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > r + 1) continue;
          if (mask[y + dy]?.[x + dx]) return true;
        }
      }
      return false;
    }),
  );
}

function setCell(grid: Grid, x: number, y: number, key: string): void {
  const row = grid[y];
  if (row && x >= 0 && x < row.length) row[x] = key;
}
