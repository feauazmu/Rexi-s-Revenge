/**
 * The Arena backdrop, painted procedurally in code (ADR 0001) after reference/arena.png: the
 * plaza between the courthouse and the Bufete & Pesas S.A. tower, at sunset, with the Boissons
 * cocktail bar (and its "JUEVES 2×1" chalkboard) at street level behind the plaza.
 *
 * Everything here is static, so it is painted once into palette-indexed sprites that the
 * SpriteBank rasterizes on first use. Animated details (clouds, billboard bulbs) and the
 * platforms are drawn per frame by `arena.ts`.
 *
 * Layout notes: the top ~24 px stay a calm dark sky for the HUD, and everything below the
 * ground line is low-contrast pavement so the Dialogue Box reads on top of it.
 */
import { createPixelGrid, type PixelGrid } from '../pixel-grid';
import type { SpriteDef } from '../sprite';
import type { Color } from '../surface';

export const ARENA_WIDTH = 480;
export const ARENA_HEIGHT = 270;
/** Must match the default tuning's ground line; the pavement below it is backdrop. */
const GROUND_Y = 238;

// ---------------------------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------------------------

/** Sunset bands, top to bottom: [first row, color]. */
const SKY_BANDS: readonly (readonly [number, Color])[] = [
  [0, '#33205e'],
  [26, '#432773'],
  [48, '#582c86'],
  [68, '#72308d'],
  [86, '#8e358b'],
  [102, '#ab3d83'],
  [117, '#c84a77'],
  [131, '#df5e67'],
  [144, '#ec7957'],
  [156, '#f5954b'],
  [167, '#f9b04c'],
  [178, '#fbc85c'],
  [189, '#fddc7c'],
];

const SKY_HEIGHT = 216;

const SKY_COLORS = {
  ...Object.fromEntries(SKY_BANDS.map(([, color], i) => [`band${i}`, color])),
  sunRim: '#ffe596',
  sunCore: '#fff6cf',
} as Record<string, Color>;

type SkyColor = string;

const band = (i: number): SkyColor => `band${Math.max(0, Math.min(SKY_BANDS.length - 1, i))}`;

/** Long thin horizontal streaks of the next band's color: [band, y, x, length]. */
const SKY_STREAKS: readonly (readonly [number, number, number, number])[] = [
  [1, 38, 0, 150],
  [1, 41, 210, 120],
  [2, 60, 40, 220],
  [2, 63, 330, 150],
  [3, 79, 0, 90],
  [3, 80, 260, 140],
  [4, 95, 120, 200],
  [5, 110, 0, 160],
  [5, 112, 300, 180],
  [6, 125, 80, 240],
  [7, 139, 0, 120],
  [7, 140, 330, 150],
  [8, 151, 150, 200],
  [9, 162, 20, 140],
  [10, 173, 260, 160],
];

const SUN = { cx: 262, cy: 192, r: 21 };

function paintSky(): SpriteDef {
  const g = createPixelGrid<SkyColor>(ARENA_WIDTH, SKY_HEIGHT, SKY_COLORS);

  SKY_BANDS.forEach(([top], i) => {
    const bottom = SKY_BANDS[i + 1]?.[0] ?? SKY_HEIGHT;
    g.rect(0, top, ARENA_WIDTH, bottom - top, band(i));
    if (i === 0) return;
    // Dithered seam: sparse then checkered pixels of this band climbing into the one above.
    for (let x = 0; x < ARENA_WIDTH; x++) {
      if ((x + 2 * (top % 2)) % 4 === 0) g.px(x, top - 2, band(i));
    }
    g.checker(0, top - 1, ARENA_WIDTH, 1, band(i));
  });

  for (const [b, y, x, length] of SKY_STREAKS) {
    g.rect(x, y, length, 1, band(b + 1));
    g.checker(x - 6, y, 6, 1, band(b + 1));
    g.checker(x + length, y, 6, 1, band(b + 1));
  }

  // The low sun, mostly behind the skyline, with a dithered glow ring.
  for (let y = SUN.cy - SUN.r - 3; y <= SUN.cy + SUN.r; y++) {
    for (let x = SUN.cx - SUN.r - 3; x <= SUN.cx + SUN.r + 3; x++) {
      const d = Math.hypot(x - SUN.cx, y - SUN.cy);
      if (d <= SUN.r - 2) g.px(x, y, 'sunCore');
      else if (d <= SUN.r) g.px(x, y, 'sunRim');
      else if (d <= SUN.r + 3 && (x + y) % 2 === 0) g.px(x, y, 'sunRim');
    }
  }

  return g.toSprite();
}

// ---------------------------------------------------------------------------------------------
// Clouds
// ---------------------------------------------------------------------------------------------

const CLOUD_COLORS = {
  top: '#b0729e',
  body: '#8f5287',
  shade: '#7a4680',
  glow: '#d97b76',
  lit: '#f6a874',
} as const satisfies Record<string, Color>;

/** A puffy sunset cloud: union of ellipses [cx, cy, rx, ry], flat bottom, lit from below. */
function paintCloud(width: number, height: number, puffs: readonly number[][]): SpriteDef {
  const g = createPixelGrid(width, height, CLOUD_COLORS);
  const inside = (x: number, y: number) =>
    y < height &&
    puffs.some(([cx = 0, cy = 0, rx = 1, ry = 1]) => {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      return dx * dx + dy * dy <= 1;
    });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const fromBottom = (() => {
        let n = 0;
        while (n < 4 && inside(x, y + n + 1)) n++;
        return n;
      })();
      const atTop = !inside(x, y - 1);
      if (fromBottom === 0) g.px(x, y, 'lit');
      else if (fromBottom === 1) g.px(x, y, (x + y) % 2 === 0 ? 'lit' : 'glow');
      else if (fromBottom === 2) g.px(x, y, 'glow');
      else if (atTop) g.px(x, y, 'top');
      else if (fromBottom === 3) g.px(x, y, (x + y) % 2 === 0 ? 'shade' : 'body');
      else g.px(x, y, 'body');
    }
  }
  return g.toSprite();
}

