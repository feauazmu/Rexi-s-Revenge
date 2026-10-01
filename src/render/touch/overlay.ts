/**
 * The on-screen touch controls, drawn over the frame. Idle controls are dithered outlines so
 * the Arena shows through (no alpha: the determinism rule); a control lights up solid while a
 * finger holds it. Positions come from `TOUCH_LAYOUT`, which the touch adapter hit-tests.
 */
import type { Vec2 } from '../../core';
import type { DrawContext } from '../draw-context';
import { ui } from '../screens/ui';
import { defineSprite, type SpriteDef } from '../sprite';
import type { Color } from '../surface';
import { TOUCH_LAYOUT as L, type TouchButton, type TouchOverlayView } from './layout';

const RING: Color = '#6a5a92';
const KNOB: Color = '#b8a8d0';
const GHOST: Color = '#d8ccec';
const RED: Color = '#e8433a';
const RED_LIGHT: Color = '#ff9a7a';

export function drawTouchOverlay(dc: DrawContext, overlay: TouchOverlayView): void {
  const pressed = (button: TouchButton) => overlay.pressed.includes(button);
  if (overlay.mode === 'play') {
    drawStick(dc, overlay.moveStick, L.moveStickRest);
    drawStick(dc, overlay.aimStick, L.aimStickRest);
    drawJump(dc, pressed('jump'));
    drawPause(dc, pressed('pause'));
    drawWeaponHint(dc, pressed('weapon'));
  } else if (overlay.mode === 'menu') {
    drawDpad(dc, pressed);
    drawRoundButton(dc, CONFIRM, pressed('confirm'));
    drawRoundButton(dc, BACK, pressed('back'));
  }
}

// ---------------------------------------------------------------------------------------------
// Disc sprites: built once per shape (the SpriteBank caches by sprite identity).

/** Half-width of a disc of radius `r` at row offset `dy` (same metric as `fillCircle`). */
function halfWidth(r: number, dy: number): number {
  const sq = (r + 0.5) ** 2 - dy * dy;
  return sq < 0 ? -1 : Math.floor(Math.sqrt(sq));
}

const inDisc = (r: number, dx: number, dy: number) => Math.abs(dx) <= halfWidth(r, dy);

/** A (2r+1)² sprite from a per-pixel palette key, `.` for transparent. */
function discSprite(
  r: number,
  colors: Readonly<Record<string, Color>>,
  key: (dx: number, dy: number) => string,
): SpriteDef {
  const rows: string[] = [];
  for (let dy = -r; dy <= r; dy++) {
    let row = '';
    for (let dx = -r; dx <= r; dx++) row += inDisc(r, dx, dy) ? key(dx, dy) : '.';
    rows.push(row);
  }
  return defineSprite(colors, rows);
}

const checker = (dx: number, dy: number) => ((dx + dy) & 1) === 0;

/** A ring `thickness` px wide, every other pixel when `dithered`. */
function ringSprite(r: number, thickness: number, color: Color, dithered: boolean): SpriteDef {
  return discSprite(r, { c: color }, (dx, dy) =>
    !inDisc(r - thickness, dx, dy) && (!dithered || checker(dx, dy)) ? 'c' : '.',
  );
}

/**
 * An idle button: outline, a solid rim of `fill`, and a sparse 25% dither of it inside, so
 * the Arena shows through.
 */
function ghostDisc(r: number, fill: Color): SpriteDef {
  return discSprite(r, { k: ui.ink, f: fill }, (dx, dy) => {
    if (!inDisc(r - 1, dx, dy)) return 'k';
    if (!inDisc(r - 2, dx, dy)) return 'f';
    return (dx & 1) === 0 && (dy & 1) === 0 ? 'f' : '.';
  });
}

/** A solid button: outline, fill, and a lighter crescent at the top left. */
function solidDisc(r: number, fill: Color, light: Color): SpriteDef {
  return discSprite(r, { k: ui.ink, f: fill, l: light }, (dx, dy) => {
    if (!inDisc(r - 1, dx, dy)) return 'k';
    const lit = inDisc(r - 3, dx + 1, dy + 1) && !inDisc(r - 3, dx - 1, dy);
    return lit ? 'l' : 'f';
  });
}

