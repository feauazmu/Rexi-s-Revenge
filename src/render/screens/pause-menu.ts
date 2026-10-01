/**
 * Pause menu: the frozen Run is dimmed with a checkerboard and a framed panel lists
 * Continuar, Silenciar música (with a checkbox showing the persisted choice) and Salir.
 */
import { SCREEN_WIDTH, type PauseMenuItem, type PauseMenuView } from '../../core';
import type { DrawContext } from '../draw-context';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import { fonts } from '../text';
import { blinkOn, drawOutlinedText, drawPanel, ui } from './ui';

const LABELS: Readonly<Record<PauseMenuItem, string>> = {
  resume: strings.pause.resume,
  'mute-music': strings.pause.muteMusic,
  quit: strings.pause.quit,
};

const PANEL_W = 224;
const ROW_H = 22;
const HEADER_H = 46;
const PANEL_Y = 104;

/** A small gavel pointing at the selected entry. */
const CURSOR = defineSprite({ k: ui.ink, g: ui.gold, G: ui.goldDeep, h: '#8a5a2a' }, [
  '.kkk.....',
  'kgggk....',
  'kgGgkkkkk',
  'kgGghhhhk',
  'kgGgkkkkk',
  'kgggk....',
  '.kkk.....',
]);

const CHECK = defineSprite({ k: ui.ink, y: ui.keyLit, Y: ui.goldDeep }, [
  'kkkkkkkkk',
  'kyyyyyyyk',
  'kyyyyyykk',
  'kyyyyykkk',
  'kkyyykkYk',
  'kkkykkkYk',
  'kykkkyyYk',
  'kYYkYYYYk',
  'kkkkkkkkk',
]);
const UNCHECKED = defineSprite({ k: ui.ink, w: ui.keyFace }, [
  'kkkkkkkkk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kkkkkkkkk',
]);

/** Draws the panel; the caller has drawn and dimmed the frozen Run underneath. */
export function drawPauseMenu(dc: DrawContext, menu: PauseMenuView): void {
  const { surface, view } = dc;

  const h = HEADER_H + menu.items.length * ROW_H + 12;
  const x = Math.round((SCREEN_WIDTH - PANEL_W) / 2);
  drawPanel(surface, x, PANEL_Y, PANEL_W, h);

  const center = x + PANEL_W / 2;
  drawOutlinedText(dc, fonts.large, strings.pause.title, center, PANEL_Y + 8, ui.gold, {
    align: 'center',
  });
  surface.fillRect(x + 14, PANEL_Y + HEADER_H - 7, PANEL_W - 28, 1, ui.panelEdge);
  surface.fillRect(x + 14, PANEL_Y + HEADER_H - 6, PANEL_W - 28, 1, ui.ink);

  const font = fonts.regular;
  menu.items.forEach((item, i) => {
    const rowTop = PANEL_Y + HEADER_H + i * ROW_H;
    const selected = i === menu.selected;
    const textTop = rowTop + Math.floor((ROW_H - 7) / 2) - (font.baseline - 7);
    if (selected) {
      surface.fillRect(x + 8, rowTop, PANEL_W - 16, ROW_H - 2, ui.panelLight);
      surface.fillRect(x + 8, rowTop + ROW_H - 3, PANEL_W - 16, 1, ui.ink);
      const nudge = blinkOn(view.tick) ? 0 : 1;
      surface.drawBitmap(dc.sprites.get(CURSOR), x + 16 + nudge, rowTop + 6);
    }
    drawOutlinedText(dc, font, LABELS[item], x + 34, textTop, selected ? ui.gold : ui.text);
    if (item === 'mute-music') {
      const box = view.musicMuted ? CHECK : UNCHECKED;
      surface.drawBitmap(dc.sprites.get(box), x + PANEL_W - 28, rowTop + 5);
    }
  });
}
