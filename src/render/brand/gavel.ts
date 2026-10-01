/**
 * A judge's gavel rasterized from shapes at any angle (ADR 0001: drawn in code), for the logo
 * and the app icons. Each pixel is mapped into the gavel's own frame (along the handle and
 * along the head) and shaded as a lit cylinder with master-palette wood and brass ramps, so
 * the result stays crisp instead of resampling a bitmap.
 */
import type { PaletteColorName } from '../palette';
import type { PixelGrid } from '../pixel-grid';
import { growMask, maskAt, emptyMask } from './mask';

type Ink = PaletteColorName;

export interface GavelSpec {
  /** Center of the head, px. */
  readonly cx: number;
  readonly cy: number;
  /** Unit vector from the head toward the handle's butt (screen coordinates, y down). */
  readonly dir: { readonly x: number; readonly y: number };
  readonly headHalfLength: number;
  readonly headRadius: number;
  /** Length of each wide rim at the head's ends, px. */
  readonly rimDepth: number;
  /** Width of the brass ring inside each rim, px (0 for none). */
  readonly ringWidth: number;
  readonly handleLength: number;
  readonly handleRadius: number;
  /** Black outline width around the whole gavel, px. */
  readonly outline: number;
}

/** Unit vector toward the light: upper left and toward the viewer. */
const LIGHT = normalize3(-0.5, -0.75, 0.6);

function normalize3(x: number, y: number, z: number): readonly [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

/** Brightness of a cylinder point whose cross-section coordinate is s ∈ [-1, 1] along `n`. */
function cylinderLight(s: number, n: { readonly x: number; readonly y: number }): number {
  const z = Math.sqrt(Math.max(0, 1 - s * s));
  return n.x * s * LIGHT[0] + n.y * s * LIGHT[1] + z * LIGHT[2];
}

function woodInk(b: number): Ink {
  if (b > 0.9) return 'hairLight';
  if (b > 0.7) return 'leather4';
  if (b > 0.35) return 'leather3';
  if (b > 0.05) return 'leather2';
  return 'leather1';
}

function brassInk(b: number): Ink {
  if (b > 0.9) return 'light';
  if (b > 0.7) return 'gold';
  if (b > 0.35) return 'brass';
  return 'leather3';
}

type Zone = 'face' | 'rim' | 'groove' | 'ring' | 'body';

/** The head's profile from a striking face inward: face edge, rim, groove, ring, body. */
function zoneAt(g: GavelSpec, fromEnd: number): Zone {
  if (fromEnd < 1) return 'face';
  if (fromEnd < g.rimDepth) return 'rim';
  if (fromEnd < g.rimDepth + 1) return 'groove';
  if (fromEnd < g.rimDepth + 1 + g.ringWidth) return 'ring';
  return 'body';
}

/** Paints the gavel (outline first, so it sits on top of whatever is already in `grid`). */
export function paintGavel(grid: PixelGrid<Ink>, g: GavelSpec): void {
  const { width, height } = grid;
  const dir = g.dir;
  const axis = { x: dir.y, y: -dir.x }; // along the head
  const body = emptyMask(width, height);
  const inks = new Map<number, Ink>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - g.cx;
      const py = y + 0.5 - g.cy;
      const u = px * dir.x + py * dir.y; // toward the butt
      const v = px * axis.x + py * axis.y; // along the head
      const av = Math.abs(v);
      let ink: Ink | null = null;
      if (av <= g.headHalfLength) {
        const zone = zoneAt(g, g.headHalfLength - av);
        // Wide rims, a ringed shoulder and a slimmer waist: the classic gavel silhouette.
        const r =
          zone === 'face' || zone === 'rim'
            ? g.headRadius + 1
            : zone === 'body'
              ? g.headRadius - 1
              : g.headRadius;
        if (Math.abs(u) <= r) {
          const b = cylinderLight(u / r, dir);
          if (zone === 'face') ink = b > 0.6 ? 'leather3' : 'leather2';
          else if (zone === 'rim') ink = woodInk(b + 0.08);
          else if (zone === 'groove') ink = b > 0.7 ? 'leather2' : 'leather1';
          else if (zone === 'ring') ink = brassInk(b);
          else if (Math.abs(u / r + 0.5) < 0.12)
            ink = 'hairLight'; // varnish glint
          else ink = woodInk(b);
        }
      }
      if (ink === null && u > 0 && u <= g.headRadius + g.handleLength) {
        const butt = u > g.headRadius + g.handleLength - g.handleRadius * 2;
        const collar = u < g.headRadius + 3;
        const r = butt || collar ? g.handleRadius + 1 : g.handleRadius;
        if (av <= r) {
          const b = cylinderLight(v / r, axis);
          ink = collar ? brassInk(b) : woodInk(b + 0.1);
        }
      }
      if (ink !== null) {
        body.bits[y * width + x] = 1;
        inks.set(y * width + x, ink);
      }
    }
  }
  const outline = growMask(body, g.outline);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) if (maskAt(outline, x, y)) grid.px(x, y, 'outline');
  }
  for (const [i, ink] of inks) grid.px(i % width, Math.floor(i / width), ink);
}
