/**
 * The "Rexi's Revenge" logo (ADR 0001: drawn in code, built once into a palette-indexed sprite).
 *
 * Lockup, back to front: a gavel crossing behind the words (head up and to the right of
 * REXI'S, handle down behind REVENGE); REXI'S in chrome over REVENGE in sunset gold, both
 * custom chunky letterforms (`logo-glyphs.ts`) with a thick black outline, a 3D extrusion
 * down and to the right and a bright highlight band along the top; and a dumbbell with red bumper plates as the
 * underline. Every color is a master-palette color, shaded along its ramp.
 *
 * A shine sweep (a bright diagonal band crossing the letters every few seconds) is a separate
 * overlay sprite per step, drawn over the logo with its phase taken from the view's tick.
 */
import { masterPalette, type PaletteColorName } from '../palette';
import { createPixelGrid, type PixelGrid } from '../pixel-grid';
import { defineSprite, type SpriteBank, type SpriteDef } from '../sprite';
import type { Surface } from '../surface';
import { paintGavel, type GavelSpec } from './gavel';
import { LOGO_GLYPH_ROWS, LOGO_GLYPHS } from './logo-glyphs';
import {
  blitMask,
  emptyMask,
  extrudeMask,
  fillHoles,
  growMask,
  maskAt,
  parseMask,
  upscaleMask,
  unionMask,
  type Mask,
} from './mask';

type Ink = PaletteColorName;
type Grid = PixelGrid<Ink>;

// ---------------------------------------------------------------------------------------------
// Layout (logo pixels).

export const LOGO_WIDTH = 236;
export const LOGO_HEIGHT = 92;

const OUTLINE = 2;

interface WordSpec {
  readonly text: string;
  /** EPX upscale factor of the 10-row glyph grid: cap height is 10 × scale. */
  readonly scale: 2 | 3;
  /** Top-left of the letter faces. */
  readonly x: number;
  readonly y: number;
  /** Extrusion steps (px) down and to the right. */
  readonly depth: number;
  readonly style: FaceStyle;
}

const REXIS: WordSpec = { text: "REXI'S", scale: 2, x: 19, y: 8, depth: 3, style: 'chrome' };
const REVENGE: WordSpec = { text: 'REVENGE', scale: 3, x: 19, y: 34, depth: 5, style: 'gold' };

/** Gavel: head center, axis angle and sizes. The handle runs down-left behind REVENGE. */
const GAVEL: GavelSpec = {
  cx: 180,
  cy: 21,
  dir: { x: -0.4, y: 0.9165 },
  headHalfLength: 26,
  headRadius: 9.5,
  rimDepth: 4,
  ringWidth: 2,
  handleLength: 40,
  handleRadius: 3,
  outline: OUTLINE,
};

/** Dumbbell underline: outer ends of the bar and its center row (the plates are in paintDumbbell). */
const DUMBBELL = {
  x0: 2,
  x1: 233,
  cy: 75,
  barRadius: 2,
} as const;

// ---------------------------------------------------------------------------------------------
// Letters.

/** One word's face mask at its upscale factor: glyphs with one grid cell between letters. */
function wordMask(text: string, scale: number): Mask {
  const glyphs = Array.from(text, (char) => {
    const rows = LOGO_GLYPHS[char];
    if (!rows) throw new Error(`The logo has no glyph for "${char}"`);
    return parseMask(rows);
  });
  const cells = glyphs.reduce((w, g) => w + g.width, 0) + glyphs.length - 1;
  const coarse = emptyMask(cells, LOGO_GLYPH_ROWS);
  let pen = 0;
  for (const glyph of glyphs) {
    blitMask(coarse, glyph, pen, 0);
    pen += glyph.width + 1;
  }
  // Upscale each glyph alone so the EPX rules never bridge neighbouring letters.
  const out = emptyMask(cells * scale, LOGO_GLYPH_ROWS * scale);
  pen = 0;
  for (const glyph of glyphs) {
    blitMask(out, upscaleMask(glyph, scale), pen * scale, 0);
    pen += glyph.width + 1;
  }
  return out;
}

type FaceStyle = 'gold' | 'chrome';

/**
 * Face color by height through the cap (0 top … 1 bottom): a bright highlight band at the
 * top, a hard horizon just below the middle and a darker lower half that brightens again at
 * the bottom (reflected light), like an arcade marquee.
 */
const FACE_BANDS: Readonly<Record<FaceStyle, readonly (readonly [end: number, ink: Ink])[]>> = {
  gold: [
    [0.12, 'light'],
    [0.5, 'gold'],
    [0.56, 'brass'],
    [0.88, 'skyOrange'],
    [1, 'gold'],
  ],
  // Chrome: the sky reflected above a dark horizon, steel below it.
  chrome: [
    [0.12, 'white'],
    [0.3, 'neonCyan'],
    [0.5, 'glass3'],
    [0.56, 'robe'],
    [0.82, 'grey2'],
    [1, 'grey3'],
  ],
};

