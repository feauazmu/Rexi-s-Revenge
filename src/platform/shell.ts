import {
  createGame,
  SCREEN_HEIGHT,
  SCREEN_WIDTH,
  type GameEvent,
  type GameView,
  type InputFrame,
} from '../core';
import {
  canvasSurface,
  createRenderer,
  ROTATE_PROMPT_HEIGHT,
  ROTATE_PROMPT_WIDTH,
  type TouchOverlayView,
} from '../render';
import { createCanvasBitmap, loadBitmap } from './bitmaps';
import { detectDevice, isPortrait } from './device';
import { createFixedStepper } from './fixed-step';
import {
  detectFullscreenSupport,
  fullscreenOnFirstTouch,
  isFullscreen,
  setFullscreen,
  watchFullscreen,
} from './fullscreen';
import { createKeyboardMouseInput } from './keyboard-mouse';
import { browserStorage } from './storage';
import { createTouchInput } from './touch/touch';
import { computeViewport, type ImageSize, type ScaleMode, type Viewport } from './viewport';

export interface ShellOptions {
  /** Seed for the Run. Default: `?seed=` from the URL, else random. */
  readonly seed?: number;
  /** Receives each tick's events (audio and other reactive adapters plug in here). */
  readonly onEvents?: (events: readonly GameEvent[]) => void;
  /**
   * The decoded 640×360 title illustration (see {@link loadTitleIllustration}). Without it the
   * Title draws its code-drawn backdrop.
   */
  readonly titleIllustration?: HTMLCanvasElement | null;
}

/** File name of the title illustration under the site's base URL (`public/title.png`). */
export const TITLE_ILLUSTRATION_FILE = 'title.png';

/** Loads the title illustration; resolves to null (code-drawn backdrop) if it is unavailable. */
export function loadTitleIllustration(baseUrl: string): Promise<HTMLCanvasElement | null> {
  return loadBitmap(`${baseUrl}${TITLE_ILLUSTRATION_FILE}`, SCREEN_WIDTH, SCREEN_HEIGHT);
}

export interface Shell {
  /** The Game's current view (adapters read their starting state from it, e.g. mute). */
  readonly view: GameView;
  stop(): void;
}

/** The input adapter for the device: one frame per tick, plus the touch overlay if any. */
interface InputAdapter {
  sample(view: GameView, viewport: Viewport): InputFrame;
  overlay(view: GameView): TouchOverlayView | null;
  /** Drop every held control (the game was hidden behind the rotate prompt). */
  release(): void;
  dispose(): void;
}

/**
 * Browser shell: creates the 640×360 canvas, scales it to fit (letterboxed, no smoothing): by
 * the largest integer factor on desktop, by the largest fractional one on touch devices. It
 * runs the fixed-timestep loop that feeds input frames to the Game core and draws its view. It
 * pauses the Run when the tab is hidden or loses focus.
 *
 * On touch devices it uses the touch adapter and draws its controls over the game; held in
 * portrait, it freezes the game and shows the "Gira tu teléfono" prompt instead.
 *
 * Where the pause menu can toggle fullscreen, it turns the Game's fullscreen toggle requests
 * into Fullscreen API calls and reports every browser fullscreen change back to the Game. Touch
 * devices there also enter fullscreen on the first tap, and lock the screen to landscape
 * whenever they enter it.
 */