function drawCentered(dc: DrawContext, sprite: SpriteDef, cx: number, cy: number): void {
  dc.surface.drawBitmap(
    dc.sprites.get(sprite),
    Math.round(cx) - Math.floor(sprite.width / 2),
    Math.round(cy) - Math.floor(sprite.height / 2),
  );
}

// ---------------------------------------------------------------------------------------------
// Sticks

const R = L.stick.radius;
const STICK_REST_RING = ringSprite(R - 4, 1, GHOST, true);
const STICK_REST_KNOB = discSprite(5, { g: GHOST }, (dx, dy) => (checker(dx, dy) ? 'g' : '.'));
const STICK_BASE_OUTER = ringSprite(R + 1, 1, ui.ink, false);
const STICK_BASE_RING = ringSprite(R, 1, RING, false);
const STICK_BASE_INNER = ringSprite(R - 1, 1, GHOST, true);
const STICK_KNOB = discSprite(8, { k: ui.ink, f: KNOB, w: ui.keyFace }, (dx, dy) => {
  if (!inDisc(7, dx, dy)) return 'k';
  return inDisc(2, dx + 2, dy + 2) ? 'w' : 'f';
});

function drawStick(dc: DrawContext, stick: { origin: Vec2; knob: Vec2 } | null, rest: Vec2) {
  if (!stick) {
    drawCentered(dc, STICK_REST_RING, rest.x, rest.y);
    drawCentered(dc, STICK_REST_KNOB, rest.x, rest.y);
    return;
  }
  const { origin, knob } = stick;
  drawCentered(dc, STICK_BASE_OUTER, origin.x, origin.y);
  drawCentered(dc, STICK_BASE_INNER, origin.x, origin.y);
  drawCentered(dc, STICK_BASE_RING, origin.x, origin.y);
  drawCentered(dc, STICK_KNOB, knob.x, knob.y);
}

// ---------------------------------------------------------------------------------------------
// Buttons

const ARROW_UP_ROWS = ['...#...', '..###..', '.#####.', '#######'];
/** Up arrow turned to face left (its columns become rows). */
const ARROW_LEFT_ROWS = Array.from({ length: 7 }, (_, x) =>
  ARROW_UP_ROWS.map((row) => row.charAt(x)).join(''),
).reverse();
const ARROW_ROWS = {
  up: ARROW_UP_ROWS,
  down: [...ARROW_UP_ROWS].reverse(),
  left: ARROW_LEFT_ROWS,
  right: ARROW_LEFT_ROWS.map((row) => Array.from(row).reverse().join('')),
} as const;
const glyph = (rows: readonly string[], color: Color) => defineSprite({ '#': color }, rows);

const JUMP_ARROW = defineSprite({ '#': ui.text, k: ui.ink }, [
  '..k#k..',
  '.k###k.',
  'k#####k',
  'kk###kk',
  '.k###k.',
  '.k###k.',
  '.kkkkk.',
]);
const JUMP_IDLE = ghostDisc(L.jump.r, RED);
const JUMP_PRESSED = solidDisc(L.jump.r, RED, RED_LIGHT);

function drawJump(dc: DrawContext, pressed: boolean): void {
  const { x, y } = L.jump;
  drawCentered(dc, pressed ? JUMP_PRESSED : JUMP_IDLE, x, y);
  drawCentered(dc, JUMP_ARROW, x, y + (pressed ? 0 : -1));
}

const PAUSE_IDLE = ghostDisc(L.pause.r, RING);
const PAUSE_PRESSED = solidDisc(L.pause.r, RING, KNOB);

function drawPause(dc: DrawContext, pressed: boolean): void {
  const { x, y } = L.pause;
  drawCentered(dc, pressed ? PAUSE_PRESSED : PAUSE_IDLE, x, y);
  const { surface } = dc;
  for (const bx of [x - 3, x + 1]) {
    surface.fillRect(bx - 1, y - 4, 4, 9, ui.ink);
    surface.fillRect(bx, y - 3, 2, 7, ui.keyFace);
  }
}

