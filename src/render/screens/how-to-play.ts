/**
 * Cómo jugar: one screen with the controls for the device kind, shown before the first Run.
 * Desktop shows keycaps and the mouse; touch shows the on-screen controls in place.
 */
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../../core';
import type { DrawContext } from '../draw-context';
import { weaponIcons } from '../hud/weapon-icons';
import { defineSprite, type SpriteDef } from '../sprite';
import { strings } from '../strings';
import type { Color } from '../surface';
import { fonts } from '../text';
import {
  arrows,
  blinkOn,
  drawKey,
  drawOutlinedText,
  drawPanel,
  fillCircle,
  KEY_HEIGHT,
  ui,
  type KeyLabel,
} from './ui';

const BACKGROUND: Color = '#2e1e4c';
const STRIPE: Color = '#362456';

/** The controls panel: full width for touch (it mirrors the overlay), narrower for the keys. */
const PANEL_Y = 98;
const PANEL_H = 176;
const PANEL_TOUCH = { x: 40, y: PANEL_Y, w: SCREEN_WIDTH - 80, h: PANEL_H } as const;
const PANEL_DESKTOP = { x: 80, y: PANEL_Y, w: SCREEN_WIDTH - 160, h: PANEL_H } as const;
const PROMPT_Y = 306;
const t = strings.howToPlay;