/** Extrusion colors: [faces under horizontal edges, faces beside vertical edges]. */
const EXTRUSION: Readonly<Record<FaceStyle, readonly [Ink, Ink]>> = {
  gold: ['red2', 'red1'],
  chrome: ['robeSheen', 'robe'],
};

interface PlacedWord {
  readonly spec: WordSpec;
  /** Face pixels in logo coordinates. */
  readonly face: Mask;
}

function placeWord(spec: WordSpec): PlacedWord {
  const local = wordMask(spec.text, spec.scale);
  const face = emptyMask(LOGO_WIDTH, LOGO_HEIGHT);
  blitMask(face, local, spec.x, spec.y);
  return { spec, face };
}

function paintWord(grid: Grid, { spec, face }: PlacedWord): void {
  const dx = 0.5;
  const extrusion = extrudeMask(face, spec.depth, dx, 1);
  const solid = fillHoles(growMask(unionMask(face, extrusion), OUTLINE));
  const [under, beside] = EXTRUSION[spec.style];
  const capHeight = LOGO_GLYPH_ROWS * spec.scale;
  for (let y = 0; y < LOGO_HEIGHT; y++) {
    for (let x = 0; x < LOGO_WIDTH; x++) {
      if (!maskAt(solid, x, y)) continue;
      if (maskAt(face, x, y)) {
        grid.px(x, y, faceInk(face, spec.style, x, y, (y - spec.y + 0.5) / capHeight));
      } else if (maskAt(extrusion, x, y)) {
        let fromAbove = false;
        for (let k = 1; k <= spec.depth && !fromAbove; k++) fromAbove = maskAt(face, x, y - k);
        grid.px(x, y, fromAbove ? under : beside);
      } else {
        grid.px(x, y, 'outline');
      }
    }
  }
}

/** The ramps a face style's bevel steps along (dark to light). */
const RAMPS: Readonly<Record<FaceStyle, readonly (readonly Ink[])[]>> = {
  gold: [['red3', 'skyOrange', 'brass', 'gold', 'light', 'white']],
  chrome: [
    ['glass2', 'glass3', 'neonCyan', 'white'],
    ['grey1', 'grey2', 'grey3', 'marble'],
  ],
};

/** `ink` moved `by` steps along its ramp (unchanged if it is on none, e.g. the horizon). */
function step(style: FaceStyle, ink: Ink, by: number): Ink {
  const ramp = RAMPS[style].find((r) => r.includes(ink));
  if (!ramp) return ink;
  const i = ramp.indexOf(ink);
  return ramp[Math.max(0, Math.min(ramp.length - 1, i + by))] ?? ink;
}

function faceInk(face: Mask, style: FaceStyle, x: number, y: number, t: number): Ink {
  const base = FACE_BANDS[style].find(([end]) => t <= end)?.[1] ?? 'gold';
  // Bevel: light from the upper left. Top and left edges one step lighter, right and bottom
  // edges one step darker.
  if (!maskAt(face, x, y - 1)) return step(style, base, 2);
  if (!maskAt(face, x - 1, y)) return step(style, base, 1);
  if (!maskAt(face, x + 1, y) || !maskAt(face, x, y + 1)) return step(style, base, -1);
  return base;
}

function paintMaskOutline(grid: Grid, mask: Mask): void {
  const outline = growMask(mask, OUTLINE);
  for (let y = 0; y < LOGO_HEIGHT; y++) {
    for (let x = 0; x < LOGO_WIDTH; x++) if (maskAt(outline, x, y)) grid.px(x, y, 'outline');
  }
}

// ---------------------------------------------------------------------------------------------
// Dumbbell.

/** One plate, collar or end cap: x span, half height and its ramp (dark → light, 4 steps). */
interface Disc {
  readonly x: number;
  readonly w: number;
  readonly half: number;
  readonly ramp: readonly Ink[];
}

const RED_PLATE: readonly Ink[] = ['red1', 'red2', 'red3', 'coral'];
const STEEL: readonly Ink[] = ['grey1', 'grey2', 'grey3', 'marble'];
const BRASS: readonly Ink[] = ['leather3', 'brass', 'gold', 'light'];

