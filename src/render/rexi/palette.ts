import { palette } from '../palette';
import type { Color } from '../surface';
import { tintPalette } from './grid';

/**
 * Rexi's palette (after reference/rexi-character-sheet.png). One character per color, shared by
 * every Rexi sprite so body parts, arm and held Weapons can be composed into one grid.
 */
export const rexiPalette = {
  k: palette.outline,
  // Light-brown hair.
  h: '#dcaa6e',
  H: '#b27c4a',
  d: '#7c4f2e',
  // Skin, light to deep shade.
  l: '#fbd2a6',
  s: '#eaa877',
  m: '#c97f54',
  n: '#93533a',
  e: '#2a1620',
  t: '#ffffff',
  // Judge's robe.
  R: '#433c58',
  r: '#29242f',
  q: '#141018',
  // Tank top.
  w: '#f6f4ef',
  W: '#c6c2d0',
  // Trousers and boots.
  p: '#8e8e9a',
  P: '#5e5e6c',
  c: '#a0603c',
  b: '#6e3c26',
  B: '#43231a',
  // Tattoo: sepia ink and the lion's golden mane.
  i: '#5c2c1a',
  a: '#d8963c',
  // Held Weapons.
  g: '#d4924c',
  o: '#9a5e30',
  G: '#5e3418',
  y: '#f0c858',
  Y: '#a87a28',
  // Lluvia de Sellos: red rubber stamp, blue ink pad.
  x: '#ff7a64',
  z: '#d42a2a',
  Z: '#8a1a1a',
  u: '#3a4ec0',
} as const satisfies Record<string, Color>;

export type RexiInk = keyof typeof rexiPalette;

/** Hurt blink: every color flushed toward a hot red, outline kept. */
export const rexiFlashPalette = tintPalette(rexiPalette, '#ff3030', 0.55, ['k']);