export interface CloudDef {
  readonly sprite: SpriteDef;
  /** Starting x and fixed y of the cloud's top-left corner. */
  readonly x: number;
  readonly y: number;
  /** Drift speed to the right, px/s. */
  readonly speed: number;
}

function paintClouds(): CloudDef[] {
  return [
    {
      sprite: paintCloud(78, 17, [
        [14, 13, 12, 5],
        [28, 9, 12, 8],
        [44, 7, 13, 8],
        [58, 11, 11, 6],
        [70, 14, 8, 3],
      ]),
      x: 20,
      y: 34,
      speed: 2,
    },
    {
      sprite: paintCloud(40, 9, [
        [10, 7, 9, 3],
        [20, 5, 9, 5],
        [31, 7, 8, 3],
      ]),
      x: 150,
      y: 62,
      speed: 3.5,
    },
    {
      sprite: paintCloud(62, 14, [
        [12, 11, 10, 4],
        [26, 7, 11, 7],
        [40, 8, 9, 6],
        [52, 11, 9, 4],
      ]),
      x: 300,
      y: 98,
      speed: 2.75,
    },
    {
      sprite: paintCloud(34, 6, [
        [9, 5, 8, 2],
        [19, 4, 9, 3],
        [28, 5, 6, 2],
      ]),
      x: 60,
      y: 122,
      speed: 4.5,
    },
  ];
}

// ---------------------------------------------------------------------------------------------
// Scenery: skyline, courthouse, tower, plaza
// ---------------------------------------------------------------------------------------------

const SCENERY_COLORS = {
  outline: '#2a1d3c',
  // Skyline
  far: '#a2508a',
  farShade: '#8c4683',
  near: '#683a7a',
  nearShade: '#55306b',
  nearRoof: '#7c4a88',
  winDim: '#7e4b8c',
  winLit: '#f4bb64',
  // Courthouse marble, lit from the front with a warm rim from the sun
  marbleHi: '#fbf8ff',
  marble: '#e6e1f0',
  marbleMid: '#c6bed9',
  marbleShade: '#a198ba',
  marbleDark: '#7a7198',
  porch: '#655c86',
  porchDark: '#4c4469',
  rim: '#ffd9a6',
  window: '#3e3658',
  windowHi: '#6c6290',
  door: '#5c3426',
  doorHi: '#7e4c34',
  // Tower glass and steel
  steel: '#2c2a46',
  steelHi: '#4a4672',
  mullion: '#2d3d68',
  glassTop: '#7c72b8',
  glass: '#6a8fd0',
  glassLow: '#5c80c2',
  glassHi: '#a8cdf2',
  glassShine: '#dcefff',
  glassWarm: '#f0a882',
  sideGlass: '#3d5a96',
  sideGlassHi: '#4f6ea8',
  sideMullion: '#22305a',
  plate: '#1e2342',
  plateEdge: '#4b5592',
  plateText: '#f3ecd8',
  // Billboard
  board: '#f6cf48',
  boardHi: '#fde68e',
  boardShade: '#dcab36',
  ink: '#2a2238',
  iron: '#8a8aa2',
  plateDark: '#2c2c3c',
  plateLight: '#5e5e76',
  // Boissons, the cocktail bar
  brick: '#7a3b45',
  brickShade: '#62303d',
  mortar: '#552a38',
  awningRed: '#c8384a',
  awningCream: '#f3e2c4',
  neonBack: '#24142c',
  neonGlow: '#6e2860',
  neonPink: '#ff7ac8',
  neonCyanGlow: '#1f4f66',
  neonCyan: '#7cf2ff',
  olive: '#a6e05a',
  barWarm: '#f2a24e',
  barGlow: '#ffd27e',
  bottle: '#5a3a3e',
  chalkboard: '#27352f',
  chalk: '#e6eee2',
  // Plaza
  wallTop: '#d4bdb4',
  wallCap: '#b5a0a6',
  wall: '#8d7787',
  wallSeam: '#725f72',
  wallShadow: '#5f4e63',
  wood: '#9c6a44',
  woodDark: '#6a3e2a',
  lampPost: '#2e2640',
  lampGlow: '#ffe7a0',
  lampCore: '#fffadf',
  floorFar: '#8f7d8b',
  floorMid: '#9b8791',
  floorNear: '#a7928c',
  floorSheen: '#b8a196',
  grout: '#7a6878',
  curbTop: '#e4cba8',
  curbHi: '#c6aa96',
  curb: '#8b7581',
  curbShadow: '#584760',
  pave: '#6b596b',
  paveDark: '#5e4d60',
  paveSeam: '#56465a',
} as const satisfies Record<string, Color>;

type SceneryColor = keyof typeof SCENERY_COLORS;
type Grid = PixelGrid<SceneryColor>;

/** Deterministic pseudo-random 0..1 from integer coordinates (lit windows, stone texture). */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Buildings of the far, hazy skyline: [x, width, top]. */
const FAR_SKYLINE: readonly (readonly [number, number, number])[] = [
  [150, 16, 150],
  [164, 12, 164],
  [174, 20, 140],
  [192, 14, 158],
  [204, 18, 170],
  [220, 12, 178],
  [230, 22, 186],
  [286, 18, 180],
  [302, 12, 160],
  [312, 22, 146],
  [332, 14, 164],
  [344, 20, 132],
  [362, 16, 154],
];

