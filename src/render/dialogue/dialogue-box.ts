import { SCREEN_HEIGHT, type DialogueView, type RunView } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette as P } from '../palette';
import { strings } from '../strings';
import type { Color } from '../surface';
import { drawText, fonts, type BitmapFont } from '../text';
import { sprites as portrait } from '../art/generated/rexi-portrait';
import { fillCutRect } from '../frame';

/** Frame colors (master palette): a marble border lit at the top, a robe panel, gold accents. */
const ink = {
  outline: P.outline,
  border: P.marble,
  borderLight: P.white,
  borderShade: P.grey3,
  fill: P.robe,
  fillLine: P.night,
  fillSheen: P.robeMid,
  text: P.white,
  name: P.gold,
  nameLight: P.light,
  nameShade: P.brass,
  accent: P.gold,
  accentShade: P.brass,
} as const satisfies Record<string, Color>;
const OUTLINE: Color = ink.outline;

/** Fully open geometry, game coordinates. The box slides up from below the screen. */
const PORTRAIT_FRAME = { x: 96, y: 314, w: 44, h: 44 } as const;
/**
 * Centered with the portrait and no wider than two lines of a long Quip need, so it hides as
 * little of the Arena as possible.
 */
const BOX = { x: 144, y: 318, w: 400, h: 40 } as const;
const PADDING_X = 8;
/** Top of the first text line's cell. */
const TEXT_TOP = BOX.y + 7;
/** Room kept free at the right of the text for the "more" cursor. */
const CURSOR_ROOM = 8;
const NAME_TAB = { x: BOX.x + 8, y: BOX.y - 9, h: 11, padding: 4 } as const;
/** Highest pixel of the whole box: the slide distance is measured from here. */
const TOP = Math.min(PORTRAIT_FRAME.y, NAME_TAB.y);
/** Blink period of the cursor shown once the Quip is fully revealed, ticks. */
const CURSOR_BLINK = 16;

/**
 * Width available to a Quip's text in the Dialogue Box, px. A Quip fits when
 * `fonts.regular.wrap(text, DIALOGUE_TEXT_WIDTH).length <= DIALOGUE_MAX_LINES`.
 */
export const DIALOGUE_TEXT_WIDTH = BOX.w - 2 * PADDING_X - CURSOR_ROOM;
export const DIALOGUE_MAX_LINES = 2;

/**
 * The Dialogue Box (Pokémon style): Rexi's portrait, the "REXI" name tab and the Quip's
 * typewriter text, at the bottom of the screen. Drawn above the HUD, below the crosshair.
 */
export function drawDialogueBox(dc: DrawContext, run: RunView): void {
  const dialogue = run.dialogue;
  if (!dialogue) return;
  const dy = Math.round((1 - dialogue.openness) * (SCREEN_HEIGHT - TOP));
  if (TOP + dy >= SCREEN_HEIGHT) return;

  drawPortrait(dc, dy);
  drawPanel(dc, dy);
  drawNameTab(dc, dy);

  const font = fonts.regular;
  const text = revealedLines(font, dialogue.text, dialogue.revealed, DIALOGUE_TEXT_WIDTH);
  // Most Quips fit on one line of the wide box: center them on its two-line text area.
  const lift = Math.floor(((DIALOGUE_MAX_LINES - text.length) * font.lineHeight) / 2);
  drawText(dc, font, text.join('\n'), BOX.x + PADDING_X, TEXT_TOP + lift + dy, {
    color: ink.text,
    shadow: OUTLINE,
  });
  if (showsCursor(dialogue)) drawCursor(dc, dy);
}

/**
 * The first `revealed` characters of `text`, laid out on the lines the whole text wraps to,
 * so words never jump to the next line while they are being typed.
 */
export function revealedLines(
  font: BitmapFont,
  text: string,
  revealed: number,
  maxWidth: number,
): string[] {
  const lines = wrapCached(font, text, maxWidth);
  const visible: string[] = [];
  let cursor = 0;
  for (const line of lines) {
    const start = text.indexOf(line, cursor);
    const from = start === -1 ? cursor : start;
    const shown = Math.max(0, Math.min(line.length, revealed - from));
    visible.push(line.slice(0, shown));
    cursor = from + line.length;
  }
  return visible;
}

