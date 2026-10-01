/**
 * Where the on-screen touch controls are, in game coordinates (480×270). The renderer draws
 * them here and the platform's touch adapter hit-tests fingers against the same layout, so
 * what you see is exactly what you can press.
 */
import { SCREEN_WIDTH, type ScreenKind, type Vec2 } from '../../core';

/**
 * Which controls a screen shows on touch devices:
 * - `tap`: none; any touch is a start input (Title, Cómo jugar).
 * - `play`: twin sticks, jump, Weapon cycle (the HUD Weapon icon) and pause.
 * - `menu`: a d-pad, confirm and back, for menu navigation (also swipes, see the adapter).
 *
 * A new screen fails to typecheck until it picks a mode here.
 */
export type TouchControlsMode = 'tap' | 'play' | 'menu';

export const TOUCH_MODES: Readonly<Record<ScreenKind, TouchControlsMode>> = {
  title: 'tap',
  'how-to-play': 'tap',
  run: 'play',
  paused: 'menu',
};

export type PlayButton = 'jump' | 'pause' | 'weapon';
export type MenuButton = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';
export type TouchButton = PlayButton | MenuButton;

interface Circle {
  /** Center. */
  readonly x: number;
  readonly y: number;
  /** Drawn radius. */
  readonly r: number;
  /** Radius that accepts a press: larger than drawn, for thumbs. */
  readonly hit: number;
}

export const TOUCH_LAYOUT = {
  /** Stick travel and dead zone (share of the travel). Sticks float where the thumb lands. */
  stick: { radius: 22, deadZone: 0.2 },
  /** Where each stick is drawn while no finger holds it. */
  moveStickRest: { x: 50, y: 216 },
  aimStickRest: { x: 430, y: 216 },
  /** Touches left of this line drive the move stick, right of it the aim stick. */
  splitX: SCREEN_WIDTH / 2,

  jump: { x: 354, y: 236, r: 13, hit: 22 },
  /** Top right, under the score. */
  pause: { x: 467, y: 31, r: 8, hit: 16 },
  /** The HUD Weapon icon and its ammo (tap to cycle Weapons). */
  weapon: { x: 0, y: 12, w: 46, h: 22 },

  /** Menu d-pad: a press anywhere within `hit` picks the arrow on its dominant axis. */
  dpad: { x: 52, y: 214, arm: 17, hit: 44 },
  confirm: { x: 432, y: 210, r: 14, hit: 24 },
  back: { x: 396, y: 236, r: 10, hit: 17 },
} as const satisfies Record<string, unknown>;

const within = (p: Vec2, c: Circle) => Math.hypot(p.x - c.x, p.y - c.y) <= c.hit;

/** The button under `point` in `mode`, or null (then the touch drives a stick or a swipe). */
export function touchButtonAt(mode: TouchControlsMode, point: Vec2): TouchButton | null {
  const L = TOUCH_LAYOUT;
  if (mode === 'play') {
    if (within(point, L.pause)) return 'pause';
    if (within(point, L.jump)) return 'jump';
    const w = L.weapon;
    if (point.x >= w.x && point.x < w.x + w.w && point.y >= w.y && point.y < w.y + w.h) {
      return 'weapon';
    }
    return null;
  }
  if (mode === 'menu') {
    if (within(point, L.confirm)) return 'confirm';
    if (within(point, L.back)) return 'back';
    const dx = point.x - L.dpad.x;
    const dy = point.y - L.dpad.y;
    if (Math.hypot(dx, dy) > L.dpad.hit || Math.max(Math.abs(dx), Math.abs(dy)) < 4) return null;
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
    return dy < 0 ? 'up' : 'down';
  }
  return null;
}

/** A stick being held: its (floating) base and where its knob is drawn, game coordinates. */
export interface StickView {
  readonly origin: Vec2;
  readonly knob: Vec2;
}

/** What the touch overlay shows this frame: produced by the platform's touch adapter. */
export interface TouchOverlayView {
  readonly mode: TouchControlsMode;
  /** Held sticks; null draws the stick faintly at its rest position. */
  readonly moveStick: StickView | null;
  readonly aimStick: StickView | null;
  /** Buttons under a finger right now (drawn pressed). */
  readonly pressed: readonly TouchButton[];
}
