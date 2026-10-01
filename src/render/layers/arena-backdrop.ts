/**
 * The Arena backdrop, painted procedurally in code (ADR 0001) after reference/arena.png: the
 * plaza between the courthouse and the Bufete & Pesas S.A. tower, at sunset, with the Boissons
 * cocktail bar (and its "JUEVES 2×1" chalkboard) at street level behind the plaza.
 *
 * Everything here is static, so it is painted once into palette-indexed sprites that the
 * SpriteBank rasterizes on first use. Animated details (clouds, billboard bulbs) and the
 * platforms are drawn per frame by `arena.ts`.
 *
 * Layout notes (640×360): the top ~32 px stay a calm dark sky for the HUD, and everything below
 * the ground line is low-contrast pavement so the Dialogue Box reads on top of it. Details stay
 * at 1:1 pixel density: the wider, taller frame gets more windows, columns, panes and tiles, never
 * bigger pixels.
 */
import { defaultTuning } from '../../core';
import { createPixelGrid, type PixelGrid } from '../pixel-grid';
import type { SpriteDef } from '../sprite';
import type { Color } from '../surface';

export const ARENA_WIDTH = 640;
export const ARENA_HEIGHT = 360;
/** The default tuning's ground line; the pavement below it is backdrop. */
const GROUND_Y = defaultTuning.arena.groundY;

// ---------------------------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------------------------

/** Sunset bands, top to bottom: [first row, color]. */
const SKY_BANDS: readonly (readonly [number, Color])[] = [
  [0, '#33205e'],
  [35, '#432773'],
  [64, '#582c86'],
  [91, '#72308d'],
  [115, '#8e358b'],
  [136, '#ab3d83'],
  [156, '#c84a77'],
  [175, '#df5e67'],
  [192, '#ec7957'],
  [208, '#f5954b'],
  [223, '#f9b04c'],
  [237, '#fbc85c'],
  [252, '#fddc7c'],
];

const SKY_HEIGHT = 288;

const SKY_COLORS = {
  ...Object.fromEntries(SKY_BANDS.map(([, color], i) => [`band${i}`, color])),
  sunRim: '#ffe596',
  sunCore: '#fff6cf',
} as Record<string, Color>;

type SkyColor = string;

const band = (i: number): SkyColor => `band${Math.max(0, Math.min(SKY_BANDS.length - 1, i))}`;

/** Long thin horizontal streaks of the next band's color: [band, y, x, length]. */
const SKY_STREAKS: readonly (readonly [number, number, number, number])[] = [
  [1, 51, 0, 200],
  [1, 55, 280, 160],
  [1, 58, 500, 140],
  [2, 80, 53, 293],
  [2, 84, 440, 200],
  [3, 105, 0, 120],
  [3, 107, 347, 187],
  [3, 110, 160, 110],
  [4, 127, 160, 267],
  [4, 130, 520, 120],
  [5, 147, 0, 213],
  [5, 149, 400, 240],
  [6, 167, 107, 320],
  [6, 170, 530, 110],
  [7, 185, 0, 160],
  [7, 187, 440, 200],
  [8, 201, 200, 267],
  [8, 204, 560, 80],
  [9, 216, 27, 187],
  [9, 219, 420, 150],
  [10, 231, 347, 213],
  [11, 245, 230, 240],
];

const SUN = { cx: 349, cy: 256, r: 28 };

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
      sprite: paintCloud(104, 22, [
        [18, 17, 16, 6],
        [36, 12, 15, 10],
        [56, 9, 17, 10],
        [76, 14, 14, 8],
        [93, 18, 10, 4],
      ]),
      x: 26,
      y: 44,
      speed: 2,
    },
    {
      sprite: paintCloud(54, 12, [
        [13, 9, 12, 4],
        [27, 6, 12, 7],
        [42, 9, 11, 4],
      ]),
      x: 200,
      y: 82,
      speed: 3.5,
    },
    {
      sprite: paintCloud(84, 18, [
        [16, 14, 14, 5],
        [34, 9, 15, 9],
        [53, 10, 12, 8],
        [70, 14, 12, 5],
      ]),
      x: 400,
      y: 128,
      speed: 2.75,
    },
    {
      sprite: paintCloud(46, 8, [
        [12, 6, 11, 3],
        [25, 5, 12, 4],
        [37, 6, 8, 3],
      ]),
      x: 80,
      y: 162,
      speed: 4.5,
    },
    {
      sprite: paintCloud(66, 14, [
        [14, 11, 12, 4],
        [30, 7, 13, 7],
        [48, 9, 12, 5],
        [59, 11, 6, 3],
      ]),
      x: 560,
      y: 60,
      speed: 2.25,
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
  [200, 21, 200],
  [219, 16, 219],
  [232, 27, 187],
  [256, 19, 211],
  [272, 24, 227],
  [293, 16, 237],
  [307, 29, 248],
  [381, 24, 240],
  [403, 16, 213],
  [416, 29, 195],
  [443, 19, 219],
  [459, 27, 176],
  [483, 21, 205],
];

