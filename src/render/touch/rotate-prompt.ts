/**
 * "Gira tu teléfono": shown instead of the game on touch devices held in portrait. It has its
 * own small portrait surface (the platform scales it up like the game image): a phone that
 * turns from upright to sideways, an arrow, and the caption.
 */
import { masterPalette } from '../palette';
import { defineSprite } from '../sprite';
import { strings } from '../strings';
import type { Color, Surface } from '../surface';
import { fonts, type TextTarget } from '../text';
import { drawOutlinedText, ui } from '../screens/ui';

export const ROTATE_PROMPT_WIDTH = 192;
export const ROTATE_PROMPT_HEIGHT = 340;

const BACKGROUND: Color = ui.backdrop;
const STRIPE: Color = ui.backdropStripe;
const PHONE_BODY: Color = masterPalette.steel1;
const PHONE_SCREEN: Color = masterPalette.glass2;
const PHONE_GLARE: Color = masterPalette.glass3;

/** Ticks per animation cycle: upright for the first half, sideways for the second. */
const CYCLE = 120;
const PHONE_CENTER = { x: ROTATE_PROMPT_WIDTH / 2, y: 149 } as const;
const CAPTION_Y = 219;

/** Radius of the turn arrow's arc around the phone's center, px. */
const ARC_R = 40;

/**
 * A quarter-turn clockwise arrow around the phone: an arc over its top right, ending in an
 * arrowhead pointing down. Built once as a sprite centered on the phone.
 */
const TURN_ARROW = (() => {
  const size = ARC_R + 10;
  const rows: string[] = [];
  for (let y = -size; y <= size; y++) {
    let row = '';
    for (let x = -size; x <= size; x++) row += arrowPixel(x, y);
    rows.push(row);
  }
  return defineSprite({ k: ui.ink, g: ui.gold }, rows);
})();

/** `g` on the arrow, `k` on its 1 px outline, `.` elsewhere (offsets from the phone center). */
function arrowPixel(x: number, y: number): string {
  const onArc = (pad: number) => {
    const d = Math.hypot(x, y);
    const angle = Math.atan2(y, x); // screen y points down: the top right is -90°..0°
    return Math.abs(d - ARC_R) <= 1 + pad && angle >= -1.75 - pad / 20 && angle <= -0.2;
  };
  // Arrowhead below the arc's end: a triangle pointing down, apex 8 px under its base.
  const head = (pad: number) => {
    const top = -7 - pad;
    const depth = y - top;
    return depth >= 0 && depth <= 8 + pad * 2 && Math.abs(x - ARC_R) <= 7 + pad - depth;
  };
  if (onArc(0) || head(0)) return 'g';
  if (onArc(1) || head(1)) return 'k';
  return '.';
}

export function drawRotatePrompt(dc: TextTarget, tick: number): void {
  const { surface } = dc;
  surface.fillRect(0, 0, ROTATE_PROMPT_WIDTH, ROTATE_PROMPT_HEIGHT, BACKGROUND);
  for (let y = 0; y < ROTATE_PROMPT_HEIGHT; y += 16) {
    surface.fillRect(0, y, ROTATE_PROMPT_WIDTH, 5, STRIPE);
  }

  const sideways = tick % CYCLE >= CYCLE / 2;
  const w = sideways ? 54 : 32;
  const h = sideways ? 32 : 54;
  drawPhone(surface, PHONE_CENTER.x - w / 2, PHONE_CENTER.y - h / 2, w, h, sideways);
  if (!sideways) {
    const half = Math.floor(TURN_ARROW.width / 2);
    surface.drawBitmap(dc.sprites.get(TURN_ARROW), PHONE_CENTER.x - half, PHONE_CENTER.y - half);
  }

  drawOutlinedText(
    dc,
    fonts.regular,
    strings.rotateDevice,
    ROTATE_PROMPT_WIDTH / 2,
    CAPTION_Y,
    ui.gold,
    { align: 'center' },
  );
}

/** A phone: outlined body, screen with a glare stripe, and a speaker slot on the short side. */
function drawPhone(s: Surface, x: number, y: number, w: number, h: number, sideways: boolean) {
  s.fillRect(x + 1, y, w - 2, h, ui.ink);
  s.fillRect(x, y + 1, w, h - 2, ui.ink);
  s.fillRect(x + 1, y + 1, w - 2, h - 2, PHONE_BODY);
  const bezel = 4;
  const sx = x + (sideways ? bezel + 2 : bezel);
  const sy = y + (sideways ? bezel : bezel + 2);
  const sw = w - 2 * bezel - (sideways ? 4 : 0);
  const sh = h - 2 * bezel - (sideways ? 0 : 4);
  s.fillRect(sx, sy, sw, sh, PHONE_SCREEN);
  s.fillRect(sx + 3, sy + 3, 2, Math.max(2, sh - 10), PHONE_GLARE);
  if (sideways) s.fillRect(x + 2, y + h / 2 - 4, 1, 8, ui.panelEdge);
  else s.fillRect(x + w / 2 - 4, y + 2, 8, 1, ui.panelEdge);
}
