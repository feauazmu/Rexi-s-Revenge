/**
 * Title screen: backdrop, the "Rexi's Revenge" logo in the empty sky at the upper left, the
 * local top 10 below it, the start prompt and the credits line.
 *
 * The backdrop is either the bundled title illustration (a 480×270 bitmap handed to the
 * renderer, per ADR 0001) or, until it is wired in, a code-drawn sunset plaza with the same
 * composition, so the logo and text layout work over both.
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import type { Bitmap, Color, Surface } from '../surface';
import { fonts } from '../text';
import { drawHighScores, HIGH_SCORES_WIDTH } from './high-scores';
import { buildLogo } from './logo';
import { blinkOn, drawOutlinedText, fillCircle, ui } from './ui';

const LOGO = buildLogo(
  strings.title
    .toUpperCase()
    .split(' ')
    .map((text, i) => ({ text, scale: i === 0 ? 4 : 5 })),
);
const LOGO_X = 14;
const LOGO_Y = 12;
/** The logo drops in from above over this many ticks when the Title appears. */
const LOGO_DROP_TICKS = 18;

/** The top 10 slides in from the left once the logo has landed. */
const SCORES_X = 12;
const SCORES_Y = 92;
const SCORES_SLIDE_TICKS = 12;

const PROMPT_CENTER_X = 124;
const PROMPT_Y = 224;
const CREDITS_BAND_Y = 254;

export function drawTitleScreen(dc: DrawContext, illustration: Bitmap | null): void {
  const { view } = dc;
  if (illustration) dc.surface.drawBitmap(illustration, 0, 0);
  else drawBackdrop(dc.surface, dc, view);

  const drop = Math.max(0, LOGO_DROP_TICKS - view.screenAge);
  const logoY = LOGO_Y - Math.round((drop * drop * (LOGO.height + LOGO_Y)) / LOGO_DROP_TICKS ** 2);
  dc.surface.drawBitmap(dc.sprites.get(LOGO), LOGO_X, logoY);

  const slide = Math.max(
    0,
    Math.min(SCORES_SLIDE_TICKS, LOGO_DROP_TICKS + SCORES_SLIDE_TICKS - view.screenAge),
  );
  const scoresX =
    SCORES_X -
    Math.round((slide * slide * (HIGH_SCORES_WIDTH + SCORES_X)) / SCORES_SLIDE_TICKS ** 2);
  drawHighScores(dc, view.highScores, scoresX, SCORES_Y);

  if (view.startReady && blinkOn(view.tick)) {
    const prompt =
      view.device === 'touch' ? strings.titleScreen.tapToStart : strings.titleScreen.pressAnyKey;
    drawOutlinedText(dc, fonts.regular, prompt, PROMPT_CENTER_X, PROMPT_Y, ui.gold, {
      align: 'center',
    });
  }

  dc.surface.fillRect(0, CREDITS_BAND_Y, SCREEN_WIDTH, SCREEN_HEIGHT - CREDITS_BAND_Y, ui.ink);
  dc.surface.fillRect(0, CREDITS_BAND_Y, SCREEN_WIDTH, 1, ui.panelLight);
  drawOutlinedText(
    dc,
    fonts.regular,
    strings.titleScreen.credits,
    SCREEN_WIDTH / 2,
    CREDITS_BAND_Y + 2,
    ui.muted,
    { align: 'center' },
  );
}

// ---------------------------------------------------------------------------------------------
// Code-drawn backdrop: 80s sunset over the plaza, striped sun behind the courthouse.

const HORIZON = 198;
const SKY: readonly (readonly [until: number, color: Color])[] = [
  [40, '#3a2560'],
  [72, '#4d2c6c'],
  [100, '#653373'],
  [124, '#823b74'],
  [144, '#a2456f'],
  [160, '#c25466'],
  [174, '#df6a5a'],
  [186, '#f08a50'],
  [HORIZON, '#f8ae58'],
];

