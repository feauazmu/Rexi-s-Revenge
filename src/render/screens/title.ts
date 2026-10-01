/**
 * Title screen: the title illustration, the "Rexi's Revenge" logo in its empty sky at the upper
 * left, and below it, in the same left column, the local top 10, the start prompt and the
 * credits line. Rexi stays uncovered on the right.
 *
 * The backdrop is the bundled title illustration (a 640×360 bitmap the platform decodes and
 * hands to the renderer, per ADR 0001) or, when it is missing, a code-drawn sunset plaza with
 * the same composition, so the layout works over both. Over the illustration, every text sits
 * on a solid dark plate or has a black outline, so it stays readable over the busy art.
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH, type GameView } from '../../core';
import { drawLogo, LOGO_HEIGHT, LOGO_WIDTH } from '../brand/logo';
import type { DrawContext } from '../draw-context';
import { masterPalette } from '../palette';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import type { Bitmap, Color, Surface } from '../surface';
import { fonts } from '../text';
import { drawHighScores, HIGH_SCORES_WIDTH } from './high-scores';
import { blinkOn, drawOutlinedText, fillCircle } from './ui';

/** Center of the left column (the sky over the courthouse) that holds everything but Rexi. */
export const COLUMN_CENTER_X = 160;

const LOGO_X = COLUMN_CENTER_X - LOGO_WIDTH / 2;
const LOGO_Y = 10;
/** The logo drops in from above over this many ticks when the Title appears. */
const LOGO_DROP_TICKS = 18;

/** The top 10 slides in from the left once the logo has landed. */
const SCORES_X = COLUMN_CENTER_X - HIGH_SCORES_WIDTH / 2;
const SCORES_Y = LOGO_Y + LOGO_HEIGHT + 8;
const SCORES_SLIDE_TICKS = 12;

/** Top of the start prompt's text cell, and its plate's padding around the capitals. */
const PROMPT_Y = 300;
const PLATE_PAD_X = 8;

/** Top of the credits line's text cell. */
const CREDITS_Y = 340;

const ink = {
  outline: masterPalette.outline,
  plate: masterPalette.night,
  plateEdge: masterPalette.robeSheen,
  prompt: masterPalette.gold,
  credits: masterPalette.grey3,
} as const satisfies Record<string, Color>;

export function drawTitleScreen(dc: DrawContext, illustration: Bitmap | null): void {
  const { view } = dc;
  if (illustration) dc.surface.drawBitmap(illustration, 0, 0);
  else drawBackdrop(dc.surface, dc, view);

  const drop = Math.max(0, LOGO_DROP_TICKS - view.screenAge);
  const logoY = LOGO_Y - Math.round((drop * drop * (LOGO_HEIGHT + LOGO_Y)) / LOGO_DROP_TICKS ** 2);
  // The shine sweeps start once the logo has landed.
  drawLogo(dc.surface, dc.sprites, LOGO_X, logoY, view.screenAge - LOGO_DROP_TICKS);

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
    drawPlate(dc.surface, fonts.regular.measure(prompt) + PLATE_PAD_X * 2, PROMPT_Y);
    drawOutlinedText(dc, fonts.regular, prompt, COLUMN_CENTER_X, PROMPT_Y, ink.prompt, {
      align: 'center',
      outline: ink.outline,
    });
  }

  drawOutlinedText(
    dc,
    fonts.regular,
    strings.titleScreen.credits,
    COLUMN_CENTER_X,
    CREDITS_Y,
    ink.credits,
    { align: 'center', outline: ink.outline },
  );
}

/**
 * A dark plate behind one line of regular text whose cell top is `textY`, centered on the
 * column: black outline with cut corners, a lighter top edge and a solid fill.
 */
function drawPlate(surface: Surface, width: number, textY: number): void {
  const capTop = textY + fonts.regular.baseline - 7;
  const x = Math.round(COLUMN_CENTER_X - width / 2);
  const y = capTop - 5;
  const h = 7 + 10;
  surface.fillRect(x + 1, y, width - 2, h, ink.outline);
  surface.fillRect(x, y + 1, width, h - 2, ink.outline);
  surface.fillRect(x + 1, y + 1, width - 2, h - 2, ink.plate);
  surface.fillRect(x + 2, y + 1, width - 4, 1, ink.plateEdge);
}

// ---------------------------------------------------------------------------------------------
// Code-drawn backdrop (when the illustration is missing): sunset over the plaza, striped sun
// behind the skyline, courthouse on the right.