function paintDumbbell(grid: Grid): void {
  const d = DUMBBELL;
  const body = emptyMask(LOGO_WIDTH, LOGO_HEIGHT);
  const discs: Disc[] = [];
  const side = (x: number, out: 1 | -1) => {
    // From the outer end inward: end cap, small plate, big plate, collar.
    const at = (offset: number, w: number) => (out === -1 ? x + offset : x - offset - w + 1);
    discs.push({ x: at(0, 2), w: 2, half: 4, ramp: STEEL });
    discs.push({ x: at(2, 5), w: 5, half: 9, ramp: RED_PLATE });
    discs.push({ x: at(7, 6), w: 6, half: 12, ramp: RED_PLATE });
    discs.push({ x: at(13, 3), w: 3, half: 5, ramp: BRASS });
  };
  side(d.x0, -1);
  side(d.x1, 1);

  const barTop = d.cy - d.barRadius;
  const barH = d.barRadius * 2 + 1;
  const ink = new Map<number, Ink>();
  const put = (x: number, y: number, c: Ink) => {
    if (x < 0 || y < 0 || x >= LOGO_WIDTH || y >= LOGO_HEIGHT) return;
    body.bits[y * LOGO_WIDTH + x] = 1;
    ink.set(y * LOGO_WIDTH + x, c);
  };
  // Bar: steel, lit from above.
  const barRows: readonly Ink[] = ['marble', 'grey3', 'grey2', 'grey1', 'robeSheen'];
  for (let x = d.x0 + 2; x <= d.x1 - 2; x++) {
    for (let k = 0; k < barH; k++) put(x, barTop + k, barRows[k] ?? 'grey1');
  }
  for (const disc of discs) {
    const top = d.cy - disc.half;
    const h = disc.half * 2 + 1;
    // Lit from above: top band lightest, bottom band darkest.
    const tone = (t: number, shift: number): Ink => {
      const band = t < 0.15 ? 3 : t < 0.5 ? 2 : t < 0.8 ? 1 : 0;
      return disc.ramp[Math.max(0, Math.min(3, band + shift))] ?? 'outline';
    };
    // Chamfer the corners (1 px on small discs, 2 px on plates).
    const chamfer = disc.half >= 8 ? 2 : 1;
    for (let k = 0; k < h; k++) {
      const fromEdge = Math.min(k, h - 1 - k);
      const inset = Math.max(0, chamfer - fromEdge);
      const t = k / (h - 1);
      for (let i = inset; i < disc.w - inset; i++) {
        // Lit from the left: the left edge one ramp step lighter, the right edge one darker.
        const shift = i === inset ? 1 : i === disc.w - 1 - inset ? -1 : 0;
        put(disc.x + i, top + k, tone(t, shift));
      }
    }
  }
  // A black seam where two discs meet, on the shorter one's side.
  const sorted = [...discs].sort((a, b) => a.x - b.x);
  for (let n = 1; n < sorted.length; n++) {
    const a = sorted[n - 1];
    const b = sorted[n];
    if (!a || !b) continue;
    if (a.x + a.w !== b.x) continue;
    const shorter = a.half < b.half ? a : b;
    const x = shorter === a ? a.x + a.w - 1 : b.x;
    for (let y = d.cy - shorter.half; y <= d.cy + shorter.half; y++) put(x, y, 'outline');
  }
  paintMaskOutline(grid, body);
  for (const [i, c] of ink) grid.px(i % LOGO_WIDTH, Math.floor(i / LOGO_WIDTH), c);
}

// ---------------------------------------------------------------------------------------------
// Assembly.

const WORDS: readonly PlacedWord[] = [placeWord(REXIS), placeWord(REVENGE)];

function buildLogo(): SpriteDef {
  const grid = createPixelGrid(LOGO_WIDTH, LOGO_HEIGHT, masterPalette);
  paintGavel(grid, GAVEL);
  paintDumbbell(grid);
  for (const word of WORDS) paintWord(grid, word);
  return grid.toSprite();
}

/** The logo as one sprite, LOGO_WIDTH × LOGO_HEIGHT. */
export const LOGO: SpriteDef = buildLogo();

// ---------------------------------------------------------------------------------------------
// Shine sweep and sparkle.

/** Ticks between the starts of two sweeps. */
export const SHINE_PERIOD = 240;
/** How long the band takes to cross the logo; the sparkle follows right after. */
const SHINE_TICKS = 32;
const SPARKLE_TICKS = 15;
/** A `tick` at which the logo shows its twinkle at full size (for still images). */
export const LOGO_SPARKLE_TICK = SHINE_TICKS + Math.floor(SPARKLE_TICKS / 2);
/** The bright band: a wide stripe and a thin one trailing it, leaning right as they rise. */
const SHINE_STRIPES: readonly (readonly [from: number, to: number])[] = [
  [0, 6],
  [9, 11],
];
const SHINE_SLANT = 0.6;

interface Overlay {
  readonly sprite: SpriteDef;
  readonly x: number;
  readonly y: number;
}