function skyColorAt(y: number): Color {
  return SKY.find(([until]) => y < until)?.[1] ?? '#f8ae58';
}

const SUN = { x: 246, y: HORIZON - 2, r: 38 } as const;
const SUN_TOP: Color = '#ffe27a';
const SUN_BOTTOM: Color = '#ff9f4a';

/** Distant skyline: [x, width, height] of each building, left to right. */
const SKYLINE: readonly (readonly [number, number, number])[] = [
  [0, 18, 26],
  [16, 14, 40],
  [30, 22, 30],
  [50, 10, 52],
  [60, 20, 36],
  [80, 16, 24],
  [96, 26, 44],
  [122, 12, 30],
  [134, 18, 58],
  [152, 24, 34],
  [176, 14, 46],
  [190, 12, 22],
  [262, 14, 18],
  [276, 18, 30],
  [446, 14, 30],
  [458, 22, 48],
];
const SKYLINE_FAR: Color = '#5b2f66';
const SKYLINE_WINDOW: Color = '#8a4a78';

const STONE: Color = '#eadfca';
const STONE_SHADE: Color = '#b9a68e';
const STONE_DARK: Color = '#7d6a62';
const ROOF: Color = '#d6c7ae';

const GROUND: Color = '#5c4660';
const GROUND_LIGHT: Color = '#7a5c72';
const GROUND_LINE: Color = '#48344e';

/** Long thin clouds: [x, y, width]. They drift a few pixels back and forth with the tick. */
const CLOUDS: readonly (readonly [number, number, number])[] = [
  [250, 34, 54],
  [370, 62, 40],
  [300, 96, 64],
  [40, 120, 46],
];
const CLOUD: Color = '#8a4a86';
const CLOUD_SHADE: Color = '#6e3c74';

const COPTER = defineSprite({ k: '#2c1838' }, [
  'kkkkkkkkkkkkk',
  '......k......',
  '..kkkkkkkk...',
  '.kkkkkkkkkk.k',
  '.kkkkkkkkkkkk',
  '..kkkkkkkk..k',
  '...k....k....',
]);

function drawBackdrop(surface: Surface, dc: DrawContext, view: GameView): void {
  let top = 0;
  for (const [until, color] of SKY) {
    surface.fillRect(0, top, SCREEN_WIDTH, until - top, color);
    top = until;
  }

  drawSun(surface);

  for (const [x, w, h] of SKYLINE) {
    surface.fillRect(x, HORIZON - h, w, h, SKYLINE_FAR);
    for (let wy = HORIZON - h + 4; wy < HORIZON - 4; wy += 6) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) surface.fillRect(wx, wy, 2, 2, SKYLINE_WINDOW);
    }
  }

  for (const [x, y, w] of CLOUDS) {
    const cx = x + ((view.tick >> 4) % 8);
    surface.fillRect(cx, y, w, 2, CLOUD);
    surface.fillRect(cx + 6, y - 2, w - 14, 2, CLOUD);
    surface.fillRect(cx + 3, y + 2, w - 6, 1, CLOUD_SHADE);
  }

  // Two Maletín-cópteros hovering over the city, bobbing on a triangle wave of the view tick.
  const bob = (phase: number) => {
    const t = (view.tick + phase) % 80;
    return Math.round((t < 40 ? t : 80 - t) / 10);
  };
  surface.drawBitmap(dc.sprites.get(COPTER), 160, 128 + bob(0));
  surface.drawBitmap(dc.sprites.get(COPTER), 196, 142 + bob(30));

  drawCourthouse(surface, 304, HORIZON);
  drawGround(surface);
}

