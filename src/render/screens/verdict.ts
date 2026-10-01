/**
 * The end of a Run, courtroom style.
 *
 * - Defeat beat: the frozen Run darkens in two dither steps while a "¡Se levanta la sesión!"
 *   banner drops in.
 * - Veredicto: a court record (paper with a ruled border) drops onto the dimmed Arena; the
 *   stats are read out one by one with counting numbers, then a rubber stamp slams down with
 *   the outcome and the court's ruling. A top-10 Run signs the record with three initials on
 *   a signature line.
 *
 * Every animation is a function of `screenAge`/`defeatAge` and `tick`, never a clock.
 */
import { INITIALS_LENGTH, SCREEN_WIDTH, type VerdictView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import type { Color } from '../surface';
import { drawText, fonts, formatElapsed, scaleFont } from '../text';
import { arrows, blinkOn, dimScreen, drawKey, drawOutlinedText, keyWidth, ui } from './ui';

const t = strings.verdict;

const doc = {
  paper: '#efe6d6',
  paperShade: '#ddd0b8',
  rule: '#b9a68e',
  ink: '#2a2030',
  inkSoft: '#6b5a68',
  red: '#c8323a',
  redDeep: '#8c1d2a',
  redFaint: '#e89a9a',
  highlight: '#ffd88a',
} as const satisfies Record<string, Color>;

/** Capitals start this far below a text cell's top (the rows above hold accents). */
const CAP = fonts.regular.baseline - 7;
const LARGE_CAP = fonts.large.baseline - 14;
const HUGE = scaleFont(fonts.regular, 3);
const HUGE_CAP = HUGE.baseline - 21;

// ---------------------------------------------------------------------------------------------
// Defeat beat

/** Defeat-beat ages (ticks) at which the screen dims a step, and the banner drops in. */
const DIM_LIGHT_AT = 20;
const DIM_HALF_AT = 50;
const BANNER_AT = 8;
const BANNER_DROP_TICKS = 10;
const BANNER = { y: 128, h: 40 } as const;

/** Dims the frozen Run by `age`, the ticks since the Run ended. */
export function dimDefeat(dc: DrawContext, age: number): void {
  if (age >= DIM_HALF_AT) dimScreen(dc, 'half');
  else if (age >= DIM_LIGHT_AT) dimScreen(dc, 'light');
}

/** The "¡Se levanta la sesión!" banner, dropping in a moment after the Run ended. */
export function drawDefeatBanner(dc: DrawContext, age: number): void {
  if (age < BANNER_AT) return;
  const { surface } = dc;
  const drop = Math.max(0, BANNER_AT + BANNER_DROP_TICKS - age);
  const y = BANNER.y - Math.round((drop * drop * (BANNER.y + BANNER.h)) / BANNER_DROP_TICKS ** 2);
  surface.fillRect(0, y, SCREEN_WIDTH, BANNER.h, ui.ink);
  surface.fillRect(0, y + 3, SCREEN_WIDTH, 1, doc.red);
  surface.fillRect(0, y + BANNER.h - 4, SCREEN_WIDTH, 1, doc.red);
  drawOutlinedText(dc, fonts.large, strings.defeat, SCREEN_WIDTH / 2, y + 13 - LARGE_CAP, ui.gold, {
    align: 'center',
  });
}

// ---------------------------------------------------------------------------------------------
// Veredicto

const PANEL = { x: 132, y: 15, w: 376, h: 330 } as const;
const PANEL_DROP_TICKS = 12;
const STATS_AT = 16;
const STAT_EVERY = 10;
const STAT_COUNT_TICKS = 16;
const STAMP_AT = 52;
/** The stamp hovers big for this many ticks, then lands and jolts the record. */
const STAMP_HOVER_TICKS = 2;
const STAMP_JOLT_TICKS = 3;
const RULING_AT = STAMP_AT + STAMP_HOVER_TICKS;
const SIGNATURE_AT = RULING_AT + 4;

/** A gavel for the heading, head up-left, handle down-right. */
const GAVEL = defineSprite({ k: doc.ink, w: '#a8693a', W: '#6e3f22', h: '#c48a52' }, [
  '..kkk.......',
  '.kwwwk......',
  'kwhwwwk.....',
  'kwwhwwwk....',
  '.kwwwwWk....',
  '..kwwWk.k...',
  '...kWk.khk..',
  '....k...khk.',
  '.........khk',
  '..........kk',
]);
const GAVEL_MIRRORED = defineSprite(
  GAVEL.palette,
  GAVEL.rows.map((row) => Array.from(row).reverse().join('')),
);

const docArrows = {
  up: defineSprite({ '#': doc.redDeep }, arrows.up.rows),
  down: defineSprite({ '#': doc.redDeep }, arrows.down.rows),
};

/** Draws the record over the frozen Run, which the caller has drawn and dimmed. */
export function drawVerdict(dc: DrawContext, verdict: VerdictView): void {
  const age = dc.view.screenAge;
  const drop = Math.max(0, PANEL_DROP_TICKS - age);
  const stampAge = age - STAMP_AT - STAMP_HOVER_TICKS;
  const jolt = stampAge >= 0 && stampAge < STAMP_JOLT_TICKS ? 1 : 0;
  const x = PANEL.x;
  const y =
    PANEL.y - Math.round((drop * drop * (PANEL.y + PANEL.h)) / PANEL_DROP_TICKS ** 2) + jolt;

  drawPaper(dc, x, y);
  drawHeading(dc, x, y);
  drawStats(dc, verdict, x, y + 82, age);
  if (age >= STAMP_AT) drawStamp(dc, verdict, x + PANEL.w / 2, y + 160, age - STAMP_AT);
  if (age >= RULING_AT) drawRuling(dc, verdict, x, y + 190);
  if (age >= SIGNATURE_AT) drawFooter(dc, verdict, x, y);
}

function drawPaper(dc: DrawContext, x: number, y: number): void {
  const { surface } = dc;
  const { w, h } = PANEL;
  // Drop shadow, outline, paper, and a ruled double border inside it.
  surface.fillRect(x + 3, y + 3, w, h, ui.dim);
  surface.fillRect(x, y, w, h, doc.ink);
  surface.fillRect(x + 1, y + 1, w - 2, h - 2, doc.paper);
  surface.fillRect(x + 1, y + h - 4, w - 2, 3, doc.paperShade);
  strokeRect(dc, x + 4, y + 4, w - 8, h - 8, doc.rule);
  strokeRect(dc, x + 6, y + 6, w - 12, h - 12, doc.rule);
}

function strokeRect(dc: DrawContext, x: number, y: number, w: number, h: number, color: Color) {
  const { surface } = dc;
  surface.fillRect(x, y, w, 1, color);
  surface.fillRect(x, y + h - 1, w, 1, color);
  surface.fillRect(x, y, 1, h, color);
  surface.fillRect(x + w - 1, y, 1, h, color);
}

function drawHeading(dc: DrawContext, x: number, y: number): void {
  const center = x + PANEL.w / 2;
  const title = t.title.toUpperCase();
  drawText(dc, fonts.large, title, center, y + 20 - LARGE_CAP, {
    color: doc.ink,
    shadow: doc.rule,
    align: 'center',
  });
  const half = Math.ceil(fonts.large.measure(title) / 2);
  dc.surface.drawBitmap(dc.sprites.get(GAVEL_MIRRORED), center - half - 22, y + 21);
  dc.surface.drawBitmap(dc.sprites.get(GAVEL), center + half + 10, y + 21);
  drawText(dc, fonts.regular, t.caseName, center, y + 46 - CAP, {
    color: doc.inkSoft,
    align: 'center',
  });
  dc.surface.fillRect(x + 20, y + 62, PANEL.w - 40, 1, doc.ink);
  dc.surface.fillRect(x + 20, y + 64, PANEL.w - 40, 1, doc.rule);
}

/** Stat rows appear one after another, their numbers counting up from zero. */
function drawStats(dc: DrawContext, verdict: VerdictView, x: number, top: number, age: number) {
  const { stats } = verdict;
  const rows: readonly (readonly [string, number, (value: number) => string])[] = [
    [t.score, stats.score, String],
    [t.enemiesDestroyed, stats.enemiesDestroyed, String],
    [t.timeSurvived, stats.ticksSurvived, formatElapsed],
  ];
  const font = fonts.regular;
  const left = x + 32;
  const right = x + PANEL.w - 32;
  rows.forEach(([label, value, format], i) => {
    const shownFor = age - STATS_AT - i * STAT_EVERY;
    if (shownFor < 0) return;
    const progress = Math.min(1, shownFor / STAT_COUNT_TICKS);
    const text = format(Math.round(value * progress));
    const rowTop = top + i * 18;
    drawText(dc, font, label, left, rowTop - CAP, { color: doc.ink });
    drawText(dc, font, text, right, rowTop - CAP, { color: doc.ink, align: 'right' });
    // Dotted leader on the baseline between label and value.
    const from = left + font.measure(label) + 4;
    const to = right - font.measure(text) - 4;
    for (let dx = from; dx < to; dx += 3) dc.surface.fillRect(dx, rowTop + 6, 1, 1, doc.rule);
  });
}

type Outcome = 'record' | 'ranked' | 'closed';

function outcomeOf(verdict: VerdictView): Outcome {
  if (verdict.rank === 1) return 'record';
  return verdict.rank === null ? 'closed' : 'ranked';
}

/** The rubber stamp: hovers big and pale for a moment, then lands in red with a frame. */
function drawStamp(dc: DrawContext, verdict: VerdictView, cx: number, cy: number, age: number) {
  const text = t.stamp[outcomeOf(verdict)];
  if (age < STAMP_HOVER_TICKS) {
    drawText(dc, HUGE, text, cx, cy - 10 - HUGE_CAP, { color: doc.redFaint, align: 'center' });
    return;
  }
  const { surface } = dc;
  const w = fonts.large.measure(text) + 20;
  const h = 26;
  const left = Math.round(cx - w / 2);
  const top = cy - h / 2;
  // A worn stamp: a double frame with a few gaps, and the text slightly off-center.
  strokeRect(dc, left, top, w, h, doc.red);
  strokeRect(dc, left + 1, top + 1, w - 2, h - 2, doc.red);
  strokeRect(dc, left + 3, top + 3, w - 6, h - 6, doc.red);
  surface.fillRect(left + 9, top, 5, 2, doc.paper);
  surface.fillRect(left + w - 2, top + 15, 2, 4, doc.paper);
  surface.fillRect(left + w - 30, top + h - 2, 7, 2, doc.paper);
  drawText(dc, fonts.large, text, cx + 1, top + 6 - LARGE_CAP, { color: doc.red, align: 'center' });
}

function drawRuling(dc: DrawContext, verdict: VerdictView, x: number, top: number): void {
  const lines = fonts.regular.wrap(t.ruling[outcomeOf(verdict)], PANEL.w - 64);
  drawText(dc, fonts.regular, lines.join('\n'), x + PANEL.w / 2, top - CAP, {
    color: doc.ink,
    align: 'center',
  });
}

const SLOT_W = 20;
const SLOT_GAP = 6;
const SLOTS_W = INITIALS_LENGTH * SLOT_W + (INITIALS_LENGTH - 1) * SLOT_GAP;

/** The signature (top-10 Runs), then the prompt to continue once start is accepted. */
function drawFooter(dc: DrawContext, verdict: VerdictView, x: number, y: number): void {
  const { view } = dc;
  const center = x + PANEL.w / 2;
  const entry = verdict.initials;
  if (entry) {
    if (!verdict.recorded) {
      drawText(dc, fonts.regular, t.sign, center, y + 232 - CAP, {
        color: doc.inkSoft,
        align: 'center',
      });
    }
    drawSignature(
      dc,
      entry.letters,
      verdict.recorded ? null : entry.cursor,
      center,
      y + (verdict.recorded ? 244 : 258),
    );
    if (verdict.recorded) {
      drawText(dc, fonts.regular, `${t.signed} ${verdict.rank ?? ''}`, center, y + 272 - CAP, {
        color: doc.inkSoft,
        align: 'center',
      });
    } else if (view.device === 'desktop') {
      drawHints(dc, center, y + 292);
    } else {
      drawText(dc, fonts.regular, t.hints.touch, center, y + 296 - CAP, {
        color: doc.ink,
        align: 'center',
      });
    }
  }
  const best = view.highScores[0];
  if (!entry && best) {
    // Nothing to sign: remind the player of the record to beat.
    const line = `${t.recordToBeat} ${best.initials} — ${String(best.score)}`;
    drawText(dc, fonts.regular, line, center, y + 244 - CAP, {
      color: doc.inkSoft,
      align: 'center',
    });
  }
  if (view.startReady && blinkOn(view.tick)) {
    const prompt = view.device === 'touch' ? t.continueTouch : t.continueDesktop;
    drawText(dc, fonts.regular, prompt, center, y + 304 - CAP, { color: doc.ink, align: 'center' });
  }
}

/**
 * Letters standing on a signature line, with a red "X" before it. While signing, the letter
 * being chosen is highlighted with arrows above and below it; once signed, the letters turn
 * to red ink.
 */
function drawSignature(
  dc: DrawContext,
  letters: string,
  cursor: number | null,
  cx: number,
  capTop: number,
): void {
  const { surface, view } = dc;
  const left = Math.round(cx - SLOTS_W / 2);
  const lineY = capTop + 16;
  drawText(dc, fonts.large, 'X', left - 26, capTop - LARGE_CAP, { color: doc.red });
  surface.fillRect(left - 30, lineY, SLOTS_W + 40, 1, doc.ink);

  Array.from(letters).forEach((letter, i) => {
    const slotX = left + i * (SLOT_W + SLOT_GAP);
    const selected = i === cursor;
    if (selected) {
      surface.fillRect(slotX - 2, capTop - 3, SLOT_W + 4, 18, doc.highlight);
      const nudge = blinkOn(view.tick) ? 0 : 1;
      const arrowX = slotX + Math.floor((SLOT_W - docArrows.up.width) / 2);
      surface.drawBitmap(dc.sprites.get(docArrows.up), arrowX, capTop - 11 - nudge);
      surface.drawBitmap(dc.sprites.get(docArrows.down), arrowX, lineY + 3 + nudge);
    }
    drawText(dc, fonts.large, letter, slotX + SLOT_W / 2, capTop - LARGE_CAP, {
      color: cursor === null ? doc.redDeep : doc.ink,
      align: 'center',
    });
  });
}

/** Keycap hints: ↑↓ Letra · ←→ Mover · Enter Firmar. */
function drawHints(dc: DrawContext, cx: number, top: number): void {
  const groups = [
    [[arrows.up, arrows.down], t.hints.letter],
    [[arrows.left, arrows.right], t.hints.move],
    [[t.hints.enter], t.hints.sign],
  ] as const;
  const font = fonts.regular;
  const KEY_GAP = 2;
  const LABEL_GAP = 4;
  const GROUP_GAP = 14;
  const widthOf = ([keys, label]: (typeof groups)[number]) =>
    keys.reduce((sum, key) => sum + keyWidth(key) + KEY_GAP, 0) +
    LABEL_GAP -
    KEY_GAP +
    font.measure(label);
  const total = groups.reduce((sum, g) => sum + widthOf(g), 0) + GROUP_GAP * (groups.length - 1);
  let penX = Math.round(cx - total / 2);
  for (const [keys, label] of groups) {
    for (const key of keys) penX += drawKey(dc, key, penX, top) + KEY_GAP;
    penX += LABEL_GAP - KEY_GAP;
    drawText(dc, font, label, penX, top + 4 - CAP, { color: doc.ink });
    penX += font.measure(label) + GROUP_GAP;
  }
}
