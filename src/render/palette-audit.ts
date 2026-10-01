import { masterPalette } from './palette';
import type { SpriteDef } from './sprite';
import type { Color } from './surface';

/** One color found outside the master palette, with how often it occurs and its nearest match. */
export interface OffPaletteColor {
  readonly color: Color;
  /** Pixels (for images) or palette entries (for sprites) using it. */
  readonly count: number;
  /** Where it was found: the first pixel `x,y`, or the sprite palette key. */
  readonly firstSeen: string;
  readonly nearest: Color;
}

const paletteColors: ReadonlySet<string> = new Set(
  Object.values(masterPalette).map((color) => color.toLowerCase()),
);

/** True when `color` (`#rrggbb`, any case) is in the master palette. */
export function isPaletteColor(color: string): boolean {
  return paletteColors.has(color.toLowerCase());
}

/**
 * Lists the opaque colors of straight-alpha RGBA pixels that are not in the master palette,
 * most frequent first. Transparent pixels are ignored; partially transparent pixels are
 * reported, since the renderer must not blend.
 */
export function findOffPaletteColors(image: {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}): OffPaletteColor[] {
  const found = new Map<string, { count: number; firstSeen: string }>();
  for (let i = 0; i < image.data.length; i += 4) {
    const alpha = image.data[i + 3] ?? 0;
    if (alpha === 0) continue;
    const color = toHex(image.data[i] ?? 0, image.data[i + 1] ?? 0, image.data[i + 2] ?? 0);
    const key = alpha === 255 ? color : `${color}@${alpha}`;
    if (alpha === 255 && paletteColors.has(color)) continue;
    const entry = found.get(key);
    if (entry) entry.count += 1;
    else {
      const pixel = i / 4;
      found.set(key, {
        count: 1,
        firstSeen: `${pixel % image.width},${Math.floor(pixel / image.width)}`,
      });
    }
  }
  return report(found);
}

/** Lists the colors of sprite definitions' palettes that are not in the master palette. */
export function findOffPaletteSpriteColors(sprites: Iterable<SpriteDef>): OffPaletteColor[] {
  const found = new Map<string, { count: number; firstSeen: string }>();
  for (const sprite of sprites) {
    for (const [key, color] of Object.entries(sprite.palette)) {
      const hex = color.toLowerCase();
      if (paletteColors.has(hex)) continue;
      const entry = found.get(hex);
      if (entry) entry.count += 1;
      else found.set(hex, { count: 1, firstSeen: `key "${key}"` });
    }
  }
  return report(found);
}

/**
 * The perceptually nearest master-palette color (OKLab distance). For tooling and the art
 * pass's remapping; game code names its colors instead.
 */
export function nearestPaletteColor(color: string): Color {
  const target = oklab(color);
  let best: Color = masterPalette.outline;
  let bestDistance = Infinity;
  for (const candidate of Object.values(masterPalette)) {
    const [l, a, b] = oklab(candidate);
    const distance = (l - target[0]) ** 2 + (a - target[1]) ** 2 + (b - target[2]) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = candidate;
    }
  }
  return best;
}

/** A readable summary of an audit, one line per color, for test failure messages. */
export function formatOffPaletteReport(label: string, colors: readonly OffPaletteColor[]): string {
  if (colors.length === 0) return `${label}: all colors are in the master palette`;
  const lines = colors.map(
    ({ color, count, firstSeen, nearest }) =>
      `  ${color} ×${count} (first at ${firstSeen}), nearest palette color ${nearest}`,
  );
  return [`${label}: ${colors.length} color(s) not in the master palette`, ...lines].join('\n');
}

function report(found: Map<string, { count: number; firstSeen: string }>): OffPaletteColor[] {
  return [...found]
    .map(([key, { count, firstSeen }]) => {
      const color = key.slice(0, 7) as Color;
      return { color: key as Color, count, firstSeen, nearest: nearestPaletteColor(color) };
    })
    .sort((a, b) => b.count - a.count || a.color.localeCompare(b.color));
}

function toHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function oklab(color: string): readonly [number, number, number] {
  const value = Number.parseInt(color.slice(1, 7), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