export function drawHowToPlay(dc: DrawContext): void {
  const { surface, view } = dc;
  surface.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, BACKGROUND);
  // Slow diagonal stripes for texture, scrolled by the view tick.
  const shift = (view.tick >> 2) % 24;
  for (let y = 0; y < SCREEN_HEIGHT; y += 2) {
    for (let x = -24 + ((shift + y / 2) % 24); x < SCREEN_WIDTH; x += 24) {
      surface.fillRect(x, y, 8, 2, STRIPE);
    }
  }

  drawOutlinedText(dc, fonts.large, t.title, SCREEN_WIDTH / 2, 22, ui.gold, { align: 'center' });
  drawOutlinedText(dc, fonts.regular, t.goal, SCREEN_WIDTH / 2, 64, ui.text, { align: 'center' });

  const panel = view.device === 'touch' ? PANEL_TOUCH : PANEL_DESKTOP;
  drawPanel(surface, panel.x, panel.y, panel.w, panel.h);
  if (view.device === 'touch') drawTouchControls(dc);
  else drawDesktopControls(dc);

  if (view.startReady && blinkOn(view.tick)) {
    const prompt = view.device === 'touch' ? t.continueTouch : t.continueDesktop;
    drawOutlinedText(dc, fonts.regular, prompt, SCREEN_WIDTH / 2, PROMPT_Y, ui.gold, {
      align: 'center',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Desktop: three rows of two entries, each a cluster of keys (or the mouse) and a label.

/** An entry's icons: keycap groups joined by "o", or a mouse highlighting one part. */
type Icons =
  | { readonly kind: 'keys'; readonly groups: readonly (readonly KeyLabel[])[] }
  | { readonly kind: 'mouse'; readonly lit: 'none' | 'left' | 'wheel'; readonly keys?: KeyLabel[] };

interface Entry {
  readonly icons: Icons;
  readonly label: string;
}

const DESKTOP_ENTRIES: readonly Entry[] = [
  {
    icons: {
      kind: 'keys',
      groups: [
        ['A', 'D'],
        [arrows.left, arrows.right],
      ],
    },
    label: t.move,
  },
  { icons: { kind: 'keys', groups: [['W', arrows.up], [t.keys.space]] }, label: t.jump },
  { icons: { kind: 'mouse', lit: 'none' }, label: t.aim },
  { icons: { kind: 'mouse', lit: 'left' }, label: t.fire },
  { icons: { kind: 'mouse', lit: 'wheel', keys: ['Q', 'E'] }, label: t.switchWeapon },
  { icons: { kind: 'keys', groups: [[t.keys.escape, 'P']] }, label: t.pause },
];

const COLUMN_X = [
  PANEL_DESKTOP.x + 36,
  PANEL_DESKTOP.x + 36 + Math.floor((PANEL_DESKTOP.w - 36) / 2),
] as const;
const ROW_Y = [PANEL_DESKTOP.y + 28, PANEL_DESKTOP.y + 76, PANEL_DESKTOP.y + 124] as const;
/** Width reserved for icons before the label starts. */
const ICON_AREA = 104;
const KEY_GAP = 2;
const GROUP_GAP = 5;

function drawDesktopControls(dc: DrawContext): void {
  DESKTOP_ENTRIES.forEach((entry, i) => {
    const x = COLUMN_X[i % 2] ?? 0;
    const y = ROW_Y[Math.floor(i / 2)] ?? 0;
    // Icons are vertically centered on a 24 px row; labels on the same center line.
    const center = y + 12;
    drawIcons(dc, entry.icons, x, center);
    const font = fonts.regular;
    const labelTop = center - (font.baseline - 4);
    drawOutlinedText(dc, font, entry.label, x + ICON_AREA, labelTop, ui.text);
  });
}

function drawIcons(dc: DrawContext, icons: Icons, x: number, center: number): void {
  if (icons.kind === 'mouse') {
    const sprite = MOUSE[icons.lit];
    dc.surface.drawBitmap(dc.sprites.get(sprite), x, center - Math.floor(sprite.height / 2));
    if (icons.keys) {
      let penX = x + sprite.width + GROUP_GAP + 2;
      penX = drawOrWord(dc, penX - 2, center);
      drawKeyGroup(dc, icons.keys, penX, center);
    }
    return;
  }
  let penX = x;
  icons.groups.forEach((group, i) => {
    if (i > 0) penX = drawOrWord(dc, penX, center);
    penX = drawKeyGroup(dc, group, penX, center);
  });
}

/** Draws keys side by side centered on `center`; returns the x after the last one. */
function drawKeyGroup(
  dc: DrawContext,
  keys: readonly KeyLabel[],
  x: number,
  center: number,
): number {
  let penX = x;
  const top = center - Math.floor(KEY_HEIGHT / 2);
  for (const key of keys) penX += drawKey(dc, key, penX, top) + KEY_GAP;
  return penX - KEY_GAP;
}

/** The word "o" between alternatives; returns the x where the next group starts. */
function drawOrWord(dc: DrawContext, x: number, center: number): number {
  const font = fonts.regular;
  const left = x + GROUP_GAP;
  drawOutlinedText(dc, font, t.or, left, center - (font.baseline - 2), ui.muted);
  return left + font.measure(t.or) + GROUP_GAP;
}

const MOUSE_PALETTE = { k: ui.ink, w: ui.keyFace, s: ui.keyLip, y: ui.keyLit, Y: ui.goldDeep };
/** Half-width of the mouse body per row, outline included (the center column is 7). */
const MOUSE_HALF_WIDTHS = [3, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 5, 3];
const MOUSE_CENTER = 7;
/** Row of the line between the buttons and the body. */
const MOUSE_SPLIT = 8;

/** A 15×21 mouse: two buttons and a wheel on top; `lit` highlights the part in use. */
function mouseRows(lit: 'none' | 'left' | 'wheel'): string[] {
  const inside = (x: number, y: number) =>
    Math.abs(x - MOUSE_CENTER) <= (MOUSE_HALF_WIDTHS[y] ?? -1);
  return MOUSE_HALF_WIDTHS.map((_, y) => {
    let row = '';
    for (let x = 0; x <= MOUSE_CENTER * 2; x++) {
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (!inside(x, y)) row += '.';
      else if (edge || y === MOUSE_SPLIT) row += 'k';
      else if (y < MOUSE_SPLIT && x === MOUSE_CENTER) {
        row += y >= 2 && y <= 5 ? (lit === 'wheel' ? 'y' : 's') : 'k';
      } else if (y < MOUSE_SPLIT && x < MOUSE_CENTER) {
        const shade = y === MOUSE_SPLIT - 1 || x === MOUSE_CENTER - 1;
        row += lit === 'left' ? (shade ? 'Y' : 'y') : shade ? 's' : 'w';
      } else {
        const shade = x >= MOUSE_CENTER * 2 - 2 || y >= MOUSE_HALF_WIDTHS.length - 3;
        row += shade || (y < MOUSE_SPLIT && y === MOUSE_SPLIT - 1) ? 's' : 'w';
      }
    }
    return row;
  });
}

const MOUSE: Readonly<Record<'none' | 'left' | 'wheel', SpriteDef>> = {
  none: defineSprite(MOUSE_PALETTE, mouseRows('none')),
  left: defineSprite(MOUSE_PALETTE, mouseRows('left')),
  wheel: defineSprite(MOUSE_PALETTE, mouseRows('wheel')),
};

// ---------------------------------------------------------------------------------------------
// Touch: the on-screen controls drawn where they appear, each with its caption.

const STICK_RING: Color = '#6a5a92';
const STICK_KNOB: Color = '#b8a8d0';
const BUTTON: Color = '#e8433a';
const BUTTON_LIGHT: Color = '#ff9a7a';

const JUMP_ARROW = defineSprite({ '#': ui.text, k: ui.ink }, [
  '...#...',
  '..###..',
  '.#####.',
  '#######',
  '..###..',
  '..###..',
]);

function drawTouchControls(dc: DrawContext): void {
  const { surface } = dc;
  const font = fonts.regular;
  const caption = (text: string, x: number, y: number, align: 'left' | 'center' | 'right') => {
    const lines = font.wrap(text, 160).join('\n');
    drawOutlinedText(dc, font, lines, x, y, ui.text, { align });
  };

  // Weapon icon (top left) and pause button (top right), as in the HUD.
  const icon = weaponIcons['mazo-automatico'];
  const iconX = PANEL_TOUCH.x + 24;
  const iconY = PANEL_TOUCH.y + 20;
  surface.fillRect(iconX - 3, iconY - 3, icon.width + 6, icon.height + 6, ui.gold);
  surface.fillRect(iconX - 2, iconY - 2, icon.width + 4, icon.height + 4, ui.panelLight);
  surface.drawBitmap(dc.sprites.get(icon), iconX, iconY);
  caption(t.touch.switchWeapon, iconX + icon.width + 8, iconY - 2, 'left');

  // Pause button: a round button with two bars.
  const pauseX = PANEL_TOUCH.x + PANEL_TOUCH.w - 34;
  const pauseY = iconY + 4;
  fillCircle(surface, pauseX, pauseY, 9, ui.ink);
  fillCircle(surface, pauseX, pauseY, 8, STICK_RING);
  surface.fillRect(pauseX - 4, pauseY - 4, 3, 9, ui.keyFace);
  surface.fillRect(pauseX + 2, pauseY - 4, 3, 9, ui.keyFace);
  caption(t.pause, pauseX - 14, iconY - 2, 'right');

  // Left stick (move), right stick (aim + fire) and the jump button between the right stick
  // and the center, as in the Run's overlay.
  const stickY = PANEL_TOUCH.y + 94;
  drawStick(dc, PANEL_TOUCH.x + 80, stickY, -1);
  caption(t.move, PANEL_TOUCH.x + 80, stickY + 32, 'center');
  caption(t.touch.drop, PANEL_TOUCH.x + 80, stickY + 48, 'center');

  const jumpX = PANEL_TOUCH.x + PANEL_TOUCH.w / 2 + 100;
  const jumpY = stickY + 8;
  fillCircle(surface, jumpX, jumpY, 13, ui.ink);
  fillCircle(surface, jumpX, jumpY, 12, BUTTON);
  fillCircle(surface, jumpX - 2, jumpY - 3, 6, BUTTON_LIGHT);
  fillCircle(surface, jumpX - 1, jumpY - 2, 5, BUTTON);
  surface.drawBitmap(dc.sprites.get(JUMP_ARROW), jumpX - 3, jumpY - 4);
  caption(t.jump, jumpX, stickY + 32, 'center');

  drawStick(dc, PANEL_TOUCH.x + PANEL_TOUCH.w - 86, stickY, 1);
  caption(t.touch.aimFire, PANEL_TOUCH.x + PANEL_TOUCH.w - 86, stickY + 32, 'center');
}

function drawStick(dc: DrawContext, cx: number, cy: number, lean: -1 | 1): void {
  const { surface } = dc;
  fillCircle(surface, cx, cy, 20, ui.ink);
  fillCircle(surface, cx, cy, 19, STICK_RING);
  fillCircle(surface, cx, cy, 16, ui.panel);
  fillCircle(surface, cx + lean * 6, cy - 4, 9, ui.ink);
  fillCircle(surface, cx + lean * 6, cy - 4, 8, STICK_KNOB);
  fillCircle(surface, cx + lean * 6 - 2, cy - 6, 3, ui.keyFace);
}
