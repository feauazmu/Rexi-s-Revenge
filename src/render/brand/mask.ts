/**
 * Boolean pixel masks for building large code-drawn art (the logo, the app icons): parsing
 * from `#`/`.` rows, EPX-style upscaling, growing (outlines) and shifting (extrusion).
 * Pure data, no drawing.
 */

export interface Mask {
  readonly width: number;
  readonly height: number;
  /** Row-major, 1 = set. */
  readonly bits: Uint8Array;
}

export function emptyMask(width: number, height: number): Mask {
  return { width, height, bits: new Uint8Array(width * height) };
}

/** True when (x, y) is inside the mask and set. */
export function maskAt(mask: Mask, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return false;
  return mask.bits[y * mask.width + x] === 1;
}

export function setMask(mask: Mask, x: number, y: number, on = true): void {
  if (x < 0 || y < 0 || x >= mask.width || y >= mask.height) return;
  mask.bits[y * mask.width + x] = on ? 1 : 0;
}

/** A mask from rows of `#` (set) and `.` (clear). All rows must have the same length. */
export function parseMask(rows: readonly string[]): Mask {
  const width = rows[0]?.length ?? 0;
  const mask = emptyMask(width, rows.length);
  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`Mask row ${y} is ${row.length} wide, not ${width}`);
    for (let x = 0; x < width; x++) if (row.charAt(x) === '#') setMask(mask, x, y);
  });
  return mask;
}

/**
 * Scale2x / Scale3x (EPX): an integer upscale that turns one-cell stair steps into clean
 * diagonals and chamfers convex corners, so chunky letterforms authored on a coarse grid
 * come out smooth instead of blocky. Factors other than 2 and 3 fall back to plain blocks.
 */
export function upscaleMask(mask: Mask, factor: number): Mask {
  const out = emptyMask(mask.width * factor, mask.height * factor);
  const at = (x: number, y: number) => maskAt(mask, x, y);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      const [a, b, c, d, e, f, g, h, i] = [
        at(x - 1, y - 1),
        at(x, y - 1),
        at(x + 1, y - 1),
        at(x - 1, y),
        at(x, y),
        at(x + 1, y),
        at(x - 1, y + 1),
        at(x, y + 1),
        at(x + 1, y + 1),
      ];
      let cells: boolean[];
      if (factor === 2) {
        cells = [
          d === b && b !== f && d !== h ? d : e,
          b === f && b !== d && f !== h ? f : e,
          d === h && d !== b && h !== f ? d : e,
          h === f && d !== h && b !== f ? f : e,
        ];
      } else if (factor === 3) {
        const db = d === b && d !== h && b !== f;
        const bf = b === f && b !== d && f !== h;
        const dh = d === h && d !== b && h !== f;
        const hf = h === f && d !== h && b !== f;
        cells = [
          db ? d : e,
          (db && e !== c) || (bf && e !== a) ? b : e,
          bf ? f : e,
          (db && e !== g) || (dh && e !== a) ? d : e,
          e,
          (bf && e !== i) || (hf && e !== c) ? f : e,
          dh ? d : e,
          (dh && e !== i) || (hf && e !== g) ? h : e,
          hf ? f : e,
        ];
      } else {
        cells = Array<boolean>(factor * factor).fill(e);
      }
      cells.forEach((on, k) => {
        if (on) setMask(out, x * factor + (k % factor), y * factor + Math.floor(k / factor));
      });
    }
  }
  return out;
}

/** Copies `src` into `dst` with its top-left corner at (x, y) (OR: never clears). */
export function blitMask(dst: Mask, src: Mask, x: number, y: number): void {
  for (let sy = 0; sy < src.height; sy++) {
    for (let sx = 0; sx < src.width; sx++) if (maskAt(src, sx, sy)) setMask(dst, x + sx, y + sy);
  }
}

/**
 * Grows a mask by `r` pixels. The neighborhood is a diamond widened by one step, so a 2 px
 * outline has softly cut corners instead of square ones.
 */
export function growMask(mask: Mask, r: number): Mask {
  const out = emptyMask(mask.width, mask.height);
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (!maskAt(mask, x, y)) continue;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dy) <= r + 1) setMask(out, x + dx, y + dy);
        }
      }
    }
  }
  return out;
}

/** Union of `mask` shifted by (k·dx, k·dy) for k = 1 … steps (a solid extrusion). */
export function extrudeMask(mask: Mask, steps: number, dx: number, dy: number): Mask {
  const out = emptyMask(mask.width, mask.height);
  for (let k = 1; k <= steps; k++) {
    const ox = Math.round(k * dx);
    const oy = Math.round(k * dy);
    for (let y = 0; y < mask.height; y++) {
      for (let x = 0; x < mask.width; x++) if (maskAt(mask, x, y)) setMask(out, x + ox, y + oy);
    }
  }
  return out;
}

/** Pixels set in `a` or `b`. Both masks must have the same size. */
export function unionMask(a: Mask, b: Mask): Mask {
  const out = emptyMask(a.width, a.height);
  out.bits.forEach((_, i) => (out.bits[i] = (a.bits[i] ?? 0) | (b.bits[i] ?? 0)));
  return out;
}

/** Fills clear pixels that cannot reach the mask's border without crossing set pixels. */
export function fillHoles(mask: Mask): Mask {
  const { width, height } = mask;
  const outside = new Uint8Array(width * height);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (outside[i] || mask.bits[i]) return;
    outside[i] = 1;
    stack.push(i);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }
  while (stack.length > 0) {
    const i = stack.pop() ?? 0;
    const x = i % width;
    const y = (i - x) / width;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  const out = emptyMask(width, height);
  out.bits.forEach((_, i) => (out.bits[i] = outside[i] ? 0 : 1));
  return out;
}
