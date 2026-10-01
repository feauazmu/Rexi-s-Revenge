/**
 * The local top 10 on the Title ("Jurisprudencia"): a dark panel with a heading strip and one
 * row per entry (place, initials, score). The top three get medal colors. The body is solid so
 * the rows stay readable over the busy title illustration. Master-palette colors only.
 */
import { HIGH_SCORE_LIMIT, type HighScoreEntry } from '../../core';
import type { DrawContext } from '../draw-context';
import { masterPalette } from '../palette';
import { strings } from '../strings';
import type { Color } from '../surface';
import { drawText, fonts } from '../text';
import { drawOutlinedText } from './ui';

export const HIGH_SCORES_WIDTH = 150;
const HEADER_H = 15;
const ROW_H = 10;
const PAD = 4;
/** Capitals sit 3 px below the cell top (room for accents): shift text up to center them. */
const CAP_OFFSET = fonts.regular.baseline - 7;

const ink = {
  frame: masterPalette.outline,
  edge: masterPalette.robeSheen,
  header: masterPalette.robe,
  body: masterPalette.night,
  heading: masterPalette.gold,
  rank: masterPalette.grey2,
  text: masterPalette.grey3,
  score: masterPalette.white,
} as const satisfies Record<string, Color>;

/** Gold, silver and bronze; the other initials are dimmer than the scores. */
const MEDALS: readonly Color[] = [masterPalette.gold, masterPalette.white, masterPalette.skin3];

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

  // Black frame with cut corners, a heading strip with a lit top edge, and a solid body.
  surface.fillRect(x + 1, y, w - 2, h, ink.frame);
  surface.fillRect(x, y + 1, w, h - 2, ink.frame);
  surface.fillRect(x + 1, y + 1, w - 2, HEADER_H - 1, ink.header);
  surface.fillRect(x + 2, y + 1, w - 4, 1, ink.edge);
  surface.fillRect(x + 1, y + HEADER_H, w - 2, 1, ink.edge);
  surface.fillRect(x + 1, y + HEADER_H + 1, w - 2, h - HEADER_H - 2, ink.body);

  drawText(dc, fonts.regular, strings.titleScreen.highScores, x + w / 2, y + 4 - CAP_OFFSET, {
    color: ink.heading,
    shadow: ink.frame,
    align: 'center',
  });

  const top = y + HEADER_H + PAD - CAP_OFFSET;
  const outline = { outline: ink.frame };
  if (entries.length === 0) {
    drawOutlinedText(
      dc,
      fonts.regular,
      strings.titleScreen.noHighScores,
      x + w / 2,
      top,
      ink.rank,
      {
        ...outline,
        align: 'center',
      },
    );
    return;
  }
  entries.slice(0, HIGH_SCORE_LIMIT).forEach((entry, i) => {
    const rowTop = top + i * ROW_H;
    const medal = MEDALS[i];
    drawOutlinedText(dc, fonts.regular, `${i + 1}.`, x + 22, rowTop, medal ?? ink.rank, {
      ...outline,
      align: 'right',
    });
    drawOutlinedText(dc, fonts.regular, entry.initials, x + 30, rowTop, medal ?? ink.text, outline);
    drawOutlinedText(dc, fonts.regular, String(entry.score), x + w - 8, rowTop, ink.score, {
      ...outline,
      align: 'right',
    });
  });
}
