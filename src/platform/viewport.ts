import { SCREEN_HEIGHT, SCREEN_WIDTH, type Vec2 } from '../core';

/** Where and how big the 480×270 game image is drawn inside its container. */
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

/**
 * Largest integer scale (in device pixels) that fits the container, centered with letterbox
 * bars. Offsets are snapped to device pixels so game pixels stay perfectly square.
 */
export function computeViewport(
  containerWidth: number,
  containerHeight: number,
  devicePixelRatio = 1,
): Viewport {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  const scale = Math.max(
    1,
    Math.floor(
      Math.min((containerWidth * dpr) / SCREEN_WIDTH, (containerHeight * dpr) / SCREEN_HEIGHT),
    ),
  );
  const cssScale = scale / dpr;
  const width = SCREEN_WIDTH * cssScale;
  const height = SCREEN_HEIGHT * cssScale;
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
  const x = (point.x - viewport.offsetX) / viewport.cssScale;
  const y = (point.y - viewport.offsetY) / viewport.cssScale;
  return {
    x: Math.min(Math.max(x, 0), SCREEN_WIDTH),
    y: Math.min(Math.max(y, 0), SCREEN_HEIGHT),
  };
}