const wraps = new Map<string, string[]>();

function wrapCached(font: BitmapFont, text: string, maxWidth: number): string[] {
  if (font !== fonts.regular || maxWidth !== DIALOGUE_TEXT_WIDTH) return font.wrap(text, maxWidth);
  let lines = wraps.get(text);
  if (!lines) {
    lines = font.wrap(text, maxWidth);
    wraps.set(text, lines);
  }
  return lines;
}

function showsCursor(dialogue: DialogueView): boolean {
  return dialogue.complete && Math.floor(dialogue.age / CURSOR_BLINK) % 2 === 0;
}

/** An outline with cut corners around a solid `face` with a lit top row and a shaded bottom row. */
function drawPlate(
  dc: DrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  face: Color,
  light: Color,
  shade: Color,
): void {
  const { surface } = dc;
  fillCutRect(surface, x, y, w, h, OUTLINE);
  surface.fillRect(x + 1, y + 1, w - 2, h - 2, face);
  surface.fillRect(x + 2, y + 1, w - 4, 1, light);
  surface.fillRect(x + 1, y + h - 2, w - 2, 1, shade);
  surface.fillRect(x + w - 2, y + 2, 1, h - 3, shade);
}

/**
 * The frame shared by the box and the portrait: a marble border plate (lit top, shaded bottom
 * and right). With `filled`, an inner ink line and the robe panel with a sheen row follow.
 */
function drawFrame(dc: DrawContext, x: number, y: number, w: number, h: number, filled: boolean) {
  drawPlate(dc, x, y, w, h, ink.border, ink.borderLight, ink.borderShade);
  if (!filled) return;
  const { surface } = dc;
  surface.fillRect(x + 2, y + 2, w - 4, h - 4, ink.fillLine);
  surface.fillRect(x + 3, y + 3, w - 6, h - 6, ink.fill);
  surface.fillRect(x + 3, y + 3, w - 6, 1, ink.fillSheen);
}

function drawPortrait(dc: DrawContext, dy: number): void {
  const { x, y, w, h } = PORTRAIT_FRAME;
  drawFrame(dc, x, y + dy, w, h, false);
  dc.surface.drawBitmap(dc.sprites.get(portrait.portrait), x + 2, y + 2 + dy);
}

function drawPanel(dc: DrawContext, dy: number): void {
  const { x, y, w, h } = BOX;
  const { surface } = dc;
  drawFrame(dc, x, y + dy, w, h, true);
  // Gold studs on the border at the right corners (the name tab covers the top left).
  for (const sy of [y + 1, y + h - 2]) {
    surface.fillRect(x + w - 8, sy + dy, 5, 1, ink.accentShade);
    surface.fillRect(x + w - 7, sy + dy, 3, 1, ink.accent);
  }
}

function drawNameTab(dc: DrawContext, dy: number): void {
  const font = fonts.regular;
  const name = strings.dialogue.speaker;
  const w = font.measure(name) + 2 * NAME_TAB.padding + 2;
  const { x, y, h } = NAME_TAB;
  drawPlate(dc, x, y + dy, w, h, ink.name, ink.nameLight, ink.nameShade);
  const capTop = font.baseline - 7;
  drawText(dc, font, name, x + NAME_TAB.padding + 1, y + dy + 2 - capTop, { color: OUTLINE });
}

/** A small blinking ▼ in the bottom-right corner: the Quip is complete. */
function drawCursor(dc: DrawContext, dy: number): void {
  const x = BOX.x + BOX.w - PADDING_X - 5;
  const y = BOX.y + BOX.h - 10 + dy;
  const { surface } = dc;
  surface.fillRect(x, y, 5, 1, ink.accent);
  surface.fillRect(x + 1, y + 1, 3, 1, ink.accent);
  surface.fillRect(x + 2, y + 2, 1, 1, ink.accentShade);
}
