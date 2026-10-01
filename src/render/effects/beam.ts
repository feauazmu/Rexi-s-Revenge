import type { BeamView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import type { Color, Surface } from '../surface';
import { fillDisc } from './burst';

/** Outer to inner bands of the Sentencia Firme beam: amber edge, golden glow, white-hot core. */
const BANDS: readonly { readonly color: Color; readonly thickness: number }[] = [
  { color: P.skyPeach, thickness: 5 },
  { color: P.sunYellow, thickness: 3 },
  { color: P.white, thickness: 1 },
];

/** Radius of the flare at the muzzle at full strength, px. */
const MUZZLE_FLARE = 4;

/**
 * A golden beam that thins out as it fades. Drawn as runs of whole-pixel rectangles (the
 * renderer may only fill rectangles), band by band from the outside in.
 */
export function drawBeam(dc: DrawContext, beam: BeamView): void {
  const { surface } = dc;
  for (const band of BANDS) {
    const thickness = Math.round(band.thickness * beam.intensity);
    if (thickness > 0) fillThickLine(surface, beam.from, beam.to, thickness, band.color);
  }
  const flare = MUZZLE_FLARE * beam.intensity;
  fillDisc(surface, beam.from.x, beam.from.y, flare, P.sunYellow);
  fillDisc(surface, beam.from.x, beam.from.y, flare * 0.5, P.white);
}

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * A straight line `thickness` px thick, rasterized along its major axis: one span per column
 * (or row, for steep lines), merging neighbouring spans at the same offset into one rectangle.
 */
export function fillThickLine(
  surface: Surface,
  from: Point,
  to: Point,
  thickness: number,
  color: Color,
): void {
  const steep = Math.abs(to.y - from.y) > Math.abs(to.x - from.x);
  // Work in (major, minor) coordinates; swap back when filling.
  const [a0, b0, a1, b1] = steep ? [from.y, from.x, to.y, to.x] : [from.x, from.y, to.x, to.y];
  const start = Math.round(Math.min(a0, a1));
  const end = Math.round(Math.max(a0, a1));
  const slope = a1 === a0 ? 0 : (b1 - b0) / (a1 - a0);
  const fill = (major: number, minor: number, length: number) => {
    if (steep) surface.fillRect(minor, major, thickness, length, color);
    else surface.fillRect(major, minor, length, thickness, color);
  };

  let runStart = start;
  let runMinor: number | null = null;
  for (let a = start; a <= end; a++) {
    const minor = Math.round(b0 + (a + 0.5 - a0) * slope - thickness / 2);
    if (minor !== runMinor) {
      if (runMinor !== null) fill(runStart, runMinor, a - runStart);
      runStart = a;
      runMinor = minor;
    }
  }
  if (runMinor !== null) fill(runStart, runMinor, end + 1 - runStart);
}