export function startShell(root: HTMLElement, options: ShellOptions = {}): Shell {
  const device = detectDevice();
  root.dataset.device = device;

  const canvas = createCanvas(root, 'game-canvas', { width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  // Only touch devices can be blocked by orientation, so only they get the prompt's canvas.
  const rotateCanvas =
    device === 'touch'
      ? createCanvas(root, 'rotate-canvas', {
          width: ROTATE_PROMPT_WIDTH,
          height: ROTATE_PROMPT_HEIGHT,
        })
      : null;

  // Touch screens fill the space with fractional scaling; desktop keeps whole-number scaling.
  const scaleMode: ScaleMode = device === 'touch' ? 'fit' : 'integer';
  let viewport: Viewport = computeViewport(1, 1);
  /** True while a touch device is held upright: the game is frozen behind the prompt. */
  let blocked = false;
  const layout = () => {
    const { clientWidth: w, clientHeight: h } = root;
    const dpr = window.devicePixelRatio;
    viewport = computeViewport(w, h, dpr, { mode: scaleMode });
    place(canvas.element, viewport);
    const wasBlocked = blocked;
    blocked = rotateCanvas !== null && isPortrait(w, h);
    root.dataset.orientation = isPortrait(w, h) ? 'portrait' : 'landscape';
    canvas.element.hidden = blocked;
    if (rotateCanvas) {
      place(
        rotateCanvas.element,
        computeViewport(w, h, dpr, { image: rotateCanvas.size, mode: scaleMode }),
      );
      rotateCanvas.element.hidden = !blocked;
    }
    if (blocked && !wasBlocked) {
      game.pause();
      input.release();
    }
  };

  const fullscreenSupport = detectFullscreenSupport();
  const game = createGame({
    seed: options.seed ?? seedFromUrl() ?? randomSeed(),
    device,
    fullscreenSupport,
    storage: browserStorage(),
  });
  game.reportFullscreen(isFullscreen());
  const input =
    device === 'touch' ? touchAdapter(root, () => viewport) : keyboardMouseAdapter(root);
  const renderer = createRenderer(createCanvasBitmap, {
    titleIllustration: options.titleIllustration ?? null,
  });
  const surface = canvasSurface<HTMLCanvasElement>(canvas.ctx);
  const rotateSurface = rotateCanvas && canvasSurface<HTMLCanvasElement>(rotateCanvas.ctx);
  const stepper = createFixedStepper();
  /** Animation clock of the rotate prompt, in ticks (the game is frozen meanwhile). */
  let promptTicks = 0;

  /** Draws the current view and exposes the screen to the page (smoke tests, debugging). */
  const present = () => {
    if (blocked && rotateSurface) {
      renderer.renderRotatePrompt(rotateSurface, promptTicks);
    } else {
      const overlay = input.overlay(game.view);
      renderer.render(surface, game.view, overlay);
      root.dataset.touchControls = overlay?.mode ?? 'none';
    }
    root.dataset.screen = game.view.screen;
  };

  layout();
  present();
  const onResize = () => {
    layout();
    present();
  };
  window.addEventListener('resize', onResize);

  // Touch devices go fullscreen on the first tap; desktop only through the pause menu.
  const stopFullscreenOnFirstTouch =
    device === 'touch' && fullscreenSupport === 'toggle' ? fullscreenOnFirstTouch(root) : null;

  // Also catches the player leaving through the browser (Esc, the back gesture, system UI).
  const unwatchFullscreen = watchFullscreen((active) => {
    game.reportFullscreen(active);
    present();
  });

  // Never let Rexi die while the player is away: pause when the tab hides or loses focus.
  const autoPause = () => {
    game.pause();
    present();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') autoPause();
  };
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', onVisibilityChange);

  let frame = 0;
  let last: number | null = null;
  const loop = (now: number) => {
    const ticks = stepper.advance(last === null ? 0 : now - last);
    last = now;
    if (blocked) {
      promptTicks += ticks;
    } else {
      for (let i = 0; i < ticks; i++) {
        const events = game.tick(input.sample(game.view, viewport));
        for (const event of events) {
          if (event.type === 'fullscreen-toggle-requested') {
            setFullscreen(event.fullscreen, { lockLandscape: device === 'touch' });
          }
        }
        if (events.length > 0) options.onEvents?.(events);
      }
    }
    if (ticks > 0) present();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    get view() {
      return game.view;
    },
    stop() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unwatchFullscreen();
      stopFullscreenOnFirstTouch?.();
      input.dispose();
      canvas.element.remove();
      rotateCanvas?.element.remove();
    },
  };
}

function keyboardMouseAdapter(root: HTMLElement): InputAdapter {
  const input = createKeyboardMouseInput(root);
  return {
    sample: (_view, viewport) => input.sample(viewport),
    overlay: () => null,
    release: () => undefined,
    dispose: () => {
      input.dispose();
    },
  };
}

function touchAdapter(root: HTMLElement, viewport: () => Viewport): InputAdapter {
  const touch = createTouchInput(root, viewport);
  return {
    sample: (view) => touch.controller.sample(view),
    overlay: (view) => touch.controller.overlay(view),
    release: () => {
      touch.controller.releaseAll();
    },
    dispose: () => {
      touch.dispose();
    },
  };
}

interface PixelCanvas {
  readonly element: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly size: ImageSize;
}

function createCanvas(root: HTMLElement, className: string, size: ImageSize): PixelCanvas {
  const element = document.createElement('canvas');
  element.width = size.width;
  element.height = size.height;
  element.className = className;
  root.appendChild(element);
  const ctx = element.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas is not available');
  return { element, ctx, size };
}

function place(element: HTMLCanvasElement, viewport: Viewport): void {
  element.style.width = `${viewport.width}px`;
  element.style.height = `${viewport.height}px`;
  element.style.left = `${viewport.offsetX}px`;
  element.style.top = `${viewport.offsetY}px`;
}

function seedFromUrl(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? NaN : Number(value);
  return Number.isInteger(seed) ? seed : null;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}
