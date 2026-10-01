import { secondsToTicks } from './constants';
import type { GameEvent } from './events';
import type { InputFrame } from './input';
import type { DeviceKind, GameOptions } from './options';
import { moveSelection, PAUSE_MENU_ITEMS, type PauseMenuItem } from './pause-menu';
import { loadPreferences, savePreference } from './preferences';
import { createRng } from './rng';
import { createRun, type Run } from './run/run';
import { memoryStorage, resilientStorage } from './storage';
import { resolveTuning, type Tuning } from './tuning';
import type { GameView, ScreenKind } from './view';

/**
 * The headless Game core. Advance it only with `tick`, once per fixed 1/60 s step, and draw
 * `view` after any tick. It owns the screen flow, the Run and all randomness.
 */
export interface Game {
  /** Advances the game exactly one fixed step and returns the events emitted during it. */
  tick(input: InputFrame): readonly GameEvent[];
  /**
   * Opens the pause menu if a Run is in progress; otherwise does nothing. Never unpauses.
   * The shell calls it when the tab is hidden or loses focus. Its events arrive with the
   * next tick.
   */
  pause(): void;
  /** Read-only snapshot of the current state, rebuilt lazily after each tick. */
  readonly view: GameView;
}

/**
 * Title and Cómo jugar ignore start inputs for this long after they appear, so the press that
 * opened a screen (or a hurried double press) does not skip the next one.
 */
const START_GUARD_TICKS = secondsToTicks(0.5);

export function createGame(options: GameOptions): Game {
  const tuning: Tuning = resolveTuning(options.overrides?.tuning);
  const rng = createRng(options.seed);
  const device: DeviceKind = options.device ?? 'desktop';
  const storage = resilientStorage(options.storage ?? memoryStorage());
  let { howToPlaySeen, musicMuted } = loadPreferences(storage);

  let lastId = 0;
  const nextId = (): number => ++lastId;

  let tickCount = 0;
  let screen: ScreenKind | null = null;
  let screenEnteredAt = 0;
  let run: Run | null = null;
  let menuSelected = 0;
  let cachedView: GameView | null = null;
  /** Events not yet returned. Events emitted between ticks (`pause`) go out with the next one. */
  let pending: GameEvent[] = [];
  const emit = (event: GameEvent): void => {
    pending.push(event);
  };
  /** Ticks completed on the current screen, not counting the tick that opened it. */
  const screenAge = (): number => Math.max(0, tickCount - screenEnteredAt);

  const changeScreen = (to: ScreenKind): void => {
    emit({ type: 'screen-changed', from: screen, to });
    screen = to;
    // Ticks run `tickCount` from n to n + 1; the screen is 0 ticks old once this one ends.
    screenEnteredAt = tickCount + 1;
    cachedView = null;
  };

  const startRun = (): void => {
    run = createRun({ tuning, rng, nextId, spawns: options.overrides?.spawns ?? null });
    changeScreen('run');
    emit({ type: 'run-started' });
  };

  const openPauseMenu = (): void => {
    menuSelected = 0;
    changeScreen('paused');
  };

  const startReady = (): boolean =>
    (screen === 'title' || screen === 'how-to-play') && screenAge() >= START_GUARD_TICKS;

  const choose = (item: PauseMenuItem): void => {
    switch (item) {
      case 'resume':
        changeScreen('run');
        return;
      case 'mute-music':
        musicMuted = !musicMuted;
        savePreference(storage, 'musicMuted', musicMuted);
        emit({ type: 'mute-toggled', muted: musicMuted });
        return;
      case 'quit':
        run = null;
        changeScreen('title');
        return;
    }
  };

  /** One tick of the current screen. Each tick runs exactly one screen's logic. */
  const stepScreen = (input: InputFrame): void => {
    switch (screen) {
      case null:
        changeScreen('title');
        return;
      case 'title':
        if (!input.start || !startReady()) return;
        if (howToPlaySeen) startRun();
        else changeScreen('how-to-play');
        return;
      case 'how-to-play':
        if (!input.start || !startReady()) return;
        howToPlaySeen = true;
        savePreference(storage, 'howToPlaySeen', true);
        startRun();
        return;
      case 'run':
        if (input.pause) openPauseMenu();
        else if (run) for (const event of run.step(input)) emit(event);
        return;
      case 'paused':
        if (input.pause || input.menu.back) {
          changeScreen('run');
          return;
        }
        // A fast "move, then confirm" can land in one tick: navigate first, then confirm.
        if (input.menu.up !== input.menu.down) {
          const step = input.menu.down ? 1 : -1;
          menuSelected = moveSelection(menuSelected, step, PAUSE_MENU_ITEMS.length);
        }
        if (input.menu.confirm) choose(PAUSE_MENU_ITEMS[menuSelected] ?? 'resume');
        return;
    }
  };

  return {
    tick(input) {
      stepScreen(input);
      tickCount += 1;
      cachedView = null;
      const events = pending;
      pending = [];
      return events;
    },

    pause() {
      if (screen === 'run') openPauseMenu();
    },

    get view() {
      cachedView ??= {
        tick: tickCount,
        device,
        screen: screen ?? 'title',
        screenAge: screenAge(),
        startReady: startReady(),
        run: run?.view() ?? null,
        pauseMenu: screen === 'paused' ? { items: PAUSE_MENU_ITEMS, selected: menuSelected } : null,
        musicMuted,
      };
      return cachedView;
    },
  };
}