function drawSun(surface: Surface): void {
  for (let dy = -SUN.r; dy <= 0; dy++) {
    const y = SUN.y + dy;
    if (y >= HORIZON) continue;
    const half = Math.round(Math.sqrt(SUN.r * SUN.r - dy * dy));
    const color = dy < -SUN.r / 2 ? SUN_TOP : SUN_BOTTOM;
    surface.fillRect(SUN.x - half, y, half * 2 + 1, 1, color);
  }
  // Synthwave stripes: gaps of sky that widen toward the horizon.
  let y = SUN.y - 14;
  for (let gap = 1; y < HORIZON; gap += 1) {
    surface.fillRect(SUN.x - SUN.r, y, SUN.r * 2 + 1, gap, skyColorAt(y));
    y += gap + 4;
  }
}

/** A columned courthouse: stepped pediment, entablature, six columns and front steps. */
function drawCourthouse(surface: Surface, x: number, ground: number): void {
  const w = 150;
  const stepsH = 9;
  const columnsH = 46;
  const beamH = 8;
  const base = ground - stepsH;
  const beamTop = base - columnsH - beamH;

  // Pediment: stepped triangle.
  const pedimentH = 18;
  for (let i = 0; i < pedimentH; i++) {
    const inset = Math.round(((pedimentH - i) * (w / 2 - 4)) / pedimentH);
    surface.fillRect(x + inset, beamTop - pedimentH + i, w - inset * 2, 1, ROOF);
  }
  surface.fillRect(x + 4, beamTop - 2, w - 8, 2, STONE_SHADE);
  fillCircle(surface, x + w / 2, beamTop - 7, 3, STONE_SHADE);

  // Entablature.
  surface.fillRect(x - 2, beamTop, w + 4, beamH, STONE);
  surface.fillRect(x - 2, beamTop + beamH - 2, w + 4, 2, STONE_SHADE);

  // Hall behind the columns, then the columns.
  surface.fillRect(x + 6, beamTop + beamH, w - 12, columnsH, STONE_DARK);
  const columns = 6;
  const colW = 10;
  const spacing = (w - 16 - colW) / (columns - 1);
  for (let i = 0; i < columns; i++) {
    const cx = Math.round(x + 8 + i * spacing);
    surface.fillRect(cx - 1, beamTop + beamH, colW + 2, 3, STONE);
    surface.fillRect(cx, beamTop + beamH + 3, colW, columnsH - 6, STONE);
    surface.fillRect(cx + colW - 3, beamTop + beamH + 3, 3, columnsH - 6, STONE_SHADE);
    surface.fillRect(cx + 3, beamTop + beamH + 3, 1, columnsH - 6, STONE_SHADE);
    surface.fillRect(cx - 1, base - 3, colW + 2, 3, STONE);
  }

  // Steps, each wider than the one above.
  for (let i = 0; i < 3; i++) {
    const inset = 6 - i * 4;
    surface.fillRect(
      x + inset - 4,
      base + i * 3,
      w - inset * 2 + 8,
      3,
      i % 2 ? STONE_SHADE : STONE,
    );
  }
}

function drawGround(surface: Surface): void {
  surface.fillRect(0, HORIZON, SCREEN_WIDTH, SCREEN_HEIGHT - HORIZON, GROUND);
  surface.fillRect(0, HORIZON, SCREEN_WIDTH, 2, GROUND_LIGHT);
  // Paving rows get taller toward the viewer, and their joints wider apart and staggered.
  let y = HORIZON + 2;
  for (let row = 0; y < SCREEN_HEIGHT; row++) {
    const h = 3 + row * 2;
    surface.fillRect(0, y, SCREEN_WIDTH, 1, GROUND_LINE);
    const joint = 20 + row * 10;
    const offset = row % 2 ? joint / 2 : 0;
    for (let x = offset - joint; x < SCREEN_WIDTH; x += joint) {
      surface.fillRect(Math.round(x), y + 1, 1, h - 1, GROUND_LINE);
      surface.fillRect(Math.round(x) + 1, y + 1, joint - 1, 1, GROUND_LIGHT);
    }
    y += h;
  }
}
