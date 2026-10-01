import type { Color } from './surface';

/** Shared colors. Sprite-specific colors live next to their sprite. */
export const palette = {
  letterbox: '#000000',
  outline: '#1a1020',
  white: '#ffffff',
  crosshair: '#fff4c0',
} as const satisfies Record<string, Color>;
