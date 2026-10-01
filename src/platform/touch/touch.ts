/**
 * DOM side of the touch adapter: tracks every pointer on the container by id (multi-touch)
 * and forwards it, in game coordinates, to the pure {@link TouchController}.
 */
import type { Viewport } from '../viewport';
import { screenToGameUnclamped } from '../viewport';
import { createTouchController, type TouchController } from './controller';

export interface TouchInput {
  /** The controller: sample it once per tick and ask it for the overlay when drawing. */
  readonly controller: TouchController;
  dispose(): void;
}

/**
 * Listens to pointer events on `container` (where the game image is letterboxed). Each
 * pointer is captured on contact, so a thumb sliding off the page keeps its stick until it
 * lifts. `viewport` returns the current layout, for mapping CSS px to game coordinates.
 */
export function createTouchInput(container: HTMLElement, viewport: () => Viewport): TouchInput {
  const controller = createTouchController();

  const pointOf = (e: PointerEvent) => {
    const rect = container.getBoundingClientRect();
    return screenToGameUnclamped({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewport());
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    try {
      container.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-released pointers cannot be captured; tracking still works.
    }
    controller.down(e.pointerId, pointOf(e));
  };
  const onMove = (e: PointerEvent) => {
    controller.move(e.pointerId, pointOf(e));
  };
  const onUp = (e: PointerEvent) => {
    controller.up(e.pointerId, pointOf(e));
  };
  const onCancel = (e: PointerEvent) => {
    controller.cancel(e.pointerId);
  };
  const onBlur = () => {
    controller.releaseAll();
  };
  const onContextMenu = (e: Event) => {
    e.preventDefault(); // long presses must not open the context menu
  };

  container.addEventListener('pointerdown', onDown);
  container.addEventListener('pointermove', onMove);
  container.addEventListener('pointerup', onUp);
  container.addEventListener('pointercancel', onCancel);
  container.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('blur', onBlur);

  return {
    controller,
    dispose() {
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('pointerup', onUp);
      container.removeEventListener('pointercancel', onCancel);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
    },
  };
}
