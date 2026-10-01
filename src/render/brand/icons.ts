/**
 * The site icons (favicon, Apple touch icon, web app manifest icons), drawn in code like the
 * rest of the art (ADR 0001) and exported to PNG files by `scripts/share-preview/`.
 *
 * - Favicons (16, 32, 48 px): the gavel alone on transparency, with a black outline so it
 *   reads on light and dark browser tabs.
 * - App icon (48×48 art, scaled up by whole factors and padded with its background): the
 *   32 px gavel over a striped synthwave sun on the night sky, opaque, with a plain `night`
 *   margin so platforms can round or mask its corners.
 */
import { masterPalette, type PaletteColorName } from '../palette';
import { createPixelGrid, type PixelGrid } from '../pixel-grid';
import type { SpriteDef } from '../sprite';
import type { Color } from '../surface';

type Ink = PaletteColorName;

/** Favicon sizes in px. */
export const FAVICON_SIZES = [16, 32, 48] as const;
export type FaviconSize = (typeof FAVICON_SIZES)[number];

function woodTone(b: number): Ink {
  if (b > 0.85) return 'hairLight';
  if (b > 0.6) return 'leather4';
  if (b > 0.3) return 'leather3';
  if (b > 0.05) return 'leather2';
  return 'leather1';
}

/**
 * A gavel built on the 45° pixel lattice (s = x + y runs along the head, t = x − y along the
 * handle), so every edge is a clean one-pixel stair step even at 16 px, where the free-angle
 * rasterizer would leave ragged edges. Head up-right, handle down-left; lit from the upper left.
 */
function latticeGavel(size: FaviconSize): SpriteDef {
  const k = size / 16;
  const cx = Math.round(10 * k);
  const cy = Math.round(5 * k);
  const L = 7 * k; // head half-length (s units)
  const T = 3 * k; // head half-thickness (t units)
  const rim = 2 * k; // rim length at each end (s units)
  const r = k; // handle half-width (s units)
  const handleEnd = -T - 13 * k; // the butt (t)
  const body = createPixelGrid(size, size, masterPalette);
  const solid = new Set<number>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const s = x + y - (cx + cy);
      const t = x - y - (cx - cy);
      let ink: Ink | null = null;
      const fromEnd = L - Math.abs(s);
      if (fromEnd >= 0) {
        const isRim = fromEnd < rim;
        const half = isRim ? T + 1 : T;
        if (Math.abs(t) <= half) {
          const tn = t / half;
          // The upper-left striking face catches the light, the lower-right one is in shade.
          const b = 0.55 * Math.sqrt(1 - tn * tn) + 0.4 * tn + (isRim ? 0.08 : 0);
          if (fromEnd === 0) ink = s < 0 ? 'leather3' : 'leather2';
          else if (Math.round(fromEnd) === Math.round(rim)) ink = b > 0.6 ? 'gold' : 'brass';
          else ink = woodTone(b);
        }
      }
      if (ink === null && t < -T && t >= handleEnd) {
        const knob = t < handleEnd + 2 * k;
        const half = knob ? r + 1 : r;
        if (Math.abs(s) <= half) {
          const sn = s / (half + 0.5);
          ink = woodTone(0.6 * Math.sqrt(1 - sn * sn) - 0.35 * sn + 0.15);
        }
      }
      if (ink !== null) {
        body.px(x, y, ink);
        solid.add(y * size + x);
      }
    }
  }
  // Black outline all around (8-neighbourhood; 2 px from 48 px up).
  const grid = createPixelGrid(size, size, masterPalette);
  const reach = size >= 48 ? 2 : 1;
  for (const i of solid) {
    const x = i % size;
    const y = (i - x) / size;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= reach + 1) grid.px(x + dx, y + dy, 'outline');
      }
    }
  }
  for (const i of solid) {
    const x = i % size;
    const y = (i - x) / size;
    const ink = body.get(x, y);
    if (ink) grid.px(x, y, ink);
  }
  return grid.toSprite();
}

const favicons = new Map<FaviconSize, SpriteDef>();

/** The favicon at `size` px: the gavel on transparency. */
export function favicon(size: FaviconSize): SpriteDef {
  let sprite = favicons.get(size);
  if (!sprite) {
    sprite = latticeGavel(size);
    favicons.set(size, sprite);
  }
  return sprite;
}

/** Width and height of the app icon art, px. */
export const APP_ICON_ART = 48;

/** The background around and behind the app icon art (also the manifest background). */
export const APP_ICON_BACKGROUND: Color = masterPalette.night;

/** Synthwave sun: center, radius, stripe colors top to bottom and the sky gaps between them. */
const SUN = { cx: 24, cy: 26, r: 18 } as const;
const SUN_BANDS: readonly (readonly [until: number, ink: Ink])[] = [
  [14, 'light'],
  [21, 'gold'],
  [28, 'skyOrange'],
  [35, 'coral'],
  [48, 'skyRose'],
];
const SUN_GAPS: ReadonlySet<number> = new Set([27, 31, 32, 36, 37, 38, 41, 42, 43]);

/** Copies a sprite's opaque pixels onto a grid of master-palette names at (x, y). */
function stamp(grid: PixelGrid<Ink>, sprite: SpriteDef, x: number, y: number): void {
  const nameOf = new Map<string, Ink>(
    Object.entries(masterPalette).map(([name, color]) => [color, name as Ink] as const),
  );
  sprite.rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const color = sprite.palette[row.charAt(dx)];
      const name = color && nameOf.get(color);
      if (name) grid.px(x + dx, y + dy, name);
    }
  });
}

let appIcon: SpriteDef | null = null;

/** The opaque app icon art, APP_ICON_ART px square. */
export function appIconArt(): SpriteDef {
  if (appIcon) return appIcon;
  const n = APP_ICON_ART;
  const grid = createPixelGrid(n, n, masterPalette);
  grid.rect(0, 0, n, n, 'night');
  for (let y = 0; y < n; y++) {
    const dy = y + 0.5 - SUN.cy;
    if (Math.abs(dy) > SUN.r || SUN_GAPS.has(y)) continue;
    const half = Math.sqrt(SUN.r * SUN.r - dy * dy);
    const band = SUN_BANDS.find(([until]) => y < until)?.[1] ?? 'skyRose';
    grid.rect(
      Math.round(SUN.cx - half),
      y,
      Math.round(SUN.cx + half) - Math.round(SUN.cx - half),
      1,
      band,
    );
  }
  stamp(grid, favicon(32), 8, 7);
  appIcon = grid.toSprite();
  return appIcon;
}
