import type { FullscreenSupport } from '../core';

/** What the browser tells us about fullscreen, for {@link chooseFullscreenSupport}. */
export interface FullscreenFacts {
  /** The Fullscreen API is available (`document.fullscreenEnabled`). */
  readonly api: boolean;
  /** The page runs as an installed app (standalone display mode, or iOS's standalone flag). */
  readonly installed: boolean;
}

const SUPPORT_VALUES: readonly FullscreenSupport[] = ['toggle', 'install-hint', 'none'];

/**
 * Picks how the player can get fullscreen: the pause-menu toggle when the Fullscreen API is
 * available and the game is not installed, else nothing. `?fullscreen=toggle|install-hint|none`
 * in the URL overrides it (for trying each value in a desktop browser's device emulation).
 */
export function chooseFullscreenSupport(
  urlParam: string | null,
  facts: FullscreenFacts,
): FullscreenSupport {
  const override = SUPPORT_VALUES.find((value) => value === urlParam);
  if (override) return override;
  return facts.api && !facts.installed ? 'toggle' : 'none';
}

/**
 * {@link chooseFullscreenSupport} for the current page. The installed app runs in the
 * manifest's `fullscreen` display mode (or `standalone` where that is unavailable); iOS flags
 * a home-screen app with `navigator.standalone`.
 */
export function detectFullscreenSupport(): FullscreenSupport {
  const param = new URLSearchParams(window.location.search).get('fullscreen');
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return chooseFullscreenSupport(param, { api: document.fullscreenEnabled, installed });
}

/** True while the page is fullscreen. */
export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/**
 * Enters or leaves fullscreen. The browser may refuse (no user gesture, a policy, the player
 * declining); failures are ignored and the game carries on as it is.
 */
export function setFullscreen(on: boolean): void {
  if (on === isFullscreen()) return;
  try {
    const request = on ? document.documentElement.requestFullscreen() : document.exitFullscreen();
    request.catch(() => undefined);
  } catch {
    // Older engines throw instead of rejecting.
  }
}

/** Calls `listener` with the new state whenever the page enters or leaves fullscreen. */
export function watchFullscreen(listener: (active: boolean) => void): () => void {
  const onChange = () => {
    listener(isFullscreen());
  };
  document.addEventListener('fullscreenchange', onChange);
  return () => {
    document.removeEventListener('fullscreenchange', onChange);
  };
}
