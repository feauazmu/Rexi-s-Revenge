/**
 * Shared building blocks for the menu screens (Title, Cómo jugar, pause): colors, framed
 * panels, outlined text, keycaps and the dithered dimmer. Everything is solid rectangles and
 * code-drawn sprites, per the determinism rule.
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../core';
import type { DrawContext } from '../draw-context';
import { drawCornerBrackets, fillCutRect } from '../frame';
import { masterPalette } from '../palette';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Color, Surface } from '../surface';
import { drawText, fonts, type BitmapFont, type TextAlign, type TextTarget } from '../text';

/** The menu screens' colors: master-palette names only (ADR 0002). */
export const ui = {
  ink: masterPalette.outline,
  text: masterPalette.white,
  gold: masterPalette.gold,
  goldDeep: masterPalette.brass,
  goldLight: masterPalette.light,
  muted: masterPalette.grey2,
  /** Panels: robe fill on a night inner line, inside a robeMid bevel lit with robeSheen. */
  panel: masterPalette.robe,
  panelLight: masterPalette.robeMid,
  panelEdge: masterPalette.robeSheen,
  panelLine: masterPalette.night,
  dim: masterPalette.night,
  keyFace: masterPalette.marble,
  keyLip: masterPalette.grey2,
  keyShade: masterPalette.grey3,
  keyText: masterPalette.robe,
  keyLit: masterPalette.gold,
  wood: masterPalette.leather3,
  red: masterPalette.red3,
  redLight: masterPalette.coral,
  redShade: masterPalette.red2,
  ghost: masterPalette.grey3,
  knob: masterPalette.grey2,
  knobShade: masterPalette.grey1,
  backdrop: masterPalette.robe,
  backdropStripe: masterPalette.robeMid,
} as const satisfies Record<string, Color>;

/** Blinking for prompts: on for 2/3 of each second, phase taken from the view's tick. */
export function blinkOn(tick: number): boolean {
  return tick % 60 < 40;
}

/** Text with a 1 px outline all around (8 directions), legible over any background. */
export function drawOutlinedText(
  dc: TextTarget,
  font: BitmapFont,
  text: string,
  x: number,
  y: number,
  color: Color,
  options: { readonly outline?: Color; readonly align?: TextAlign } = {},
): void {
  const outline = options.outline ?? ui.ink;
  const align = options.align ?? 'left';
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) drawText(dc, font, text, x + dx, y + dy, { color: outline, align });
    }
  }
  drawText(dc, font, text, x, y, { color, align });
}

/**
 * A framed panel: outline with cut corners, a bevel (lit top and left, shaded bottom and
 * right), a night inner line, a robe fill with a highlight row, and brass corner brackets.
 */
export function drawPanel(surface: Surface, x: number, y: number, w: number, h: number): void {
  fillCutRect(surface, x, y, w, h, ui.ink);
  surface.fillRect(x + 1, y + 1, w - 2, h - 2, ui.panelLight);
  surface.fillRect(x + 1, y + 1, w - 2, 1, ui.panelEdge);
  surface.fillRect(x + 1, y + 1, 1, h - 2, ui.panelEdge);
  surface.fillRect(x + 2, y + h - 2, w - 3, 1, ui.panel);
  surface.fillRect(x + w - 2, y + 2, 1, h - 3, ui.panel);
  surface.fillRect(x + 2, y + 2, w - 4, h - 4, ui.panelLine);
  surface.fillRect(x + 3, y + 3, w - 6, h - 6, ui.panel);
  surface.fillRect(x + 3, y + 3, w - 6, 1, ui.panelLight);
  drawCornerBrackets(surface, { x: x + 4, y: y + 4, w: w - 8, h: h - 8 }, 4, ui.goldDeep, ui.gold);
}

/** A filled disc drawn as one rectangle per row (no arcs: determinism rule). */
export function fillCircle(surface: Surface, cx: number, cy: number, r: number, color: Color) {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt((r + 0.5) ** 2 - dy * dy));
    surface.fillRect(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}

/** Height of a keycap, px. */
export const KEY_HEIGHT = 16;
const KEY_MIN_WIDTH = 13;

/** What a keycap shows: a text label or a small glyph sprite (arrows). */
export type KeyLabel = string | SpriteDef;

/** Width of the keycap {@link drawKey} would draw for `label`. */
export function keyWidth(label: KeyLabel): number {
  const inner = typeof label === 'string' ? fonts.regular.measure(label) : label.width;
  return Math.max(KEY_MIN_WIDTH, inner + 8);
}

/**
 * A keyboard key: outlined cap with a lit face and a darker lip below. Returns its width.
 * `y` is the top of the key; the label's capitals are centered on the face.
 */
export function drawKey(dc: DrawContext, label: KeyLabel, x: number, y: number): number {
  const { surface } = dc;
  const w = keyWidth(label);
  fillCutRect(surface, x, y, w, KEY_HEIGHT, ui.ink);
  surface.fillRect(x + 1, y + 1, w - 2, KEY_HEIGHT - 2, ui.keyLip);
  surface.fillRect(x + 1, y + 1, w - 2, KEY_HEIGHT - 5, ui.keyFace);
  if (typeof label === 'string') {
    const font = fonts.regular;
    // Cap top 2 px below the face top: cell top = key top + 3 - (baseline - cap height).
    const top = y + 3 - (font.baseline - 7);
    drawText(dc, font, label, x + Math.floor(w / 2), top, { color: ui.keyText, align: 'center' });
  } else {
    const top = y + 1 + Math.floor((KEY_HEIGHT - 5 - label.height) / 2);
    surface.drawBitmap(dc.sprites.get(label), x + Math.floor((w - label.width) / 2), top);
  }
  return w;
}

const ARROW_ROWS = ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...'];

function rotate(rows: readonly string[]): string[] {
  const width = rows[0]?.length ?? 0;
  return Array.from({ length: width }, (_, x) =>
    rows.map((row) => row.charAt(x)).join(''),
  ).reverse();
}

const ARROW_UP = ARROW_ROWS;
const ARROW_LEFT = rotate(ARROW_UP);
export const arrows = {
  up: defineSprite({ '#': ui.keyText }, ARROW_UP),
  down: defineSprite({ '#': ui.keyText }, [...ARROW_UP].reverse()),
  left: defineSprite({ '#': ui.keyText }, ARROW_LEFT),
  right: defineSprite(
    { '#': ui.keyText },
    ARROW_LEFT.map((row) => Array.from(row).reverse().join('')),
  ),
};

/** Dither rows the dimmer tiles over the whole screen: a 50% checkerboard, or 25% dots. */
const DITHERS = {
  half: defineSprite({ k: ui.dim }, ['k.'.repeat(SCREEN_WIDTH / 2), '.k'.repeat(SCREEN_WIDTH / 2)]),
  light: defineSprite({ k: ui.dim }, [
    'k...'.repeat(SCREEN_WIDTH / 4),
    '....'.repeat(SCREEN_WIDTH / 4),
    '..k.'.repeat(SCREEN_WIDTH / 4),
    '....'.repeat(SCREEN_WIDTH / 4),
  ]),
} as const;

export type DimStrength = keyof typeof DITHERS;

/** Dims everything drawn so far with a pixel-art dither pattern (no alpha blending). */
export function dimScreen(dc: DrawContext, strength: DimStrength = 'half'): void {
  const dither = DITHERS[strength];
  const bitmap = dc.sprites.get(dither);
  for (let y = 0; y < SCREEN_HEIGHT; y += dither.height) dc.surface.drawBitmap(bitmap, 0, y);
}