/** Buildings of the near skyline: [x, width, top]. */
const NEAR_SKYLINE: readonly (readonly [number, number, number])[] = [
  [158, 22, 176],
  [178, 14, 188],
  [190, 20, 166],
  [208, 16, 184],
  [222, 22, 194],
  [242, 12, 200],
  [278, 14, 198],
  [290, 22, 186],
  [310, 16, 172],
  [324, 20, 190],
  [342, 18, 162],
  [358, 18, 180],
  [460, 20, 132],
];

const SKYLINE_BASE = 208;

function paintSkyline(g: Grid): void {
  for (const [x, w, top] of FAR_SKYLINE) {
    g.rect(x, top, w, SKYLINE_BASE - top, 'far');
    g.rect(x + w - 3, top, 3, SKYLINE_BASE - top, 'farShade');
  }
  // A spire and an antenna break up the far roofline.
  g.rect(182, 128, 4, 12, 'far');
  g.rect(183, 120, 2, 8, 'far');
  g.rect(353, 118, 1, 14, 'far');
  g.rect(318, 140, 10, 6, 'far');

  for (const [x, w, top] of NEAR_SKYLINE) {
    g.rect(x, top, w, SKYLINE_BASE - top, 'near');
    g.rect(x + w - 4, top, 4, SKYLINE_BASE - top, 'nearShade');
    g.rect(x, top, w, 1, 'nearRoof');
    // Windows: a grid of 1×2 slots, a few warmly lit.
    for (let wy = top + 4; wy < SKYLINE_BASE - 4; wy += 5) {
      for (let wx = x + 2; wx < x + w - 5; wx += 4) {
        const r = hash(wx, wy);
        if (r < 0.16) g.rect(wx, wy, 1, 2, 'winLit');
        else if (r < 0.55) g.rect(wx, wy, 1, 2, 'winDim');
      }
    }
  }
  g.rect(197, 158, 6, 8, 'near');
  g.rect(199, 150, 2, 8, 'near');
  g.rect(349, 154, 4, 8, 'near');
}

// Courthouse ------------------------------------------------------------------------------------

const COURT = {
  left: 4,
  right: 144,
  apexX: 74,
  apexY: 96,
  pedimentBase: 122,
  entablatureBottom: 135,
  columnTop: 136,
  columnBottom: 195,
  stepsTop: 196,
  plazaY: 214,
  columns: [12, 34, 56, 82, 104, 126],
};

