import { SCREEN_HEIGHT, SCREEN_WIDTH, type Vec2 } from '../core';

/** Where and how big the 640×360 game image is drawn inside its container. */
export interface Viewport {
  /** Whole device pixels per game pixel (crisp integer scaling). */
  readonly scale: number;
  /** CSS pixels per game pixel (`scale / devicePixelRatio`). */
  readonly cssScale: number;
  /** Top-left corner of the game image inside the container, CSS px (letterbox offset). */
  readonly offsetX: number;
  readonly offsetY: number;
  /** Size of the game image, CSS px. */
  readonly width: number;
  readonly height: number;
}

/** Size in image pixels of what a viewport shows: the game, or the portrait rotate prompt. */
export interface ImageSize {
  readonly width: number;
  readonly height: number;
}

const GAME_SIZE: ImageSize = { width: SCREEN_WIDTH, height: SCREEN_HEIGHT };

/**
 * Largest integer scale (in device pixels) that fits an image (by default the 640×360 game)
 * in the container, centered with letterbox bars. Offsets are snapped to device pixels so
 * image pixels stay perfectly square.
 */
export function computeViewport(
  containerWidth: number,
  containerHeight: number,
  devicePixelRatio = 1,
  image: ImageSize = GAME_SIZE,
): Viewport {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((containerWidth * dpr) / image.width, (containerHeight * dpr) / image.height),
    ),
  );
  const cssScale = scale / dpr;
  const width = image.width * cssScale;
  const height = image.height * cssScale;
  const snap = (cssPx: number) => Math.round(cssPx * dpr) / dpr;
  return {
    scale,
    cssScale,
    offsetX: snap((containerWidth - width) / 2),
    offsetY: snap((containerHeight - height) / 2),
    width,
    height,
  };
}

/**
 * Maps a point in container CSS pixels (e.g. a pointer position) to game coordinates,
 * clamped to the screen so aiming from the letterbox bars still points somewhere sensible.
 */
export function screenToGame(point: Vec2, viewport: Viewport): Vec2 {
  const { x, y } = screenToGameUnclamped(point, viewport);
  return {
    x: Math.min(Math.max(x, 0), SCREEN_WIDTH),
    y: Math.min(Math.max(y, 0), SCREEN_HEIGHT),
  };
}

/**
 * Like {@link screenToGame} but not clamped: points over the letterbox bars land outside
 * 0..640 × 0..360. Touch sticks use it so a thumb on a bar still moves its stick truthfully.
 */
export function screenToGameUnclamped(point: Vec2, viewport: Viewport): Vec2 {
  return {
    x: (point.x - viewport.offsetX) / viewport.cssScale,
    y: (point.y - viewport.offsetY) / viewport.cssScale,
  };
}