/** Corner brackets around the HUD Weapon icon: it is a button on touch (tap to cycle). */
function drawWeaponHint(dc: DrawContext, pressed: boolean): void {
  const { surface } = dc;
  const color = pressed ? ui.gold : GHOST;
  // The HUD draws the icon at (6, 16), 11×10; brackets sit 2 px outside it.
  const left = 3;
  const top = 13;
  const right = 19;
  const bottom = 28;
  const arm = 3;
  for (const [cx, cy, sx, sy] of [
    [left, top, 1, 1],
    [right, top, -1, 1],
    [left, bottom, 1, -1],
    [right, bottom, -1, -1],
  ] as const) {
    surface.fillRect(sx > 0 ? cx : cx - arm + 1, cy, arm, 1, color);
    surface.fillRect(cx, sy > 0 ? cy : cy - arm + 1, 1, arm, color);
  }
}

const CHECK = glyph(
  ['.......##', '......###', '##...###.', '###.###..', '.#####...', '..###....'],
  ui.ink,
);
const CROSS = glyph(['##...##', '.##.##.', '..###..', '.##.##.', '##...##'], ui.text);

interface RoundButton {
  readonly x: number;
  readonly y: number;
  readonly idle: SpriteDef;
  readonly pressed: SpriteDef;
  readonly icon: SpriteDef;
}

const CONFIRM: RoundButton = {
  ...L.confirm,
  idle: solidDisc(L.confirm.r, ui.gold, ui.keyFace),
  pressed: solidDisc(L.confirm.r, ui.keyLit, ui.keyFace),
  icon: CHECK,
};
const BACK: RoundButton = {
  ...L.back,
  idle: solidDisc(L.back.r, ui.panelLight, ui.panelEdge),
  pressed: solidDisc(L.back.r, ui.panelEdge, KNOB),
  icon: CROSS,
};

function drawRoundButton(dc: DrawContext, button: RoundButton, pressed: boolean): void {
  drawCentered(dc, pressed ? button.pressed : button.idle, button.x, button.y);
  drawCentered(dc, button.icon, button.x, button.y + (pressed ? 1 : 0));
}

// ---------------------------------------------------------------------------------------------
// Menu d-pad: a plus-shaped pad with one key per direction.

const DPAD_KEY = 15;
const DPAD_ARROWS = {
  up: glyph(ARROW_ROWS.up, ui.text),
  down: glyph(ARROW_ROWS.down, ui.text),
  left: glyph(ARROW_ROWS.left, ui.text),
  right: glyph(ARROW_ROWS.right, ui.text),
} as const;
const DPAD_ARROWS_LIT = {
  up: glyph(ARROW_ROWS.up, ui.ink),
  down: glyph(ARROW_ROWS.down, ui.ink),
  left: glyph(ARROW_ROWS.left, ui.ink),
  right: glyph(ARROW_ROWS.right, ui.ink),
} as const;

function drawDpad(dc: DrawContext, pressed: (button: TouchButton) => boolean): void {
  const { surface } = dc;
  const { x, y, arm } = L.dpad;
  const half = Math.floor(DPAD_KEY / 2);
  const span = arm + half;
  // Plus-shaped outline and body.
  surface.fillRect(x - half - 1, y - span - 1, DPAD_KEY + 2, span * 2 + 3, ui.ink);
  surface.fillRect(x - span - 1, y - half - 1, span * 2 + 3, DPAD_KEY + 2, ui.ink);
  surface.fillRect(x - half, y - span, DPAD_KEY, span * 2 + 1, ui.panelLight);
  surface.fillRect(x - span, y - half, span * 2 + 1, DPAD_KEY, ui.panelLight);
  surface.fillRect(x - 2, y - 2, 5, 5, ui.panel);

  const keys = [
    ['up', 0, -arm],
    ['down', 0, arm],
    ['left', -arm, 0],
    ['right', arm, 0],
  ] as const;
  for (const [dir, dx, dy] of keys) {
    const lit = pressed(dir);
    if (lit) surface.fillRect(x + dx - half, y + dy - half, DPAD_KEY, DPAD_KEY, ui.keyLit);
    drawCentered(dc, lit ? DPAD_ARROWS_LIT[dir] : DPAD_ARROWS[dir], x + dx, y + dy);
  }
}