function paintCourthouse(g: Grid): void {
  const { left, right, apexX, apexY, pedimentBase } = COURT;

  // Right wing, behind the portico.
  const wingL = 136;
  const wingR = 170;
  g.rect(wingL, 128, wingR - wingL, COURT.stepsTop - 128 + 6, 'marbleMid');
  g.rect(wingL, 124, wingR - wingL + 2, 4, 'marble');
  g.rect(wingL, 123, wingR - wingL + 2, 1, 'outline');
  g.rect(wingL, 128, wingR - wingL + 2, 1, 'marbleShade');
  g.rect(wingR, 124, 2, 4, 'marbleShade');
  g.rect(wingR - 1, 129, 1, COURT.stepsTop - 129 + 6, 'rim');
  g.rect(wingR, 123, 1, COURT.stepsTop - 123 + 6, 'outline');
  for (const wy of [138, 164]) {
    for (const wx of [148, 160]) {
      g.rect(wx - 1, wy - 1, 7, 15, 'marbleShade');
      g.rect(wx, wy, 5, 13, 'window');
      g.rect(wx, wy, 5, 1, 'windowHi');
      g.rect(wx + 2, wy, 1, 13, 'marbleMid');
      g.rect(wx, wy + 6, 5, 1, 'marbleMid');
      g.rect(wx - 1, wy + 13, 7, 2, 'marble');
    }
  }

  // Main hall behind the portico (shows at the left screen edge).
  g.rect(0, pedimentBase, left + 4, COURT.columnBottom - pedimentBase + 2, 'marbleMid');
  // Porch wall behind the colonnade.
  g.rect(
    left + 2,
    COURT.columnTop,
    right - left - 4,
    COURT.columnBottom - COURT.columnTop,
    'porch',
  );
  g.rect(left + 2, COURT.columnTop, right - left - 4, 5, 'porchDark');
  // Windows between the columns, and the great door in the middle bay.
  for (const wx of [24, 46, 116]) {
    g.rect(wx - 1, 150, 8, 26, 'porchDark');
    g.rect(wx, 151, 6, 24, 'window');
    g.rect(wx, 151, 6, 1, 'windowHi');
    g.rect(wx + 3, 151, 1, 24, 'porchDark');
    g.rect(wx, 162, 6, 1, 'porchDark');
  }
  g.rect(94, 150, 8, 26, 'porchDark');
  g.rect(95, 151, 6, 24, 'window');
  g.rect(95, 151, 6, 1, 'windowHi');
  g.rect(66, 152, 16, COURT.columnBottom - 152, 'porchDark');
  g.rect(68, 155, 12, COURT.columnBottom - 155, 'door');
  g.rect(73, 155, 1, COURT.columnBottom - 155, 'outline');
  g.rect(69, 156, 3, 1, 'doorHi');
  g.rect(75, 156, 3, 1, 'doorHi');
  g.rect(71, 172, 1, 2, 'boardHi');
  g.rect(76, 172, 1, 2, 'boardHi');

  // Columns: capital, fluted shaft lit from the left with a warm rim on the right, base.
  for (const cx of COURT.columns) {
    const top = COURT.columnTop;
    const bottom = COURT.columnBottom;
    g.rect(cx - 2, top, 14, 2, 'marbleHi');
    g.rect(cx - 2, top + 2, 14, 1, 'marbleShade');
    g.rect(cx - 1, top + 3, 12, 1, 'marble');
    const shaft: SceneryColor[] = [
      'marbleShade',
      'marbleHi',
      'marbleHi',
      'marbleMid',
      'marble',
      'marbleHi',
      'marbleMid',
      'marble',
      'marbleShade',
      'rim',
    ];
    shaft.forEach((color, i) => {
      g.rect(cx + i, top + 4, 1, bottom - top - 7, color);
    });
    g.rect(cx - 1, bottom - 3, 12, 1, 'marble');
    g.rect(cx - 2, bottom - 2, 14, 2, 'marbleHi');
    g.rect(cx - 2, bottom - 1, 14, 1, 'marbleShade');
  }

  // Entablature: cornice, frieze with dentils, architrave.
  const eTop = pedimentBase;
  g.rect(left - 4, eTop, right - left + 8, 1, 'outline');
  g.rect(left - 4, eTop + 1, right - left + 8, 2, 'marbleHi');
  g.rect(left - 3, eTop + 3, right - left + 6, 1, 'marbleShade');
  g.rect(left - 1, eTop + 4, right - left + 2, 6, 'marble');
  for (let x = left; x < right; x += 4) g.rect(x + 1, eTop + 5, 2, 2, 'marbleMid');
  g.rect(left - 1, eTop + 10, right - left + 2, 2, 'marbleHi');
  g.rect(left - 1, eTop + 12, right - left + 2, 1, 'marbleDark');
  g.rect(right + 3, eTop + 1, 1, 3, 'rim');

  // Pediment: raking cornice around a shaded tympanum with the court's seal.
  const halfWidth = (y: number) =>
    Math.round(((y - apexY) * (apexX - left + 6)) / (pedimentBase - apexY));
  for (let y = apexY; y < pedimentBase; y++) {
    const hw = halfWidth(y);
    g.rect(apexX - hw, y, hw * 2 + 1, 1, 'marble');
    g.rect(apexX - hw + 4, y, Math.max(0, hw * 2 - 7), 1, y > apexY + 3 ? 'marbleMid' : 'marble');
    // Continuous outline along the slope: fill the run since the previous row.
    const run = Math.max(1, hw - halfWidth(y - 1));
    g.rect(apexX - hw, y, run, 1, 'outline');
    g.rect(apexX + hw - run + 1, y, run, 1, 'outline');
    g.rect(apexX - hw + run, y, 2, 1, 'marbleHi');
    g.rect(apexX + hw - run - 1, y, 2, 1, 'rim');
  }
  g.rect(apexX - 2, apexY - 1, 5, 1, 'outline');
  g.rect(left + 6, pedimentBase - 3, right - left - 12, 2, 'marbleShade');
  g.rect(left + 4, pedimentBase - 1, right - left - 8, 1, 'marbleHi');
  for (let y = -5; y <= 5; y++) {
    for (let x = -5; x <= 5; x++) {
      const d = Math.hypot(x, y);
      if (d <= 5.4 && d > 4.2) g.px(apexX + x, 111 + y, 'marbleDark');
      else if (d <= 4.2 && d > 3) g.px(apexX + x, 111 + y, 'marbleHi');
      else if (d <= 3) g.px(apexX + x, 111 + y, 'marble');
    }
  }
  g.rect(apexX - 1, 109, 3, 4, 'marbleShade');
  g.px(apexX, 108, 'marbleShade');

  // Steps down to the plaza, widening as they descend.
  const steps = 6;
  const stepH = (COURT.plazaY - COURT.stepsTop) / steps;
  for (let i = 0; i < steps; i++) {
    const y = COURT.stepsTop + Math.round(i * stepH);
    const inset = 2 - i * 2;
    g.rect(left + inset - 2, y, right - left - 2 * inset + 4, 1, 'marbleHi');
    g.rect(
      left + inset - 2,
      y + 1,
      right - left - 2 * inset + 4,
      Math.ceil(stepH) - 1,
      'marbleMid',
    );
    g.rect(right - inset + 1, y, 1, Math.ceil(stepH), 'rim');
  }
  g.rect(0, COURT.plazaY - 1, right + 14, 1, 'marbleShade');
}

// Tower ------------------------------------------------------------------------------------------

const TOWER = {
  left: 372,
  front: 444,
  right: 464,
  roof: 70,
  base: 208,
  door: { x: 396, w: 24, top: 182 },
};

/** X of each billboard lamp; `arena.ts` lights their bulbs. */
export const BILLBOARD_LAMPS: readonly number[] = [374, 400, 428, 454];
/** Y of the billboard bulbs (3×1 px each, under the lamp arms). */
export const BILLBOARD_BULB_Y = 23;