const SHINE_INKS = { w: masterPalette.white, l: masterPalette.light } as const;

/** Crops a sparse set of pixels (`w`/`l` keys by `x,y`) into a positioned overlay sprite. */
function overlayFrom(pixels: ReadonlyMap<string, 'w' | 'l'>): Overlay | null {
  if (pixels.size === 0) return null;
  const points = [...pixels.keys()].map((key) => key.split(',').map(Number));
  const xs = points.map(([x]) => x ?? 0);
  const ys = points.map(([, y]) => y ?? 0);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const rows = Array.from({ length: Math.max(...ys) - y0 + 1 }, (_, dy) =>
    Array.from(
      { length: Math.max(...xs) - x0 + 1 },
      (_, dx) => pixels.get(`${x0 + dx},${y0 + dy}`) ?? '.',
    ).join(''),
  );
  return { sprite: defineSprite(SHINE_INKS, rows), x: x0, y: y0 };
}

const shineFrames = new Map<number, Overlay | null>();

/** The band over the letter faces at sweep tick `frame` (null when it misses them). */
function shineFrame(frame: number): Overlay | null {
  const cached = shineFrames.get(frame);
  if (cached !== undefined) return cached;
  const trail = SHINE_STRIPES.reduce((m, [, to]) => Math.max(m, to), 0);
  const from = -LOGO_HEIGHT * SHINE_SLANT;
  const lead = from + (frame / (SHINE_TICKS - 1)) * (LOGO_WIDTH + trail - from);
  const pixels = new Map<string, 'w' | 'l'>();
  for (const { face } of WORDS) {
    for (let y = 0; y < LOGO_HEIGHT; y++) {
      for (let x = 0; x < LOGO_WIDTH; x++) {
        if (!maskAt(face, x, y)) continue;
        const d = lead - (x - (LOGO_HEIGHT - y) * SHINE_SLANT);
        const stripe = SHINE_STRIPES.find(([a, b]) => d >= a && d < b);
        if (!stripe) continue;
        const edge = d < stripe[0] + 1 || d >= stripe[1] - 1;
        pixels.set(`${x},${y}`, edge && stripe[1] - stripe[0] > 2 ? 'l' : 'w');
      }
    }
  }
  const overlay = overlayFrom(pixels);
  shineFrames.set(frame, overlay);
  return overlay;
}

/** A four-point twinkle, small → large → small, centered on its middle pixel. */
const SPARKLES: readonly SpriteDef[] = [
  defineSprite(SHINE_INKS, ['.l.', 'lwl', '.l.']),
  defineSprite(SHINE_INKS, ['..l..', '..w..', 'lwwwl', '..w..', '..l..']),
  defineSprite(SHINE_INKS, [
    '...l...',
    '...w...',
    '..lwl..',
    'lwwwwwl',
    '..lwl..',
    '...w...',
    '...l...',
  ]),
  defineSprite(SHINE_INKS, [
    '....l....',
    '....w....',
    '....w....',
    '...lwl...',
    'lwwwwwwwl',
    '...lwl...',
    '....w....',
    '....w....',
    '....l....',
  ]),
];
/** Where the twinkle lands: just off the top right corner of REVENGE's last E. */
const SPARKLE_AT = { x: REVENGE.x + 199, y: REVENGE.y - 1 } as const;

/**
 * Draws the logo with its top-left corner at (x, y). `tick` drives the shine: every
 * SHINE_PERIOD ticks a bright band sweeps across the letters, then a twinkle flashes.
 */
export function drawLogo(
  surface: Surface,
  sprites: SpriteBank,
  x: number,
  y: number,
  tick: number,
): void {
  surface.drawBitmap(sprites.get(LOGO), x, y);
  const phase = ((tick % SHINE_PERIOD) + SHINE_PERIOD) % SHINE_PERIOD;
  if (phase < SHINE_TICKS) {
    const shine = shineFrame(phase);
    if (shine) surface.drawBitmap(sprites.get(shine.sprite), x + shine.x, y + shine.y);
  } else if (phase < SHINE_TICKS + SPARKLE_TICKS) {
    // Grows through the sizes to the largest and shrinks back over the sparkle's ticks.
    const t = (phase - SHINE_TICKS + 0.5) / SPARKLE_TICKS;
    const top = SPARKLES.length - 1;
    const size = Math.min(top, Math.floor((1 - Math.abs(2 * t - 1)) * (top + 1.5)));
    const sparkle = SPARKLES[size];
    if (sparkle) {
      surface.drawBitmap(
        sprites.get(sparkle),
        x + SPARKLE_AT.x - (sparkle.width >> 1),
        y + SPARKLE_AT.y - (sparkle.height >> 1),
      );
    }
  }
}
