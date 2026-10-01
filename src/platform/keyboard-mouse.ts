import { NEUTRAL_INPUT, type InputFrame, type Vec2 } from '../core';
import { screenToGame, type Viewport } from './viewport';

/** Keyboard bindings by `KeyboardEvent.code` (layout-independent physical keys). */
export const KEY_BINDINGS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['KeyW', 'ArrowUp', 'Space'],
  drop: ['KeyS', 'ArrowDown'],
  weaponNext: ['KeyE'],
  weaponPrevious: ['KeyQ'],
  weaponSlots: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],
  pause: ['Escape', 'KeyP'],
  menuUp: ['ArrowUp', 'KeyW'],
  menuDown: ['ArrowDown', 'KeyS'],
  menuLeft: ['ArrowLeft', 'KeyA'],
  menuRight: ['ArrowRight', 'KeyD'],
  menuConfirm: ['Enter', 'Space'],
  menuBack: ['Escape', 'Backspace'],
} as const satisfies Record<string, readonly string[]>;

/** Keys whose browser default (scrolling, etc.) is suppressed while playing. */
export const CAPTURED_KEYS: ReadonlySet<string> = new Set(
  Object.values(KEY_BINDINGS).flat() as string[],
);

/** Device state accumulated between two samples. */
export interface KeyboardMouseSnapshot {
  /** Codes currently held down. */
  readonly held: ReadonlySet<string>;
  /** Codes pressed since the previous sample (edges). */
  readonly pressed: ReadonlySet<string>;
  /** Pointer position in container CSS px, or null if it never moved over the page. */
  readonly pointer: Vec2 | null;
  /** Primary mouse button held. */
  readonly primaryHeld: boolean;
  /** Primary mouse button pressed since the previous sample. */
  readonly primaryPressed: boolean;
  /** Accumulated wheel delta since the previous sample (positive = scrolled down). */
  readonly wheel: number;
}

/** Pure mapping from keyboard + mouse state to one tick's input frame. */
export function toInputFrame(snapshot: KeyboardMouseSnapshot, viewport: Viewport): InputFrame {
  const isHeld = (codes: readonly string[]) => codes.some((c) => snapshot.held.has(c));
  const wasPressed = (codes: readonly string[]) => codes.some((c) => snapshot.pressed.has(c));
  const slotIndex = KEY_BINDINGS.weaponSlots.findIndex((c) => snapshot.pressed.has(c));

  return {
    move: (isHeld(KEY_BINDINGS.right) ? 1 : 0) - (isHeld(KEY_BINDINGS.left) ? 1 : 0),
    jump: isHeld(KEY_BINDINGS.jump),
    drop: isHeld(KEY_BINDINGS.drop),
    aim: snapshot.pointer ? screenToGame(snapshot.pointer, viewport) : NEUTRAL_INPUT.aim,
    fire: snapshot.primaryHeld,
    weaponNext: wasPressed(KEY_BINDINGS.weaponNext) || snapshot.wheel > 0,
    weaponPrevious: wasPressed(KEY_BINDINGS.weaponPrevious) || snapshot.wheel < 0,
    weaponSlot: slotIndex === -1 ? null : slotIndex + 1,
    pause: wasPressed(KEY_BINDINGS.pause),
    menu: {
      up: wasPressed(KEY_BINDINGS.menuUp),
      down: wasPressed(KEY_BINDINGS.menuDown),
      left: wasPressed(KEY_BINDINGS.menuLeft),
      right: wasPressed(KEY_BINDINGS.menuRight),
      confirm: wasPressed(KEY_BINDINGS.menuConfirm),
      back: wasPressed(KEY_BINDINGS.menuBack),
    },
    start: snapshot.pressed.size > 0 || snapshot.primaryPressed,
  };
}

export interface KeyboardMouseInput {
  /** Input frame for the next tick. Edges are consumed: they appear in exactly one frame. */
  sample(viewport: Viewport): InputFrame;
  dispose(): void;
}

/**
 * DOM adapter: listens to keyboard, pointer and wheel events and keeps a snapshot. Pointer
 * positions are measured relative to `container`, where the game image is letterboxed.
 */
export function createKeyboardMouseInput(container: HTMLElement): KeyboardMouseInput {
  const held = new Set<string>();
  let pressed = new Set<string>();
  let pointer: Vec2 | null = null;
  let primaryHeld = false;
  let primaryPressed = false;
  let wheel = 0;

  const onKeyDown = (e: KeyboardEvent) => {
    if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    pressed.add(e.code);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    held.delete(e.code);
  };
  const onPointerMove = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onPointerDown = (e: PointerEvent) => {
    onPointerMove(e);
    if (e.button !== 0) return;
    primaryHeld = true;
    primaryPressed = true;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) primaryHeld = false;
  };
  const onWheel = (e: WheelEvent) => {
    wheel += e.deltaY;
  };
  const onBlur = () => {
    held.clear();
    primaryHeld = false;
  };
  const onContextMenu = (e: Event) => {
    e.preventDefault();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('blur', onBlur);
  container.addEventListener('contextmenu', onContextMenu);

  return {
    sample(viewport) {
      const frame = toInputFrame(
        { held, pressed, pointer, primaryHeld, primaryPressed, wheel },
        viewport,
      );
      pressed = new Set();
      primaryPressed = false;
      wheel = 0;
      return frame;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('blur', onBlur);
      container.removeEventListener('contextmenu', onContextMenu);
    },
  };
}