/** Glyphs for "BUFETE & PESAS S.A." and the Boissons chalkboard's "JUEVES 2×1". */
const SMALL_FONT: Readonly<Record<string, readonly string[]>> = {
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  E: ['###', '#..', '##.', '#..', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  '&': ['.#..', '#.#.', '.#..', '#.##', '.##.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  '.': ['.', '.', '.', '.', '#'],
  ' ': ['.', '.', '.', '.', '.'],
};

/** Glyphs for the "¡INSCRÍBETE!" billboard and the "BOISSONS" neon sign. */
const BIG_FONT: Readonly<Record<string, readonly string[]>> = {
  '¡': ['#', '.', '#', '#', '#', '#', '#'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  // Í: an I whose accent is painted above the line (see paintText).
  Í: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#.#.#', '#..##', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};

function textWidth(font: Readonly<Record<string, readonly string[]>>, text: string, scale = 1) {
  let w = 0;
  for (const ch of text) w += ((font[ch]?.[0]?.length ?? 0) + 1) * scale;
  return w - scale;
}

/** Paints text in a bitmap font; returns nothing, glyph pixels are `scale`×`scale` blocks. */
function paintText(
  g: Grid,
  font: Readonly<Record<string, readonly string[]>>,
  text: string,
  x: number,
  y: number,
  color: SceneryColor,
  scale = 1,
): void {
  let cx = x;
  for (const ch of text) {
    const glyph = font[ch];
    if (!glyph) throw new Error(`No glyph for "${ch}"`);
    if (ch === 'Í') {
      g.rect(cx + 2 * scale, y - 3 * scale, scale, scale, color);
      g.rect(cx + scale, y - 2 * scale, scale, scale, color);
    }
    glyph.forEach((row, gy) => {
      for (let gx = 0; gx < row.length; gx++) {
        if (row.charAt(gx) === '#') g.rect(cx + gx * scale, y + gy * scale, scale, scale, color);
      }
    });
    cx += ((glyph[0]?.length ?? 0) + 1) * scale;
  }
}

function paintTower(g: Grid): void {
  const { left, front, right, roof, base, door } = TOWER;

  // Glass curtain wall: 8×9 panes in a steel grid; the front reflects the sunset sky.
  g.rect(left, roof, right - left, base - roof, 'mullion');
  const cols = Math.floor((front - left - 1) / 9);
  for (let row = 0; row * 10 + roof + 3 < door.top - 4; row++) {
    const py = roof + 3 + row * 10;
    for (let col = 0; col < cols; col++) {
      const px = left + 1 + col * 9;
      const base: SceneryColor = row < 3 ? 'glassTop' : row < 7 ? 'glass' : 'glassLow';
      g.rect(px, py, 8, 9, base);
      // Warm sun reflection on the edge facing the sun, dithered into the blue.
      if (col === 0) g.rect(px, py, 8, 9, 'glassWarm');
      if (col === 1) g.checker(px, py, 4, 9, 'glassWarm');
      // A diagonal sheen sweeping across the facade.
      const diag = col * 2 - row;
      if (diag === 3 || diag === 4) {
        for (let i = 0; i < 9; i++) g.rect(px + Math.max(0, 7 - i), py + i, 2, 1, 'glassHi');
      }
      if (diag === 4) g.rect(px, py, 8, 1, 'glassShine');
      g.px(px, py, 'glassHi');
    }
  }
  // Side face, in shadow.
  for (let row = 0; row * 10 + roof + 3 < base - 4; row++) {
    const py = roof + 3 + row * 10;
    g.rect(front, py - 3, right - front, 1, 'sideMullion');
    for (const px of [front + 1, front + 10]) {
      g.rect(px, py, 8, 9, 'sideGlass');
      g.rect(px, py, 1, 9, 'sideGlassHi');
    }
  }
  g.rect(front, roof, 1, base - roof, 'steelHi');
  g.rect(left - 1, roof, 1, base - roof, 'outline');
  g.rect(right, roof, 1, base - roof, 'outline');

  // Roof slab and billboard frame.
  g.rect(left - 4, roof - 5, right - left + 8, 5, 'steel');
  g.rect(left - 4, roof - 5, right - left + 8, 1, 'steelHi');
  g.rect(left - 4, roof - 1, right - left + 8, 1, 'outline');
  for (const lx of [380, 414, 448]) {
    g.rect(lx, 58, 2, roof - 63, 'ink');
  }
  g.rect(378, 61, 74, 1, 'ink');
  for (let i = 0; i < 6; i++) g.px(382 + i * 12, 60 - (i % 2), 'ink');

  const bx = 360;
  const by = 26;
  const bw = 108;
  const bh = 33;
  g.rect(bx, by, bw, bh, 'ink');
  g.rect(bx + 2, by + 2, bw - 4, bh - 4, 'board');
  g.rect(bx + 2, by + 2, bw - 4, 2, 'boardHi');
  g.rect(bx + 2, by + bh - 5, bw - 4, 3, 'boardShade');
  g.checker(bx + 2, by + bh - 6, bw - 4, 1, 'boardShade');
  // Gym ad: a dumbbell over a gavel, "¡INSCRÍBETE!" and the firm's name.
  const dx = bx + 7;
  const dy = by + 3;
  g.rect(dx + 6, dy + 6, 18, 3, 'iron');
  g.rect(dx + 6, dy + 6, 18, 1, 'boardHi');
  for (const [px, h] of [
    [dx, 13],
    [dx + 4, 9],
    [dx + 22, 9],
    [dx + 26, 13],
  ] as const) {
    const top = dy + 7 - Math.floor(h / 2);
    g.rect(px, top, 4, h, 'plateDark');
    g.rect(px + 1, top + 1, 1, h - 3, 'plateLight');
  }
  // Gavel lying under the dumbbell: banded head on the left, handle to the right.
  const gx = bx + 8;
  const gy = by + 18;
  g.rect(gx, gy, 9, 7, 'ink');
  g.rect(gx + 1, gy + 1, 7, 5, 'woodDark');
  g.rect(gx + 1, gy + 1, 7, 1, 'wood');
  g.rect(gx + 2, gy + 1, 1, 5, 'boardShade');
  g.rect(gx + 6, gy + 1, 1, 5, 'boardShade');
  g.rect(gx + 9, gy + 2, 19, 3, 'ink');
  g.rect(gx + 9, gy + 3, 18, 1, 'wood');
  const textX = bx + 44;
  const textW = bw - 48;
  const cta = '¡INSCRÍBETE!';
  paintText(
    g,
    BIG_FONT,
    cta,
    textX + Math.floor((textW - textWidth(BIG_FONT, cta)) / 2),
    by + 7,
    'ink',
  );
  const firm = 'BUFETE & PESAS';
  paintText(
    g,
    SMALL_FONT,
    firm,
    textX + Math.floor((textW - textWidth(SMALL_FONT, firm)) / 2),
    by + 19,
    'ink',
  );

  // Lamp arms over the billboard (the bulbs themselves blink, drawn per frame).
  for (const lx of BILLBOARD_LAMPS) {
    g.rect(lx - 3, 21, 7, 2, 'steel');
    g.rect(lx - 3, 21, 7, 1, 'steelHi');
    g.rect(lx, 23, 1, 3, 'ink');
  }

  // Company sign, overhanging the facade.
  const name = 'BUFETE & PESAS S.A.';
  const nameW = textWidth(SMALL_FONT, name);
  const sx = left - 6;
  const sw = front - left + 12;
  const sy = 150;
  g.rect(sx, sy, sw, 11, 'plate');
  g.rect(sx, sy, sw, 1, 'plateEdge');
  g.rect(sx, sy + 10, sw, 1, 'outline');
  g.rect(sx, sy, 1, 11, 'plateEdge');
  paintText(g, SMALL_FONT, name, sx + Math.floor((sw - nameW) / 2), sy + 3, 'plateText');

  // Entrance: canopy, glass doors, steel jambs.
  g.rect(door.x - 6, door.top - 4, door.w + 12, 3, 'steel');
  g.rect(door.x - 6, door.top - 4, door.w + 12, 1, 'steelHi');
  g.rect(door.x - 2, door.top - 1, door.w + 4, base - door.top + 1, 'steel');
  g.rect(door.x, door.top, door.w, base - door.top, 'glassHi');
  g.rect(door.x, door.top, door.w, 3, 'glassShine');
  g.rect(door.x + door.w / 2 - 1, door.top, 2, base - door.top, 'steel');
  g.rect(door.x + 3, door.top + 10, 6, 1, 'glass');
  g.rect(door.x + 15, door.top + 10, 6, 1, 'glass');
  g.rect(left, base - 2, right - left, 2, 'steel');
  // Entrance landing, stepping down to the plaza.
  g.rect(door.x - 8, base, door.w + 16, 6, 'wallCap');
  g.rect(door.x - 8, base, door.w + 16, 1, 'wallTop');
  g.rect(door.x - 10, base + 3, door.w + 20, 1, 'wallTop');
  g.rect(door.x - 10, base + 4, door.w + 20, 2, 'wall');
}

// Boissons ----------------------------------------------------------------------------------------

/** Boissons, the cocktail bar on the plaza (its Thursday 2×1 cocktails are a running joke). */
const BAR = { left: 280, right: 350, top: 166 };

/** Paints `text` as neon tubing: a dim halo around every lit pixel, then the bright tube. */
function paintNeon(
  g: Grid,
  font: Readonly<Record<string, readonly string[]>>,
  text: string,
  x: number,
  y: number,
  glow: SceneryColor,
  tube: SceneryColor,
): void {
  for (const [ox, oy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const) {
    paintText(g, font, text, x + ox, y + oy, glow);
  }
  paintText(g, font, text, x, y, tube);
}

/** A warm bar window with a shelf of bottles, framed in dark wood. */
function paintBarWindow(g: Grid, x: number, y: number, w: number, h: number): void {
  g.rect(x - 1, y - 1, w + 2, h + 2, 'woodDark');
  g.rect(x, y, w, h, 'barWarm');
  g.rect(x + 2, y + 1, w - 4, h - 4, 'barGlow');
  g.checker(x + 1, y + h - 3, w - 2, 2, 'barGlow');
  // Shelf with bottles.
  g.rect(x, y + 8, w, 1, 'doorHi');
  for (let bx = x + 2; bx < x + w - 2; bx += 3) {
    const tall = hash(bx, y) < 0.5;
    g.rect(bx, y + (tall ? 3 : 5), 1, tall ? 5 : 3, 'bottle');
    g.px(bx, y + (tall ? 2 : 4), 'bottle');
    if (hash(y, bx) < 0.4) g.px(bx, y + 6, 'olive');
  }
  g.rect(x - 2, y + h + 1, w + 4, 1, 'wallTop');
}

function paintBar(g: Grid): void {
  const { left, right, top } = BAR;
  const w = right - left;

  // Brick facade, warm sun rim on the left edge, shade on the right.
  g.rect(left, top, w, PLAZA_Y - top, 'brick');
  for (let y = top + 3; y < PLAZA_Y; y += 3) {
    g.rect(left, y, w, 1, 'mortar');
    for (let x = left + ((y / 3) % 2 === 0 ? 2 : 5); x < right; x += 6) g.px(x, y + 1, 'mortar');
  }
  g.rect(right - 3, top, 3, PLAZA_Y - top, 'brickShade');
  g.rect(left, top, 1, PLAZA_Y - top, 'rim');
  g.rect(left - 1, top, 1, PLAZA_Y - top, 'outline');
  g.rect(right, top, 1, PLAZA_Y - top, 'outline');
  // Cornice.
  g.rect(left - 2, top - 3, w + 4, 1, 'outline');
  g.rect(left - 2, top - 2, w + 4, 2, 'wallTop');
  g.rect(left - 2, top, w + 4, 1, 'wallShadow');

  // Neon sign: a cocktail glass and "BOISSONS" on a dark backing board.
  const sx = left + 2;
  const sy = top + 3;
  const sw = w - 4;
  g.rect(sx, sy, sw, 13, 'outline');
  g.rect(sx + 1, sy + 1, sw - 2, 11, 'neonBack');
  const name = 'BOISSONS';
  const glassW = 7;
  const contentW = glassW + 3 + textWidth(BIG_FONT, name);
  const cx = sx + Math.floor((sw - contentW) / 2);
  const glass = ['#######', '.#...#.', '..#.#..', '...#...', '...#...', '...#...', '..###..'];
  const glassFont = { Y: glass };
  paintNeon(g, glassFont, 'Y', cx, sy + 3, 'neonCyanGlow', 'neonCyan');
  g.px(cx + 3, sy + 4, 'olive');
  paintNeon(g, BIG_FONT, name, cx + glassW + 3, sy + 3, 'neonGlow', 'neonPink');
  // A brighter core on the tube's top row gives the neon some sheen.
  g.checker(cx + glassW + 3, sy + 3, textWidth(BIG_FONT, name), 1, 'lampCore');

  // Striped awning with a scalloped edge and its shadow on the bricks.
  const ay = top + 18;
  g.rect(left - 3, ay - 1, w + 6, 1, 'outline');
  for (let x = left - 3; x < right + 3; x++) {
    const red = Math.floor((x - left + 3) / 4) % 2 === 0;
    g.rect(x, ay, 1, 5, red ? 'awningRed' : 'awningCream');
    g.px(x, ay + 4, red ? 'brick' : 'wallTop');
    if ((x - left + 3) % 4 === 1 || (x - left + 3) % 4 === 2) {
      g.px(x, ay + 5, red ? 'brick' : 'wallTop');
    }
  }
  g.rect(left, ay + 6, w, 1, 'mortar');
  g.checker(left, ay + 7, w, 1, 'mortar');

  // Two warm windows and a door with a glowing pane.
  const wy = ay + 9;
  paintBarWindow(g, left + 4, wy, 20, 16);
  paintBarWindow(g, right - 24, wy, 20, 16);
  const doorX = left + w / 2 - 6;
  g.rect(doorX - 1, wy - 2, 14, PLAZA_Y - wy + 2, 'woodDark');
  g.rect(doorX, wy - 1, 12, PLAZA_Y - wy + 1, 'door');
  g.rect(doorX + 2, wy + 1, 8, 9, 'barGlow');
  g.rect(doorX + 2, wy + 1, 8, 1, 'barWarm');
  g.rect(doorX + 9, wy + 13, 1, 2, 'boardHi');

  // Warm light spilling onto the plaza tiles in front of the bar.
  for (const [x0, x1] of [
    [left + 2, left + 26],
    [doorX, doorX + 12],
    [right - 26, right - 2],
  ] as const) {
    g.checker(x0, PLAZA_Y, x1 - x0, 1, 'floorSheen');
    for (let x = x0 + 1; x < x1 - 1; x += 2) {
      if ((x + PLAZA_Y) % 4 === 1) g.px(x, PLAZA_Y + 1, 'floorSheen');
    }
  }

  // Chalkboard A-frame on the plaza: "JUEVES 2×1" (cocktails, of course).
  const bw = 27;
  const bh = 17;
  const bx = left + 3;
  const by = PLAZA_Y - 13;
  g.rect(bx + 2, by + bh, 1, 3, 'woodDark');
  g.rect(bx + bw - 3, by + bh, 1, 3, 'woodDark');
  g.rect(bx, by, bw, bh, 'woodDark');
  g.rect(bx, by, bw, 1, 'wood');
  g.rect(bx + 1, by + 1, bw - 2, bh - 2, 'chalkboard');
  const day = 'JUEVES';
  const deal = '2×1';
  paintText(
    g,
    SMALL_FONT,
    day,
    bx + Math.floor((bw - textWidth(SMALL_FONT, day)) / 2),
    by + 2,
    'chalk',
  );
  paintText(g, SMALL_FONT, deal, bx + 3, by + 9, 'chalk');
  // A tiny chalk cocktail next to the deal.
  const tx = bx + 17;
  const ty = by + 9;
  g.rect(tx, ty, 5, 1, 'chalk');
  g.rect(tx + 1, ty + 1, 3, 1, 'chalk');
  g.rect(tx + 2, ty + 2, 1, 2, 'chalk');
  g.rect(tx + 1, ty + 4, 3, 1, 'chalk');
}

// Plaza -------------------------------------------------------------------------------------------

const WALL_TOP = 206;
const PLAZA_Y = 214;

function paintPlaza(g: Grid): void {
  // Low stone wall along the back of the plaza; the steps and tower entrance sit in front.
  const x0 = 140;
  const wallW = ARENA_WIDTH - x0;
  g.rect(x0, WALL_TOP, wallW, 1, 'wallTop');
  g.rect(x0, WALL_TOP + 1, wallW, 1, 'wallCap');
  g.rect(x0, WALL_TOP + 2, wallW, PLAZA_Y - WALL_TOP - 3, 'wall');
  g.rect(x0, PLAZA_Y - 1, wallW, 1, 'wallShadow');
  g.rect(x0, WALL_TOP + 4, wallW, 1, 'wallSeam');
  for (let x = x0; x < ARENA_WIDTH; x += 10) {
    g.rect(x, WALL_TOP + 2, 1, 3, 'wallSeam');
    g.rect(x + 5, WALL_TOP + 5, 1, 3, 'wallSeam');
  }

  // Benches and street lamps, lit for the evening.
  for (const bx of [206, 246, 440]) paintBench(g, bx, PLAZA_Y - 1);
  for (const lx of [184, 356]) paintLamp(g, lx, PLAZA_Y);

  // Floor tiles receding toward a vanishing point behind the skyline.
  const vanishX = 240;
  const vanishY = 120;
  const tileRows = [PLAZA_Y, 217, 221, 226, 232, GROUND_Y];
  for (let r = 0; r < tileRows.length - 1; r++) {
    const top = tileRows[r] ?? PLAZA_Y;
    const bottom = tileRows[r + 1] ?? GROUND_Y;
    const color: SceneryColor = r < 2 ? 'floorFar' : r < 4 ? 'floorMid' : 'floorNear';
    g.rect(0, top, ARENA_WIDTH, bottom - top, color);
    if (r > 0) g.rect(0, top, ARENA_WIDTH, 1, 'grout');
    for (let y = top + 1; y < bottom; y++) {
      const t = (y - vanishY) / (GROUND_Y - vanishY);
      for (let k = -14; k <= 14; k++) {
        const x = Math.round(vanishX + (k + (r % 2) * 0.5) * 38 * t);
        g.px(x, y, 'grout');
      }
    }
  }
  // Curb at the ground line, then calm front pavement under the Dialogue Box.
  g.rect(0, GROUND_Y, ARENA_WIDTH, 1, 'curbTop');
  g.rect(0, GROUND_Y + 1, ARENA_WIDTH, 1, 'curbHi');
  g.rect(0, GROUND_Y + 2, ARENA_WIDTH, 3, 'curb');
  g.rect(0, GROUND_Y + 5, ARENA_WIDTH, 1, 'curbShadow');
  for (let x = 14; x < ARENA_WIDTH; x += 48) g.rect(x, GROUND_Y + 1, 1, 4, 'curbShadow');
  g.rect(0, GROUND_Y + 6, ARENA_WIDTH, ARENA_HEIGHT - GROUND_Y - 6, 'pave');
  g.checker(0, 258, ARENA_WIDTH, 1, 'paveDark');
  g.rect(0, 259, ARENA_WIDTH, ARENA_HEIGHT - 259, 'paveDark');
  for (const [y, offset] of [
    [252, 0],
    [264, 30],
  ] as const) {
    g.rect(0, y, ARENA_WIDTH, 1, 'paveSeam');
    for (let x = offset; x < ARENA_WIDTH; x += 60) g.rect(x, y - 8, 1, 8, 'paveSeam');
  }
  for (let x = 24; x < ARENA_WIDTH; x += 60) g.rect(x, GROUND_Y + 6, 1, 6, 'paveSeam');
}

function paintBench(g: Grid, x: number, groundY: number): void {
  g.rect(x, groundY - 8, 16, 2, 'wood');
  g.rect(x, groundY - 8, 16, 1, 'wallTop');
  g.rect(x, groundY - 6, 16, 1, 'woodDark');
  g.rect(x - 1, groundY - 4, 18, 2, 'wood');
  g.rect(x - 1, groundY - 2, 18, 1, 'woodDark');
  for (const lx of [x + 1, x + 13]) g.rect(lx, groundY - 6, 2, 7, 'lampPost');
}

function paintLamp(g: Grid, x: number, groundY: number): void {
  const top = groundY - 40;
  g.rect(x - 2, groundY - 3, 5, 3, 'lampPost');
  g.rect(x, top + 6, 1, 34, 'lampPost');
  g.rect(x - 1, top + 6, 3, 1, 'lampPost');
  g.rect(x - 3, top - 1, 7, 1, 'lampPost');
  g.rect(x - 2, top, 5, 5, 'lampGlow');
  g.rect(x - 1, top + 1, 3, 3, 'lampCore');
  g.rect(x - 2, top + 5, 5, 1, 'lampPost');
  g.rect(x - 1, top - 2, 3, 1, 'lampPost');
  for (let dy = -4; dy <= 8; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const d = Math.hypot(dx, dy - 2.5);
      if (d > 3.6 && d < 6.2 && (x + dx + top + dy) % 2 === 0 && g.get(x + dx, top + dy) === null) {
        g.px(x + dx, top + dy, 'lampGlow');
      }
    }
  }
}

function paintScenery(): SpriteDef {
  const g = createPixelGrid<SceneryColor>(ARENA_WIDTH, ARENA_HEIGHT, SCENERY_COLORS);
  paintSkyline(g);
  paintPlaza(g);
  paintBar(g);
  paintCourthouse(g);
  paintTower(g);
  return g.toSprite();
}

// ---------------------------------------------------------------------------------------------

export interface ArenaBackdrop {
  /** Opaque sunset sky, drawn at (0, 0). */
  readonly sky: SpriteDef;
  /** Clouds drifting across the sky, behind the buildings. */
  readonly clouds: readonly CloudDef[];
  /** Skyline, courthouse, Boissons, tower and plaza, drawn at (0, 0) over the sky and clouds. */
  readonly scenery: SpriteDef;
}

let backdrop: ArenaBackdrop | null = null;

/** The painted backdrop, built on first use and shared afterwards. */
export function arenaBackdrop(): ArenaBackdrop {
  backdrop ??= { sky: paintSky(), clouds: paintClouds(), scenery: paintScenery() };
  return backdrop;
}
