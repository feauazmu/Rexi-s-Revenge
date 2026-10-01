/**
 * The touch adapter's logic, free of the DOM: fingers (by pointer id, in game coordinates) in,
 * one input frame per tick and the overlay to draw out. `touch.ts` feeds it pointer events.
 *
 * Each finger gets a role when it lands, from the current screen's controls mode
 * (`TOUCH_MODES`): a button, a stick, a menu swipe or a plain tap. It keeps that role until it
 * lifts, so sliding a thumb off a button or across the middle of the screen never re-routes it.
 */
import {
  NEUTRAL_INPUT,
  type GameView,
  type InputFrame,
  type MenuInput,
  type ScreenKind,
  type Vec2,
} from '../../core';
import {
  TOUCH_LAYOUT,
  TOUCH_MODES,
  touchButtonAt,
  type MenuButton,
  type StickView,
  type TouchButton,
  type TouchControlsMode,
  type TouchOverlayView,
} from '../../render';
import { aimTarget, followFinger, readStick, stickToMove, wantsDrop } from './stick';

/** Distance from Rexi's shoulder to the aim point the aim stick produces, game px. */
export const AIM_DISTANCE = 128;
/** A menu-mode touch that travels this far (game px) before lifting is a swipe. */
export const SWIPE_DISTANCE = 32;

type Role =
  | { readonly kind: 'button'; readonly button: TouchButton }
  | { readonly kind: 'stick'; readonly stick: 'move' | 'aim'; origin: Vec2; point: Vec2 }
  | { readonly kind: 'swipe'; readonly start: Vec2; point: Vec2 }
  | { readonly kind: 'none' };

export interface TouchController {
  /** A finger landed. Points are game coordinates (not clamped: letterbox bars count too). */
  down(id: number, point: Vec2): void;
  move(id: number, point: Vec2): void;
  /** A finger lifted (completes a swipe). */
  up(id: number, point: Vec2): void;
  /** The system took the pointer over (gesture, palm rejection): release it, no swipe. */
  cancel(id: number): void;
  /** Releases every finger (focus lost, orientation blocked). */
  releaseAll(): void;
  /**
   * The input frame for the next tick of the game showing `view`. Edges (taps, swipes) appear
   * in exactly one frame.
   */
  sample(view: GameView): InputFrame;
  /** What to draw over `view`, or null on screens without controls. */
  overlay(view: GameView): TouchOverlayView | null;
}

const PLAY_BUTTONS: ReadonlySet<TouchButton> = new Set(['jump', 'pause', 'weapon']);

export function createTouchController(): TouchController {
  const fingers = new Map<number, Role>();
  let screen: ScreenKind = 'title';
  const mode = (): TouchControlsMode => TOUCH_MODES[screen];

  // Edges collected since the last sample.
  let start = false;
  let pause = false;
  let weaponNext = false;
  let menu: Record<keyof MenuInput, boolean> = noMenu();

  /** The last aim direction: kept after the aim stick is released. */
  let aimDirection: Vec2 = { x: 1, y: 0 };

  const stickHeld = (stick: 'move' | 'aim') =>
    [...fingers.values()].some((r) => r.kind === 'stick' && r.stick === stick);

  const press = (button: TouchButton) => {
    if (button === 'pause') pause = true;
    else if (button === 'weapon') weaponNext = true;
    else if (button !== 'jump') menu[button] = true;
  };

  const roleFor = (point: Vec2): Role => {
    const current = mode();
    const button = touchButtonAt(current, point);
    if (button) return { kind: 'button', button };
    if (current === 'menu') return { kind: 'swipe', start: point, point };
    if (current === 'play') {
      const stick = point.x < TOUCH_LAYOUT.splitX ? 'move' : 'aim';
      if (!stickHeld(stick)) return { kind: 'stick', stick, origin: point, point };
    }
    return { kind: 'none' };
  };

  const stickVector = (stick: 'move' | 'aim'): Vec2 | null => {
    for (const role of fingers.values()) {
      if (role.kind === 'stick' && role.stick === stick) {
        return readStick(role.origin, role.point, TOUCH_LAYOUT.stick);
      }
    }
    return null;
  };

  const observe = (view: GameView) => {
    screen = view.screen;
  };

  return {
    down(id, point) {
      start = true;
      const role = roleFor(point);
      fingers.set(id, role);
      if (role.kind === 'button') press(role.button);
    },

    move(id, point) {
      const role = fingers.get(id);
      if (role?.kind === 'stick') {
        role.origin = followFinger(role.origin, point, TOUCH_LAYOUT.stick.radius);
        role.point = point;
      } else if (role?.kind === 'swipe') {
        role.point = point;
      }
    },

    up(id, point) {
      const role = fingers.get(id);
      fingers.delete(id);
      if (role?.kind !== 'swipe') return;
      const direction = swipeDirection(role.start, point);
      if (direction) menu[direction] = true;
    },

    cancel(id) {
      fingers.delete(id);
    },

    releaseAll() {
      fingers.clear();
    },

    sample(view) {
      observe(view);
      const playing = mode() === 'play';
      const moveStick = (playing ? stickVector('move') : null) ?? { x: 0, y: 0 };
      const aimStick = playing ? stickVector('aim') : null;
      const move = stickToMove(moveStick);

      const firing = aimStick !== null && (aimStick.x !== 0 || aimStick.y !== 0);
      if (firing) aimDirection = aimStick;
      else if (playing && move !== 0) aimDirection = { x: Math.sign(move), y: 0 };

      const shoulder = view.run?.rexi.shoulder;
      const frame: InputFrame = {
        ...NEUTRAL_INPUT,
        move,
        jump:
          playing && [...fingers.values()].some((r) => r.kind === 'button' && r.button === 'jump'),
        drop: wantsDrop(moveStick),
        aim: shoulder ? aimTarget(shoulder, aimDirection, AIM_DISTANCE) : NEUTRAL_INPUT.aim,
        fire: firing,
        weaponNext,
        pause,
        menu,
        start,
      };
      start = false;
      pause = false;
      weaponNext = false;
      menu = noMenu();
      return frame;
    },

    overlay(view) {
      observe(view);
      const current = mode();
      if (current === 'tap') return null;
      const sticks: Partial<Record<'move' | 'aim', StickView>> = {};
      const pressed: TouchButton[] = [];
      for (const role of fingers.values()) {
        if (role.kind === 'stick' && current === 'play') {
          sticks[role.stick] = { origin: role.origin, knob: role.point };
        } else if (
          role.kind === 'button' &&
          PLAY_BUTTONS.has(role.button) === (current === 'play')
        ) {
          if (!pressed.includes(role.button)) pressed.push(role.button);
        }
      }
      return {
        mode: current,
        moveStick: sticks.move ?? null,
        aimStick: sticks.aim ?? null,
        pressed,
      };
    },
  };
}

function noMenu(): Record<keyof MenuInput, boolean> {
  return { up: false, down: false, left: false, right: false, confirm: false, back: false };
}

/** The menu direction of a swipe from `from` to `to` (dominant axis), or null if too short. */
function swipeDirection(from: Vec2, to: Vec2): MenuButton | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < SWIPE_DISTANCE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}
