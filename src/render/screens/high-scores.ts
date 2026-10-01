/**
 * The local top 10 on the Title ("Jurisprudencia"): a smoked-glass panel with a heading strip
 * and one row per entry (place, initials, score). The top three get medal colors.
 */
import { HIGH_SCORE_LIMIT, type HighScoreEntry } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite, type SpriteDef } from '../sprite';
import { strings } from '../strings';
import type { Color } from '../surface';
import { drawText, fonts } from '../text';
import { drawOutlinedText, ui } from './ui';

export const HIGH_SCORES_WIDTH = 150;
const HEADER_H = 15;
const ROW_H = 10;
const PAD = 4;
/** Capitals sit 3 px below the cell top (room for accents): shift text up to center them. */
const CAP_OFFSET = fonts.regular.baseline - 7;

const MEDALS: readonly Color[] = [ui.gold, '#d8dcef', '#e0a070'];
const RANK: Color = ui.muted;
const SCORE: Color = ui.text;

/** Height of the panel for a table of `count` entries (an empty table shows one line). */
export function highScoresHeight(count: number): number {
  return HEADER_H + Math.max(1, Math.min(count, HIGH_SCORE_LIMIT)) * ROW_H + PAD + 2;
}

/** Draws the panel with its top-left corner at (x, y). */
export function drawHighScores(
  dc: DrawContext,
  entries: readonly HighScoreEntry[],
  x: number,
  y: number,
): void {
  const { surface } = dc;
  const w = HIGH_SCORES_WIDTH;
  const h = highScoresHeight(entries.length);

  // Frame, smoked-glass body (the backdrop shows through a dither) and a solid heading strip.
  surface.fillRect(x, y, w, h, ui.ink);
  surface.fillRect(x + 1, y + 1, w - 2, HEADER_H - 1, ui.panel);
  surface.fillRect(x + 1, y + 1, w - 2, 1, ui.panelEdge);
  surface.fillRect(x + 1, y + HEADER_H, w - 2, 1, ui.panelEdge);
  surface.drawBitmap(dc.sprites.get(glass(w - 2, h - HEADER_H - 2)), x + 1, y + HEADER_H + 1);

  drawText(dc, fonts.regular, strings.titleScreen.highScores, x + w / 2, y + 4 - CAP_OFFSET, {
    color: ui.gold,
    shadow: ui.ink,
    align: 'center',
  });

  const top = y + HEADER_H + PAD - CAP_OFFSET;
  if (entries.length === 0) {
    drawOutlinedText(dc, fonts.regular, strings.titleScreen.noHighScores, x + w / 2, top, RANK, {
      align: 'center',
    });
    return;
  }
  entries.slice(0, HIGH_SCORE_LIMIT).forEach((entry, i) => {
    const rowTop = top + i * ROW_H;
    const medal = MEDALS[i];
    drawOutlinedText(dc, fonts.regular, `${i + 1}.`, x + 22, rowTop, medal ?? RANK, {
      align: 'right',
    });
    drawOutlinedText(dc, fonts.regular, entry.initials, x + 30, rowTop, medal ?? ui.text);
    drawOutlinedText(dc, fonts.regular, String(entry.score), x + w - 8, rowTop, SCORE, {
      align: 'right',
    });
  });
}

const glassSprites = new Map<string, SpriteDef>();

/** A 50% checkerboard of the panel color, `w`×`h`, memoized per size. */
function glass(w: number, h: number): SpriteDef {
  const key = `${w}x${h}`;
  let sprite = glassSprites.get(key);
  if (!sprite) {
    const even = 'p.'.repeat(Math.ceil(w / 2)).slice(0, w);
    const odd = '.p'.repeat(Math.ceil(w / 2)).slice(0, w);
    sprite = defineSprite(
      { p: ui.panel },
      Array.from({ length: h }, (_, row) => (row % 2 ? odd : even)),
    );
    glassSprites.set(key, sprite);
  }
  return sprite;
}
