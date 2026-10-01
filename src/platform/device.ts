import type { DeviceKind } from '../core';

/**
 * Picks the controls for this device: touch when the primary pointer is coarse (a finger),
 * else keyboard + mouse. `?device=touch` or `?device=desktop` in the URL overrides it (for
 * trying the touch controls in a desktop browser's device emulation, or the reverse).
 */
export function chooseDevice(urlParam: string | null, coarsePointer: boolean): DeviceKind {
  if (urlParam === 'touch' || urlParam === 'desktop') return urlParam;
  return coarsePointer ? 'touch' : 'desktop';
}

/** {@link chooseDevice} for the current page. */
export function detectDevice(): DeviceKind {
  const param = new URLSearchParams(window.location.search).get('device');
  return chooseDevice(param, window.matchMedia('(pointer: coarse)').matches);
}

/** True when the game cannot be played as shown: a touch device held upright. */
export function isPortrait(width: number, height: number): boolean {
  return height > width;
}
