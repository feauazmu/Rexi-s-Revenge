import type { Vec2 } from './math';

/** Menu navigation, edge-triggered (true only on the tick the press happened). */
export interface MenuInput {
  readonly up: boolean;
  readonly down: boolean;
  readonly left: boolean;
  readonly right: boolean;
  readonly confirm: boolean;
  readonly back: boolean;
}

/**
 * Device-agnostic player intent for one tick. Platform adapters (keyboard + mouse, touch)
 * produce one frame per tick; the Game core never sees raw device events.
 *
 * "Held" fields describe state; edge-triggered fields are true only on the tick of the press.
 */
export interface InputFrame {
  /** Horizontal movement, -1 (left) .. 1 (right). */
  readonly move: number;
  /** Jump button held. */
  readonly jump: boolean;
  /** Drop-down button held: fall through the one-way platform Rexi stands on. */
  readonly drop: boolean;
  /** Aim target in game coordinates (480×270 space). */
  readonly aim: Vec2;
  /** Fire button held. */
  readonly fire: boolean;
  /** Edge: select the next Weapon in the inventory. */
  readonly weaponNext: boolean;
  /** Edge: select the previous Weapon in the inventory. */
  readonly weaponPrevious: boolean;
  /** Edge: select inventory slot 1..6 directly, or null. */
  readonly weaponSlot: number | null;
  /** Edge: pause / unpause. */
  readonly pause: boolean;
  /** Edge: menu navigation. */
  readonly menu: MenuInput;
  /** Edge: "any start input" (any key, click or tap) for title-style screens. */
  readonly start: boolean;
}

const NO_MENU: MenuInput = {
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

/** A frame with nothing pressed, aiming at the center of the screen. */
export const NEUTRAL_INPUT: InputFrame = {
  move: 0,
  jump: false,
  drop: false,
  aim: { x: 240, y: 135 },
  fire: false,
  weaponNext: false,
  weaponPrevious: false,
  weaponSlot: null,
  pause: false,
  menu: NO_MENU,
  start: false,
};

export type InputFramePatch = Partial<Omit<InputFrame, 'menu'>> & {
  readonly menu?: Partial<MenuInput>;
};

/** Builds a full input frame from the fields that differ from {@link NEUTRAL_INPUT}. */
export function inputFrame(patch: InputFramePatch = {}): InputFrame {
  return { ...NEUTRAL_INPUT, ...patch, menu: { ...NO_MENU, ...patch.menu } };
}
