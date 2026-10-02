import type { DeviceKind, FullscreenSupport } from '../core';

/** What the browser tells us about fullscreen, for {@link chooseFullscreenSupport}. */
export interface FullscreenFacts {
  /** The Fullscreen API is available (`document.fullscreenEnabled`). */
  readonly api: boolean;
  /** The page runs as an installed app (standalone display mode, or iOS's standalone flag). */
  readonly installed: boolean;
  /** The browser runs on iOS or iPadOS, where every browser is WebKit. */
  readonly ios: boolean;
}

const SUPPORT_VALUES: readonly FullscreenSupport[] = ['toggle', 'install-hint', 'none'];

/**
 * Picks how the player can get fullscreen: the pause-menu toggle (and, on touch devices, the
 * first touch; see {@link chooseFullscreenBehavior}) when the Fullscreen API is available and
 * the game is not installed; on iOS without the API (every iPhone browser), the Title's hint
 * to add the game to the home screen, unless it already is; else nothing.
 * `?fullscreen=toggle|install-hint|none` in the URL overrides it (for trying each value in a
 * desktop browser's device emulation).
 */
export function chooseFullscreenSupport(
  urlParam: string | null,
  facts: FullscreenFacts,
): FullscreenSupport {
  const override = SUPPORT_VALUES.find((value) => value === urlParam);
  if (override) return override;
  if (facts.installed) return 'none';
  if (facts.api) return 'toggle';
  return facts.ios ? 'install-hint' : 'none';
}

/** How the shell drives fullscreen on this device, from {@link chooseFullscreenBehavior}. */
export interface FullscreenBehavior {
  /** Enter fullscreen on the player's first touch ({@link fullscreenOnFirstTouch}). */
  readonly onFirstTouch: boolean;
  /** Lock the screen to landscape whenever fullscreen is entered ({@link setFullscreen}). */
  readonly lockLandscape: boolean;
}

/**
 * Touch devices with the toggle go fullscreen on the first touch, and every touch device locks
 * landscape on entering fullscreen; desktop enters fullscreen only through the pause menu.
 */
export function chooseFullscreenBehavior(
  device: DeviceKind,
  support: FullscreenSupport,
): FullscreenBehavior {
  const touch = device === 'touch';
  return { onFirstTouch: touch && support === 'toggle', lockLandscape: touch };
}

/**
 * {@link chooseFullscreenSupport} for the current page. The installed app runs in the
 * manifest's `fullscreen` display mode (or `standalone` where that is unavailable); iOS flags
 * a home-screen app with `navigator.standalone`. iPadOS reports itself as a Mac, so a Mac
 * with a touch screen counts as iOS too.
 */
export function detectFullscreenSupport(): FullscreenSupport {
  const param = new URLSearchParams(window.location.search).get('fullscreen');
  const installed =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const { userAgent } = navigator;
  const ios =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
  // iPhone browsers leave `fullscreenEnabled` undefined rather than false.
  const api = (document.fullscreenEnabled as boolean | undefined) ?? false;
  return chooseFullscreenSupport(param, { api, installed, ios });
}

/** True while the page is fullscreen. */
export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Options for {@link setFullscreen}. */
export interface SetFullscreenOptions {
  /**
   * Once fullscreen is entered, lock the screen to landscape where the browser allows it
   * (Android), so tilting a phone mid-Run doesn't freeze the game behind the rotate prompt.
   */
  readonly lockLandscape?: boolean;
}

/**
 * Enters or leaves fullscreen. The browser may refuse (no user gesture, a policy, the player
 * declining), and most refuse the orientation lock (desktop, iOS); failures are ignored and the
 * game carries on as it is. The browser releases the lock when the page leaves fullscreen.
 */
export function setFullscreen(on: boolean, options: SetFullscreenOptions = {}): void {
  if (on === isFullscreen()) return;
  try {
    if (!on) {
      document.exitFullscreen().catch(ignoreRefusal);
      return;
    }
    document.documentElement
      .requestFullscreen()
      .then(() => {
        if (options.lockLandscape) lockLandscape();
      })
      .catch(ignoreRefusal);
  } catch {
    // Older engines throw instead of rejecting.
  }
}

/**
 * Enters fullscreen (locked to landscape) on the player's first touch on `target`, once per
 * page load. The request runs inside the `touchend` handler, where the browser counts it as a
 * user gesture.
 */
export function fullscreenOnFirstTouch(target: EventTarget): () => void {
  const onTouchEnd = () => {
    setFullscreen(true, { lockLandscape: true });
  };
  target.addEventListener('touchend', onTouchEnd, { once: true });
  return () => {
    target.removeEventListener('touchend', onTouchEnd);
  };
}

function lockLandscape(): void {
  try {
    screen.orientation.lock('landscape').catch(ignoreRefusal);
  } catch {
    // No Screen Orientation API (older Safari) or no `lock` on it.
  }
}

function ignoreRefusal(): void {
  // The browser refused; the game carries on as it is.
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