/** Buildings of the near skyline: [x, width, top]. */
const NEAR_SKYLINE: readonly (readonly [number, number, number])[] = [
  [211, 29, 235],
  [237, 19, 251],
  [253, 27, 221],
  [277, 21, 245],
  [296, 29, 259],
  [323, 16, 267],
  [371, 19, 264],
  [387, 29, 248],
  [413, 21, 229],
  [432, 27, 253],
  [456, 24, 216],
  [477, 24, 240],
  [613, 27, 176],
];

const SKYLINE_BASE = 277;

function paintSkyline(g: Grid): void {
  for (const [x, w, top] of FAR_SKYLINE) {
    g.rect(x, top, w, SKYLINE_BASE - top, 'far');
    g.rect(x + w - 4, top, 4, SKYLINE_BASE - top, 'farShade');
  }
  // Spires, antennas and a stepped crown break up the far roofline.
  g.rect(243, 171, 5, 16, 'far');
  g.rect(244, 160, 3, 11, 'far');
  g.rect(245, 153, 1, 7, 'far');
  g.rect(471, 157, 1, 19, 'far');
  g.rect(464, 170, 13, 6, 'far');
  g.rect(424, 187, 13, 8, 'far');
  g.rect(427, 182, 7, 5, 'far');
  g.rect(320, 240, 2, 8, 'far');

  for (const [x, w, top] of NEAR_SKYLINE) {
    g.rect(x, top, w, SKYLINE_BASE - top, 'near');
    g.rect(x + w - 5, top, 5, SKYLINE_BASE - top, 'nearShade');
    g.rect(x, top, w, 1, 'nearRoof');
    // Windows: a grid of 1×2 slots, a few warmly lit.
    for (let wy = top + 4; wy < SKYLINE_BASE - 4; wy += 5) {
      for (let wx = x + 2; wx < x + w - 6; wx += 4) {
        const r = hash(wx, wy);
        if (r < 0.16) g.rect(wx, wy, 1, 2, 'winLit');
        else if (r < 0.55) g.rect(wx, wy, 1, 2, 'winDim');
      }
    }
  }
  // Rooftop clutter: a water tank on legs, a spire, a mast with a red tip.
  g.rect(262, 211, 8, 10, 'near');
  g.rect(265, 200, 2, 11, 'near');
  g.rect(296, 252, 9, 5, 'near');
  g.rect(297, 257, 1, 2, 'near');
  g.rect(303, 257, 1, 2, 'near');
  g.rect(296, 251, 9, 1, 'nearRoof');
  g.rect(465, 205, 5, 11, 'near');
  g.rect(467, 196, 1, 9, 'near');
  g.px(467, 195, 'winLit');
  g.rect(418, 224, 9, 5, 'near');
  g.rect(418, 223, 9, 1, 'nearRoof');
}

// Courthouse ------------------------------------------------------------------------------------

const COURT = {
  left: 5,
  right: 192,
  apexX: 98,
  apexY: 126,
  pedimentBase: 163,
  columnTop: 181,
  columnBottom: 260,
  stepsTop: 261,
  plazaY: 285,
  /** Left edge of each column shaft; the middle bay (86..110) frames the great door. */
  columns: [15, 44, 73, 110, 139, 168],
};

/** A column shaft, left to right: fluted, lit from the left, warm sun rim on the right. */
const SHAFT: readonly SceneryColor[] = [
  'marbleShade',
  'marbleHi',
  'marbleHi',
  'marbleMid',
  'marble',
  'marbleHi',
  'marbleMid',
  'marble',
  'marbleHi',
  'marbleMid',
  'marble',
  'marbleShade',
  'rim',
];

/** A tall window in the porch wall: dark reveal, lintel, mullion and transom. */
function paintPorchWindow(g: Grid, x: number, y: number): void {
  g.rect(x - 2, y - 3, 13, 2, 'marbleShade');
  g.rect(x - 2, y - 3, 13, 1, 'marbleMid');
  g.rect(x - 1, y - 1, 11, 36, 'porchDark');
  g.rect(x, y, 9, 34, 'window');
  g.rect(x, y, 9, 1, 'windowHi');
  g.rect(x + 1, y + 2, 1, 10, 'windowHi');
  g.rect(x + 4, y, 1, 34, 'porchDark');
  g.rect(x, y + 13, 9, 1, 'porchDark');
  g.rect(x - 1, y + 34, 11, 1, 'marbleShade');
}

