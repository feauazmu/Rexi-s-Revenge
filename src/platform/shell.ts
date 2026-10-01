import { createGame, SCREEN_HEIGHT, SCREEN_WIDTH, type GameEvent } from '../core';
import { canvasSurface, createRenderer } from '../render';
import { createCanvasBitmap } from './bitmaps';
import { createFixedStepper } from './fixed-step';
import { createKeyboardMouseInput } from './keyboard-mouse';
import { browserStorage } from './storage';
import { computeViewport, type Viewport } from './viewport';

export interface ShellOptions {
  /** Seed for the Run. Default: `?seed=` from the URL, else random. */
  readonly seed?: number;
  /** Receives each tick's events (audio and other reactive adapters plug in here). */
  readonly onEvents?: (events: readonly GameEvent[]) => void;
}

export interface Shell {
  stop(): void;
}

/**
 * Browser shell: creates the 480×270 canvas, scales it by the largest integer factor that fits
 * (letterboxed, no smoothing), and runs the fixed-timestep loop that feeds input frames to the
 * Game core and draws its view. It pauses the Run when the tab is hidden or loses focus.
 */
export function startShell(root: HTMLElement, options: ShellOptions = {}): Shell {
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  canvas.className = 'game-canvas';
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas is not available');

  let viewport: Viewport = computeViewport(1, 1);
  const layout = () => {
    viewport = computeViewport(root.clientWidth, root.clientHeight, window.devicePixelRatio);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.style.left = `${viewport.offsetX}px`;
    canvas.style.top = `${viewport.offsetY}px`;
  };
  layout();
  window.addEventListener('resize', layout);

  const game = createGame({
    seed: options.seed ?? seedFromUrl() ?? randomSeed(),
    device: 'desktop',
    storage: browserStorage(),
  });
  const input = createKeyboardMouseInput(root);
  const renderer = createRenderer(createCanvasBitmap);
  const surface = canvasSurface<HTMLCanvasElement>(ctx);
  const stepper = createFixedStepper();

  /** Draws the current view and exposes the screen to the page (smoke tests, debugging). */
  const present = () => {
    renderer.render(surface, game.view);
    root.dataset.screen = game.view.screen;
  };
  present();

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
    for (let i = 0; i < ticks; i++) {
      const events = game.tick(input.sample(viewport));
      if (events.length > 0) options.onEvents?.(events);
    }
    if (ticks > 0) present();
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', layout);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      input.dispose();
      canvas.remove();
    },
  };
}

function seedFromUrl(): number | null {
  const value = new URLSearchParams(window.location.search).get('seed');
  const seed = value === null ? NaN : Number(value);
  return Number.isInteger(seed) ? seed : null;
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
}
