import type { GameEvent } from './events';
import type { InputFrame } from './input';
import type { DeviceKind, GameOptions } from './options';
import { createRng, deriveSeed } from './rng';
import { createRun, type Run } from './run/run';
import { resolveTuning, type Tuning } from './tuning';
import type { GameView, ScreenKind } from './view';

/** Stream id of the effects' random generator (any constant distinct from other streams). */
const EFFECTS_STREAM = 0xeff3c7;

/**
 * The headless Game core. Advance it only with `tick`, once per fixed 1/60 s step, and draw
 * `view` after any tick. It owns the screen flow, the Run and all randomness.
 */
export interface Game {
  /** Advances the game exactly one fixed step and returns the events emitted during it. */
  tick(input: InputFrame): readonly GameEvent[];
  /** Read-only snapshot of the current state, rebuilt lazily after each tick. */
  readonly view: GameView;
}

export function createGame(options: GameOptions): Game {
  const tuning: Tuning = resolveTuning(options.overrides?.tuning);
  const rng = createRng(options.seed);
  /** Cosmetic effects draw from their own stream so they can never shift gameplay. */
  const effectsSeed = deriveSeed(options.seed, EFFECTS_STREAM);
  const device: DeviceKind = options.device ?? 'desktop';
  // `options.storage` (default: memoryStorage()) is read once persistence (high scores,
  // "Cómo jugar" seen, mute) lands with the screen-flow and Veredicto tickets.

  let lastId = 0;
  const nextId = (): number => ++lastId;

  let tickCount = 0;
  let screen: ScreenKind | null = null;
  let run: Run | null = null;
  let cachedView: GameView | null = null;
  /** Events produced outside `tick` (e.g. at creation), delivered with the next tick. */
  let queued: GameEvent[] = [];

  const changeScreen = (to: ScreenKind): void => {
    queued.push({ type: 'screen-changed', from: screen, to });
    screen = to;
  };

  const startRun = (): void => {
    run = createRun({
      tuning,
      rng,
      effectsSeed,
      nextId,
      spawns: options.overrides?.spawns ?? null,
    });
    changeScreen('run');
    queued.push({ type: 'run-started' });
  };

  // The Title screen arrives with the screen-flow ticket; until then the game opens in a Run.
  startRun();

  return {
    tick(input) {
      const events = queued;
      queued = [];
      if (screen === 'run' && run) events.push(...run.step(input));
      tickCount += 1;
      cachedView = null;
      return events;
    },

    get view() {
      cachedView ??= {
        tick: tickCount,
        device,
        screen: screen ?? 'run',
        run: run?.view() ?? null,
      };
      return cachedView;
    },
  };
}