function paintCourthouse(g: Grid): void {
  const { left, right, apexX, apexY, pedimentBase, columnTop, columnBottom } = COURT;

  // Right wing, behind the portico.
  const wingL = 181;
  const wingR = 227;
  const wingTop = 171;
  const wingBottom = COURT.stepsTop + 6;
  g.rect(wingL, wingTop, wingR - wingL, wingBottom - wingTop, 'marbleMid');
  g.rect(wingL, wingTop - 5, wingR - wingL + 2, 5, 'marble');
  g.rect(wingL, wingTop - 6, wingR - wingL + 2, 1, 'outline');
  g.rect(wingL, wingTop - 4, wingR - wingL + 2, 1, 'marbleHi');
  g.rect(wingL, wingTop, wingR - wingL + 2, 1, 'marbleShade');
  g.rect(wingR, wingTop - 5, 2, 5, 'marbleShade');
  g.rect(wingR - 1, wingTop + 1, 1, wingBottom - wingTop - 1, 'rim');
  g.rect(wingR, wingTop - 6, 1, wingBottom - wingTop + 6, 'outline');
  // A string course between the floors.
  g.rect(wingL, 212, wingR - wingL - 1, 1, 'marble');
  g.rect(wingL, 213, wingR - wingL - 1, 1, 'marbleShade');
  for (const wy of [180, 222]) {
    for (const wx of [194, 210]) {
      g.rect(wx - 1, wy - 1, 9, 21, 'marbleShade');
      g.rect(wx, wy, 7, 19, 'window');
      g.rect(wx, wy, 7, 1, 'windowHi');
      g.rect(wx + 3, wy, 1, 19, 'marbleMid');
      g.rect(wx, wy + 8, 7, 1, 'marbleMid');
      g.rect(wx - 1, wy + 19, 9, 2, 'marble');
      g.rect(wx - 1, wy + 19, 9, 1, 'marbleHi');
    }
  }

  // Main hall behind the portico (shows at the left screen edge).
  g.rect(0, pedimentBase, left + 5, columnBottom - pedimentBase + 2, 'marbleMid');
  // Porch wall behind the colonnade.
  g.rect(left + 2, columnTop, right - left - 4, columnBottom - columnTop, 'porch');
  g.rect(left + 2, columnTop, right - left - 4, 6, 'porchDark');
  g.checker(left + 2, columnTop + 6, right - left - 4, 1, 'porchDark');
  // Windows between the columns, and the great door in the middle bay.
  for (const wx of [32, 61, 127, 156]) paintPorchWindow(g, wx, 200);
  const doorL = 89;
  const doorW = 18;
  const doorTop = 206;
  g.rect(doorL - 3, doorTop - 6, doorW + 6, 2, 'marbleShade');
  g.rect(doorL - 3, doorTop - 6, doorW + 6, 1, 'marbleMid');
  g.rect(doorL - 2, doorTop - 4, doorW + 4, columnBottom - doorTop + 4, 'porchDark');
  g.rect(doorL, doorTop - 3, doorW, 2, 'windowHi');
  g.rect(doorL, doorTop - 3, doorW, 1, 'window');
  g.rect(doorL, doorTop, doorW, columnBottom - doorTop, 'door');
  g.rect(apexX, doorTop, 1, columnBottom - doorTop, 'outline');
  for (const lx of [doorL + 1, apexX + 2]) {
    g.rect(lx, doorTop + 1, 7, 1, 'doorHi');
    // Raised panels on each leaf.
    for (const py of [doorTop + 4, doorTop + 27]) {
      g.rect(lx + 1, py, 5, 18, 'doorHi');
      g.rect(lx + 2, py + 1, 4, 17, 'door');
    }
  }
  g.rect(apexX - 2, 229, 1, 3, 'boardHi');
  g.rect(apexX + 2, 229, 1, 3, 'boardHi');

  // Columns: capital, fluted shaft lit from the left with a warm rim on the right, base.
  for (const cx of COURT.columns) {
    const top = columnTop;
    const bottom = columnBottom;
    g.rect(cx - 3, top, 19, 2, 'marbleHi');
    g.rect(cx - 3, top + 2, 19, 1, 'marbleShade');
    g.rect(cx - 2, top + 3, 17, 1, 'marble');
    g.rect(cx - 1, top + 4, 15, 1, 'marbleMid');
    SHAFT.forEach((color, i) => {
      g.rect(cx + i, top + 5, 1, bottom - top - 9, color);
    });
    g.rect(cx - 1, bottom - 4, 15, 1, 'marbleMid');
    g.rect(cx - 2, bottom - 3, 17, 1, 'marble');
    g.rect(cx - 3, bottom - 2, 19, 2, 'marbleHi');
    g.rect(cx - 3, bottom - 1, 19, 1, 'marbleShade');
  }

  // Entablature: cornice, frieze with dentils, architrave.
  const eTop = pedimentBase;
  const eW = right - left;
  g.rect(left - 5, eTop, eW + 10, 1, 'outline');
  g.rect(left - 5, eTop + 1, eW + 10, 2, 'marbleHi');
  g.rect(left - 4, eTop + 3, eW + 8, 1, 'marbleShade');
  g.rect(left - 1, eTop + 4, eW + 2, 9, 'marble');
  for (let x = left; x < right - 2; x += 5) {
    g.rect(x + 1, eTop + 6, 3, 3, 'marbleMid');
    g.rect(x + 1, eTop + 9, 3, 1, 'marbleShade');
  }
  g.rect(left - 1, eTop + 13, eW + 2, 2, 'marbleHi');
  g.rect(left - 1, eTop + 15, eW + 2, 1, 'marble');
  g.rect(left - 1, eTop + 16, eW + 2, 1, 'marbleHi');
  g.rect(left - 1, eTop + 17, eW + 2, 1, 'marbleDark');
  g.rect(right + 4, eTop + 1, 1, 3, 'rim');

  // Pediment: raking cornice around a shaded tympanum with the court's seal.
  const halfWidth = (y: number) =>
    Math.round(((y - apexY) * (apexX - left + 7)) / (pedimentBase - apexY));
  for (let y = apexY; y < pedimentBase; y++) {
    const hw = halfWidth(y);
    g.rect(apexX - hw, y, hw * 2 + 1, 1, 'marble');
    g.rect(apexX - hw + 5, y, Math.max(0, hw * 2 - 9), 1, y > apexY + 4 ? 'marbleMid' : 'marble');
    // Continuous outline along the slope: fill the run since the previous row.
    const run = Math.max(1, hw - halfWidth(y - 1));
    g.rect(apexX - hw, y, run, 1, 'outline');
    g.rect(apexX + hw - run + 1, y, run, 1, 'outline');
    g.rect(apexX - hw + run, y, 2, 1, 'marbleHi');
    g.rect(apexX + hw - run - 1, y, 2, 1, 'rim');
  }
  g.rect(apexX - 2, apexY - 1, 5, 1, 'outline');
  g.rect(left + 8, pedimentBase - 4, right - left - 16, 3, 'marbleShade');
  g.rect(left + 5, pedimentBase - 1, right - left - 10, 1, 'marbleHi');
  // The seal: a ringed medallion with the scales of justice.
  const sealY = 148;
  for (let y = -8; y <= 8; y++) {
    for (let x = -8; x <= 8; x++) {
      const d = Math.hypot(x, y);
      if (d <= 7.4 && d > 6) g.px(apexX + x, sealY + y, 'marbleDark');
      else if (d <= 6 && d > 4.6) g.px(apexX + x, sealY + y, 'marbleHi');
      else if (d <= 4.6) g.px(apexX + x, sealY + y, 'marble');
    }
  }
  g.rect(apexX, sealY - 3, 1, 6, 'marbleShade');
  g.rect(apexX - 3, sealY - 2, 7, 1, 'marbleShade');
  g.rect(apexX - 4, sealY, 3, 1, 'marbleShade');
  g.rect(apexX + 2, sealY, 3, 1, 'marbleShade');
  g.rect(apexX - 1, sealY + 3, 3, 1, 'marbleShade');
  // Acroterion on the apex.
  g.rect(apexX - 1, apexY - 4, 3, 3, 'marble');
  g.rect(apexX - 1, apexY - 4, 3, 1, 'marbleHi');
  g.rect(apexX - 2, apexY - 2, 5, 1, 'outline');

  // Steps down to the plaza, widening as they descend.
  const steps = 8;
  const stepH = (COURT.plazaY - COURT.stepsTop) / steps;
  for (let i = 0; i < steps; i++) {
    const y = COURT.stepsTop + Math.round(i * stepH);
    const inset = 3 - i * 2;
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
  g.rect(0, COURT.plazaY - 1, right + 18, 1, 'marbleShade');
}

// Tower ------------------------------------------------------------------------------------------

const TOWER = {
  left: 497,
  front: 588,
  right: 617,
  roof: 93,
  base: 277,
  door: { x: 527, w: 32, top: 243 },
};

/** The rooftop billboard's frame. */
const BILLBOARD = { x: 480, y: 36, w: 144, h: 44 };

/** X of each billboard lamp; `arena.ts` lights their bulbs. */
export const BILLBOARD_LAMPS: readonly number[] = [496, 524, 552, 580, 608];
/** Y of the billboard bulbs (3×1 px each, under the lamp arms). */
export const BILLBOARD_BULB_Y = BILLBOARD.y - 3;

/**
 * Glyphs for "BUFETE & PESAS S.A.", the billboard's "PESAS Y PLEITOS" and the Boissons
 * chalkboard's "JUEVES 2×1".
 */
const SMALL_FONT: Readonly<Record<string, readonly string[]>> = {
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  L: ['#..', '#..', '#..', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
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
      const base: SceneryColor = row < 4 ? 'glassTop' : row < 10 ? 'glass' : 'glassLow';
      g.rect(px, py, 8, 9, base);
      // Warm sun reflection on the edge facing the sun, dithered into the blue.
      if (col === 0) g.rect(px, py, 8, 9, 'glassWarm');
      if (col === 1) g.checker(px, py, 4, 9, 'glassWarm');
      // Two diagonal sheens sweeping across the facade.
      const diag = col * 2 - row;
      if (diag === 3 || diag === 4 || diag === 11) {
        for (let i = 0; i < 9; i++) g.rect(px + Math.max(0, 7 - i), py + i, 2, 1, 'glassHi');
      }
      if (diag === 4) g.rect(px, py, 8, 1, 'glassShine');
      g.px(px, py, 'glassHi');
    }
    // A steel spandrel band every fifth floor.
    if (row % 5 === 4) g.rect(left, py + 9, front - left, 1, 'steelHi');
  }
  // Side face, in shadow.
  for (let row = 0; row * 10 + roof + 3 < base - 4; row++) {
    const py = roof + 3 + row * 10;
    g.rect(front, py - 3, right - front, 1, 'sideMullion');
    for (const px of [front + 1, front + 10, front + 19]) {
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
  const { x: bx, y: by, w: bw, h: bh } = BILLBOARD;
  for (const lx of [506, 551, 596]) {
    g.rect(lx, by + bh - 1, 2, roof - 5 - (by + bh - 1), 'ink');
  }
  g.rect(504, by + bh + 3, 96, 1, 'ink');
  for (let i = 0; i < 8; i++) g.px(508 + i * 12, by + bh + 2 - (i % 2), 'ink');

  g.rect(bx, by, bw, bh, 'ink');
  g.rect(bx + 2, by + 2, bw - 4, bh - 4, 'board');
  g.rect(bx + 2, by + 2, bw - 4, 2, 'boardHi');
  g.rect(bx + 2, by + bh - 5, bw - 4, 3, 'boardShade');
  g.checker(bx + 2, by + bh - 6, bw - 4, 1, 'boardShade');
  // Gym ad: a dumbbell over a gavel, "¡INSCRÍBETE!", the firm's name and its motto.
  const dx = bx + 8;
  const dy = by + 5;
  g.rect(dx + 9, dy + 7, 24, 4, 'iron');
  g.rect(dx + 9, dy + 7, 24, 1, 'boardHi');
  g.rect(dx + 9, dy + 10, 24, 1, 'plateLight');
  for (const [px, h] of [
    [dx, 17],
    [dx + 5, 12],
    [dx + 32, 12],
    [dx + 37, 17],
  ] as const) {
    const top = dy + 9 - Math.floor(h / 2);
    g.rect(px, top, 5, h, 'plateDark');
    g.rect(px + 1, top + 1, 1, h - 3, 'plateLight');
    g.rect(px + 1, top + 1, 3, 1, 'plateLight');
  }
  // Gavel lying under the dumbbell: banded head on the left, handle to the right.
  const gx = bx + 9;
  const gy = by + 25;
  g.rect(gx, gy, 12, 9, 'ink');
  g.rect(gx + 1, gy + 1, 10, 7, 'woodDark');
  g.rect(gx + 1, gy + 1, 10, 2, 'wood');
  g.rect(gx + 3, gy + 1, 1, 7, 'boardShade');
  g.rect(gx + 8, gy + 1, 1, 7, 'boardShade');
  g.rect(gx + 12, gy + 3, 26, 4, 'ink');
  g.rect(gx + 12, gy + 4, 25, 1, 'wood');
  g.rect(gx + 12, gy + 5, 25, 1, 'woodDark');
  const textX = bx + 54;
  const textW = bw - 58;
  const cta = '¡INSCRÍBETE!';
  paintText(
    g,
    BIG_FONT,
    cta,
    textX + Math.floor((textW - textWidth(BIG_FONT, cta)) / 2),
    by + 9,
    'ink',
  );
  const firm = 'BUFETE & PESAS';
  paintText(
    g,
    SMALL_FONT,
    firm,
    textX + Math.floor((textW - textWidth(SMALL_FONT, firm)) / 2),
    by + 21,
    'ink',
  );
  const motto = 'PESAS Y PLEITOS';
  paintText(
    g,
    SMALL_FONT,
    motto,
    textX + Math.floor((textW - textWidth(SMALL_FONT, motto)) / 2),
    by + 29,
    'awningRed',
  );

  // Lamp arms over the billboard (the bulbs themselves blink, drawn per frame).
  for (const lx of BILLBOARD_LAMPS) {
    g.rect(lx - 3, by - 5, 7, 2, 'steel');
    g.rect(lx - 3, by - 5, 7, 1, 'steelHi');
    g.rect(lx, by - 3, 1, 3, 'ink');
  }

  // Company sign, overhanging the facade.
  const name = 'BUFETE & PESAS S.A.';
  const nameW = textWidth(SMALL_FONT, name);
  const sx = left - 6;
  const sw = front - left + 12;
  const sy = 200;
  g.rect(sx, sy, sw, 13, 'plate');
  g.rect(sx, sy, sw, 1, 'plateEdge');
  g.rect(sx, sy + 12, sw, 1, 'outline');
  g.rect(sx, sy, 1, 13, 'plateEdge');
  paintText(g, SMALL_FONT, name, sx + Math.floor((sw - nameW) / 2), sy + 4, 'plateText');

  // Entrance: canopy, glass doors, steel jambs.
  g.rect(door.x - 6, door.top - 4, door.w + 12, 3, 'steel');
  g.rect(door.x - 6, door.top - 4, door.w + 12, 1, 'steelHi');
  g.rect(door.x - 2, door.top - 1, door.w + 4, base - door.top + 1, 'steel');
  g.rect(door.x, door.top, door.w, base - door.top, 'glassHi');
  g.rect(door.x, door.top, door.w, 3, 'glassShine');
  g.rect(door.x + door.w / 2 - 1, door.top, 2, base - door.top, 'steel');
  g.rect(door.x + 4, door.top + 13, 8, 1, 'glass');
  g.rect(door.x + 20, door.top + 13, 8, 1, 'glass');
  g.rect(door.x + 2, door.top + 5, 1, 6, 'glassShine');
  g.rect(door.x + 18, door.top + 5, 1, 6, 'glassShine');
  g.rect(left, base - 2, right - left, 2, 'steel');
  // Entrance landing, stepping down to the plaza.
  g.rect(door.x - 8, base, door.w + 16, 6, 'wallCap');
  g.rect(door.x - 8, base, door.w + 16, 1, 'wallTop');
  g.rect(door.x - 10, base + 3, door.w + 20, 1, 'wallTop');
  g.rect(door.x - 10, base + 4, door.w + 20, 2, 'wall');
}

// Boissons ----------------------------------------------------------------------------------------

/** Boissons, the cocktail bar on the plaza (its Thursday 2×1 cocktails are a running joke). */
const BAR = { left: 373, right: 467, top: 221 };

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

/** A warm bar window with shelves of bottles, framed in dark wood. */
function paintBarWindow(g: Grid, x: number, y: number, w: number, h: number): void {
  g.rect(x - 1, y - 1, w + 2, h + 2, 'woodDark');
  g.rect(x, y, w, h, 'barWarm');
  g.rect(x + 2, y + 1, w - 4, h - 4, 'barGlow');
  g.checker(x + 1, y + h - 3, w - 2, 2, 'barGlow');
  // Shelves with bottles (and the odd olive).
  for (const shelf of [8, 15]) {
    if (shelf > h - 4) continue;
    g.rect(x, y + shelf, w, 1, 'doorHi');
    for (let bx = x + 2; bx < x + w - 2; bx += 3) {
      const tall = hash(bx, y + shelf) < 0.5;
      g.rect(bx, y + shelf - (tall ? 5 : 3), 1, tall ? 5 : 3, 'bottle');
      g.px(bx, y + shelf - (tall ? 6 : 4), 'bottle');
      if (hash(y + shelf, bx) < 0.4) g.px(bx, y + shelf - 2, 'olive');
    }
  }
  // A window cross and the sill.
  g.rect(x + Math.floor(w / 2), y, 1, h, 'woodDark');
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
  g.rect(right - 4, top, 4, PLAZA_Y - top, 'brickShade');
  g.rect(left, top, 1, PLAZA_Y - top, 'rim');
  g.rect(left - 1, top, 1, PLAZA_Y - top, 'outline');
  g.rect(right, top, 1, PLAZA_Y - top, 'outline');
  // Cornice.
  g.rect(left - 3, top - 4, w + 6, 1, 'outline');
  g.rect(left - 3, top - 3, w + 6, 2, 'wallTop');
  g.rect(left - 2, top - 1, w + 4, 1, 'wallCap');
  g.rect(left - 2, top, w + 4, 1, 'wallShadow');

  // Neon sign: a cocktail glass and "BOISSONS" on a dark backing board.
  const sx = left + 3;
  const sy = top + 4;
  const sw = w - 6;
  const sh = 15;
  g.rect(sx, sy, sw, sh, 'outline');
  g.rect(sx + 1, sy + 1, sw - 2, sh - 2, 'neonBack');
  const name = 'BOISSONS';
  const glassW = 7;
  const contentW = glassW + 4 + textWidth(BIG_FONT, name);
  const cx = sx + Math.floor((sw - contentW) / 2);
  const glass = ['#######', '.#...#.', '..#.#..', '...#...', '...#...', '...#...', '..###..'];
  const glassFont = { Y: glass };
  paintNeon(g, glassFont, 'Y', cx, sy + 4, 'neonCyanGlow', 'neonCyan');
  g.px(cx + 3, sy + 5, 'olive');
  paintNeon(g, BIG_FONT, name, cx + glassW + 4, sy + 4, 'neonGlow', 'neonPink');
  // A brighter core on the tube's top row gives the neon some sheen.
  g.checker(cx + glassW + 4, sy + 4, textWidth(BIG_FONT, name), 1, 'lampCore');
  // Mounting bolts at the board's corners.
  for (const [bx, by] of [
    [sx + 2, sy + 2],
    [sx + sw - 3, sy + 2],
    [sx + 2, sy + sh - 3],
    [sx + sw - 3, sy + sh - 3],
  ] as const) {
    g.px(bx, by, 'iron');
  }

  // Striped awning with a scalloped edge and its shadow on the bricks.
  const ay = top + 23;
  g.rect(left - 4, ay - 1, w + 8, 1, 'outline');
  for (let x = left - 4; x < right + 4; x++) {
    const stripe = (x - left + 4) % 5;
    const red = Math.floor((x - left + 4) / 5) % 2 === 0;
    g.rect(x, ay, 1, 6, red ? 'awningRed' : 'awningCream');
    g.px(x, ay + 1, red ? 'brick' : 'wallTop');
    g.px(x, ay + 5, red ? 'brick' : 'wallTop');
    if (stripe >= 1 && stripe <= 3) g.px(x, ay + 6, red ? 'brick' : 'wallTop');
  }
  g.rect(left, ay + 7, w, 1, 'mortar');
  g.checker(left, ay + 8, w, 1, 'mortar');

  // Two warm windows and a door with a glowing pane.
  const wy = ay + 11;
  paintBarWindow(g, left + 5, wy, 26, 20);
  paintBarWindow(g, right - 31, wy, 26, 20);
  const doorX = left + w / 2 - 8;
  g.rect(doorX - 1, wy - 2, 18, PLAZA_Y - wy + 2, 'woodDark');
  g.rect(doorX, wy - 1, 16, PLAZA_Y - wy + 1, 'door');
  g.rect(doorX + 2, wy + 1, 12, 12, 'barGlow');
  g.rect(doorX + 2, wy + 1, 12, 1, 'barWarm');
  g.rect(doorX + 7, wy + 1, 1, 12, 'barWarm');
  g.rect(doorX + 2, wy + 16, 12, 1, 'doorHi');
  g.rect(doorX + 12, wy + 19, 1, 2, 'boardHi');

  // Warm light spilling onto the plaza tiles in front of the bar.
  for (const [x0, x1] of [
    [left + 3, left + 33],
    [doorX, doorX + 16],
    [right - 33, right - 3],
  ] as const) {
    g.checker(x0, PLAZA_Y, x1 - x0, 1, 'floorSheen');
    for (let x = x0 + 1; x < x1 - 1; x += 2) {
      if ((x + PLAZA_Y) % 4 === 1) g.px(x, PLAZA_Y + 1, 'floorSheen');
    }
  }

  // Chalkboard A-frame on the plaza: "JUEVES 2×1" (cocktails, of course).
  const bw = 31;
  const bh = 19;
  const bx = left + 4;
  const by = PLAZA_Y - 14;
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
    by + 3,
    'chalk',
  );
  paintText(g, SMALL_FONT, deal, bx + 5, by + 11, 'chalk');
  // A tiny chalk cocktail next to the deal.
  const tx = bx + 20;
  const ty = by + 11;
  g.rect(tx, ty, 5, 1, 'chalk');
  g.rect(tx + 1, ty + 1, 3, 1, 'chalk');
  g.rect(tx + 2, ty + 2, 1, 2, 'chalk');
  g.rect(tx + 1, ty + 4, 3, 1, 'chalk');
}

// Plaza -------------------------------------------------------------------------------------------

const WALL_TOP = 275;
const PLAZA_Y = 285;

function paintPlaza(g: Grid): void {
  // Low stone wall along the back of the plaza; the steps and tower entrance sit in front.
  const x0 = 187;
  const wallW = ARENA_WIDTH - x0;
  g.rect(x0, WALL_TOP, wallW, 1, 'wallTop');
  g.rect(x0, WALL_TOP + 1, wallW, 1, 'wallCap');
  g.rect(x0, WALL_TOP + 2, wallW, PLAZA_Y - WALL_TOP - 3, 'wall');
  g.rect(x0, PLAZA_Y - 1, wallW, 1, 'wallShadow');
  g.rect(x0, WALL_TOP + 5, wallW, 1, 'wallSeam');
  for (let x = x0; x < ARENA_WIDTH; x += 12) {
    g.rect(x, WALL_TOP + 2, 1, 3, 'wallSeam');
    g.rect(x + 6, WALL_TOP + 6, 1, 3, 'wallSeam');
  }

  // Benches and street lamps, lit for the evening.
  for (const bx of [272, 326, 588]) paintBench(g, bx, PLAZA_Y - 1);
  for (const lx of [245, 478]) paintLamp(g, lx, PLAZA_Y);

  // Floor tiles receding toward a vanishing point behind the skyline.
  const vanishX = 320;
  const vanishY = 160;
  const tileRows = [PLAZA_Y, 289, 294, 301, 309, GROUND_Y];
  for (let r = 0; r < tileRows.length - 1; r++) {
    const top = tileRows[r] ?? PLAZA_Y;
    const bottom = tileRows[r + 1] ?? GROUND_Y;
    const color: SceneryColor = r < 2 ? 'floorFar' : r < 4 ? 'floorMid' : 'floorNear';
    g.rect(0, top, ARENA_WIDTH, bottom - top, color);
    if (r > 0) g.rect(0, top, ARENA_WIDTH, 1, 'grout');
    for (let y = top + 1; y < bottom; y++) {
      const t = (y - vanishY) / (GROUND_Y - vanishY);
      for (let k = -18; k <= 18; k++) {
        const x = Math.round(vanishX + (k + (r % 2) * 0.5) * 51 * t);
        g.px(x, y, 'grout');
      }
    }
  }
  // Curb at the ground line, then calm front pavement under the Dialogue Box.
  g.rect(0, GROUND_Y, ARENA_WIDTH, 1, 'curbTop');
  g.rect(0, GROUND_Y + 1, ARENA_WIDTH, 1, 'curbHi');
  g.rect(0, GROUND_Y + 2, ARENA_WIDTH, 4, 'curb');
  g.rect(0, GROUND_Y + 6, ARENA_WIDTH, 1, 'curbShadow');
  for (let x = 18; x < ARENA_WIDTH; x += 64) g.rect(x, GROUND_Y + 1, 1, 5, 'curbShadow');
  const paveTop = GROUND_Y + 7;
  g.rect(0, paveTop, ARENA_WIDTH, ARENA_HEIGHT - paveTop, 'pave');
  g.checker(0, 344, ARENA_WIDTH, 1, 'paveDark');
  g.rect(0, 345, ARENA_WIDTH, ARENA_HEIGHT - 345, 'paveDark');
  for (const [y, offset] of [
    [336, 0],
    [353, 40],
  ] as const) {
    g.rect(0, y, ARENA_WIDTH, 1, 'paveSeam');
    for (let x = offset; x < ARENA_WIDTH; x += 80) g.rect(x, y - 8, 1, 8, 'paveSeam');
  }
  for (let x = 32; x < ARENA_WIDTH; x += 80) g.rect(x, paveTop, 1, 6, 'paveSeam');
}

function paintBench(g: Grid, x: number, groundY: number): void {
  g.rect(x, groundY - 10, 20, 2, 'wood');
  g.rect(x, groundY - 10, 20, 1, 'wallTop');
  g.rect(x, groundY - 8, 20, 1, 'woodDark');
  g.rect(x - 1, groundY - 5, 22, 2, 'wood');
  g.rect(x - 1, groundY - 5, 22, 1, 'wallTop');
  g.rect(x - 1, groundY - 3, 22, 1, 'woodDark');
  for (const lx of [x + 1, x + 17]) g.rect(lx, groundY - 8, 2, 9, 'lampPost');
}

function paintLamp(g: Grid, x: number, groundY: number): void {
  const top = groundY - 53;
  g.rect(x - 2, groundY - 4, 5, 4, 'lampPost');
  g.rect(x - 1, groundY - 6, 3, 2, 'lampPost');
  g.rect(x, top + 6, 1, 47, 'lampPost');
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