const HORIZON = 264;
const SKY: readonly (readonly [until: number, color: Color])[] = [
  [53, masterPalette.skyIndigo],
  [96, masterPalette.skyPurple],
  [165, masterPalette.skyMagenta],
  [213, masterPalette.skyRose],
  [232, masterPalette.coral],
  [248, masterPalette.skyOrange],
  [HORIZON, masterPalette.gold],
];

function skyColorAt(y: number): Color {
  return SKY.find(([until]) => y < until)?.[1] ?? masterPalette.gold;
}

const SUN = { x: 328, y: HORIZON - 2, r: 50 } as const;
const SUN_TOP: Color = masterPalette.light;
const SUN_BOTTOM: Color = masterPalette.gold;

/** Distant skyline: [x, width, height] of each building, left to right. */
const SKYLINE: readonly (readonly [number, number, number])[] = [
  [0, 24, 35],
  [21, 19, 53],
  [40, 29, 40],
  [67, 13, 69],
  [80, 27, 48],
  [107, 21, 32],
  [128, 35, 59],
  [163, 16, 40],
  [179, 24, 77],
  [203, 32, 45],
  [235, 19, 61],
  [253, 16, 29],
  [349, 19, 24],
  [368, 24, 40],
  [595, 19, 40],
  [611, 29, 64],
];
const SKYLINE_FAR: Color = masterPalette.skyPurple;
const SKYLINE_WINDOW: Color = masterPalette.skyMagenta;

const STONE: Color = masterPalette.marble;
const STONE_SHADE: Color = masterPalette.stone2;
const STONE_DARK: Color = masterPalette.stone1;
const ROOF: Color = masterPalette.grey3;

const GROUND: Color = masterPalette.stone1;
const GROUND_LIGHT: Color = masterPalette.stone2;
const GROUND_LINE: Color = masterPalette.robeSheen;

/** Long thin clouds: [x, y, width]. They drift a few pixels back and forth with the tick. */
const CLOUDS: readonly (readonly [number, number, number])[] = [
  [333, 45, 72],
  [493, 83, 53],
  [400, 128, 85],
  [53, 160, 61],
];
const CLOUD: Color = masterPalette.skyMagenta;
const CLOUD_SHADE: Color = masterPalette.skyPurple;

const COPTER = defineSprite({ k: masterPalette.night }, [
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
    for (let wy = HORIZON - h + 5; wy < HORIZON - 5; wy += 8) {
      for (let wx = x + 4; wx < x + w - 4; wx += 7) surface.fillRect(wx, wy, 2, 2, SKYLINE_WINDOW);
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
  surface.drawBitmap(dc.sprites.get(COPTER), 347, 171 + bob(0));
  surface.drawBitmap(dc.sprites.get(COPTER), 387, 189 + bob(30));

  drawCourthouse(surface, 405, HORIZON);
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
  const w = 200;
  const stepsH = 12;
  const columnsH = 61;
  const beamH = 10;
  const base = ground - stepsH;
  const beamTop = base - columnsH - beamH;

  // Pediment: stepped triangle.
  const pedimentH = 24;
  for (let i = 0; i < pedimentH; i++) {
    const inset = Math.round(((pedimentH - i) * (w / 2 - 4)) / pedimentH);
    surface.fillRect(x + inset, beamTop - pedimentH + i, w - inset * 2, 1, ROOF);
  }
  surface.fillRect(x + 4, beamTop - 2, w - 8, 2, STONE_SHADE);
  fillCircle(surface, x + w / 2, beamTop - 9, 4, STONE_SHADE);

  // Entablature.
  surface.fillRect(x - 2, beamTop, w + 4, beamH, STONE);
  surface.fillRect(x - 2, beamTop + beamH - 2, w + 4, 2, STONE_SHADE);

  // Hall behind the columns, then the columns.
  surface.fillRect(x + 6, beamTop + beamH, w - 12, columnsH, STONE_DARK);
  const columns = 6;
  const colW = 13;
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
    const inset = 8 - i * 5;
    surface.fillRect(
      x + inset - 5,
      base + i * 4,
      w - inset * 2 + 10,
      4,
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
    const h = 4 + row * 3;
    surface.fillRect(0, y, SCREEN_WIDTH, 1, GROUND_LINE);
    const joint = 27 + row * 13;
    const offset = row % 2 ? joint / 2 : 0;
    for (let x = offset - joint; x < SCREEN_WIDTH; x += joint) {
      surface.fillRect(Math.round(x), y + 1, 1, h - 1, GROUND_LINE);
      surface.fillRect(Math.round(x) + 1, y + 1, joint - 1, 1, GROUND_LIGHT);
    }
    y += h;
  }
}
