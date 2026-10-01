import type { Color } from '../surface';

/**
 * Small helpers for editing palette-indexed pixel grids (rows of palette keys, `.` =
 * transparent) before they become sprites. Used to derive animation variants from one drawing.
 */

export type Rows = readonly string[];

export interface Layer {
  readonly rows: Rows;
  /** Top-left of the layer inside the composed grid. */
  readonly x: number;
  readonly y: number;
}

/** Stacks layers back to front into one `width`×`height` grid (pixels outside are clipped). */
export function composeRows(width: number, height: number, layers: readonly Layer[]): string[] {
  const grid = Array.from({ length: height }, () => Array<string>(width).fill('.'));
  for (const layer of layers) {
    layer.rows.forEach((row, ry) => {
      const line = grid[layer.y + ry];
      if (!line) return;
      for (let rx = 0; rx < row.length; rx++) {
        const key = row.charAt(rx);
        const gx = layer.x + rx;
        if (key !== '.' && gx >= 0 && gx < width) line[gx] = key;
      }
    });
  }
  return grid.map((line) => line.join(''));
}

/** Shifts each row sideways by `dx(rowIndex)` pixels (positive = right), keeping the width. */
export function shearRows(rows: Rows, dx: (row: number) => number): string[] {
  return rows.map((row, y) => {
    const shift = dx(y);
    if (shift === 0) return row;
    const pad = '.'.repeat(Math.abs(shift));
    return shift > 0 ? (pad + row).slice(0, row.length) : (row + pad).slice(-row.length);
  });
}

/**
 * Widens the silhouette of the given rows by `amount` pixels on each side, keeping the outline
 * on the outside (used to flare the robe's hem).
 */
export function flareRows(rows: Rows, amount: (row: number) => number): string[] {
  return rows.map((row, y) => {
    const n = amount(y);
    const first = row.search(/[^.]/);
    if (n <= 0 || first < 0) return row;
    const last = row.length - 1 - Array.from(row).reverse().join('').search(/[^.]/);
    const chars = Array.from(row);
    const inner = (i: number): string => (chars[i] === 'k' ? 'r' : (chars[i] ?? 'r'));
    const leftFill = inner(first + 1);
    const rightFill = inner(last - 1);
    for (let i = 1; i <= n; i++) {
      if (first - i >= 0) chars[first - i] = i === n ? 'k' : leftFill;
      if (last + i < chars.length) chars[last + i] = i === n ? 'k' : rightFill;
    }
    if (first - n >= 0) chars[first] = leftFill;
    if (last + n < chars.length) chars[last] = rightFill;
    return chars.join('');
  });
}

/** Replaces palette keys (e.g. to swap which leg is in front). */
export function recolorRows(rows: Rows, map: Readonly<Record<string, string>>): string[] {
  return rows.map((row) =>
    Array.from(row)
      .map((key) => map[key] ?? key)
      .join(''),
  );
}

/** Mixes every color of a palette `amount` (0..1) of the way toward `target`. */
export function tintPalette<K extends string>(
  palette: Readonly<Record<K, Color>>,
  target: Color,
  amount: number,
  keep: readonly K[] = [],
): Record<K, Color> {
  const channel = (color: Color, i: number): number =>
    parseInt(color.slice(1 + i * 2, 3 + i * 2), 16);
  const hex = (n: number): string => Math.round(n).toString(16).padStart(2, '0');
  const out = {} as Record<K, Color>;
  for (const key of Object.keys(palette) as K[]) {
    const color = palette[key];
    if (keep.includes(key)) {
      out[key] = color;
      continue;
    }
    const mixed = [0, 1, 2].map(
      (i) => channel(color, i) + (channel(target, i) - channel(color, i)) * amount,
    );
    out[key] = `#${mixed.map(hex).join('')}`;
  }
  return out;
}
