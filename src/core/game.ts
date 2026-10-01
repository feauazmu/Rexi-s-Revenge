import { secondsToTicks } from './constants';
import type { GameEvent } from './events';
import type { InputFrame } from './input';
import type { DeviceKind, GameOptions } from './options';
import {
  highScoreRank,
  INITIALS_ALPHABET,
  INITIALS_LENGTH,
  insertHighScore,
  loadHighScores,
  saveHighScores,
} from './high-scores';
import { moveSelection, PAUSE_MENU_ITEMS, type PauseMenuItem } from './pause-menu';
import { loadPreferences, savePreference } from './preferences';
import { createRng, deriveSeed } from './rng';
import { createRun, type Run } from './run/run';
import { memoryStorage, resilientStorage } from './storage';
import { resolveTuning, type Tuning } from './tuning';
import { createVerdict, type Verdict } from './verdict';
import type { GameView, ScreenKind } from './view';

/** Stream id of the effects' random generator (any constant distinct from other streams). */
const EFFECTS_STREAM = 0xeff3c7;

/** The defeat beat: how long the ended Run stays on screen before the Veredicto, seconds. */
const DEFEAT_BEAT = 1.5;

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
/**
 * The Veredicto ignores input while its stats are read out, so a trigger still held or mashed
 * from the Run does not skip it or type initials.
 */
const VERDICT_GUARD_TICKS = secondsToTicks(1);

/** Mixed into the seed for the Quip random stream (independent of gameplay randomness). */
const QUIP_STREAM = 0x51e7c0de;

export function createGame(options: GameOptions): Game {
  const tuning: Tuning = resolveTuning(options.overrides?.tuning);
  const rng = createRng(options.seed);
  /** Cosmetic effects draw from their own stream so they can never shift gameplay. */
  const effectsSeed = deriveSeed(options.seed, EFFECTS_STREAM);
  /** Quips draw from their own stream so they can never shift gameplay. */
  const quipRng = createRng(options.seed ^ QUIP_STREAM);
  const device: DeviceKind = options.device ?? 'desktop';
  const storage = resilientStorage(options.storage ?? memoryStorage());
  let { howToPlaySeen, musicMuted } = loadPreferences(storage);
  let highScores = loadHighScores(storage);
  /** A new entry starts from the initials signed last in this session. */
  let lastInitials = INITIALS_ALPHABET.charAt(0).repeat(INITIALS_LENGTH);

  let lastId = 0;
  const nextId = (): number => ++lastId;

  let tickCount = 0;
  let screen: ScreenKind | null = null;
  let screenEnteredAt = 0;
  let run: Run | null = null;
  /** Ticks the current Run has been over (the defeat beat, see DEFEAT_BEAT). */
  let endedTicks = 0;
  let verdict: Verdict | null = null;
  /** Tick count when the initials were signed (start is guarded after it), or null. */
  let signedAt: number | null = null;
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
    run = createRun({
      tuning,
      rng,
      effectsSeed,
      quipRng,
      nextId,
      spawns: options.overrides?.spawns ?? null,
    });
    endedTicks = 0;
    changeScreen('run');
    emit({ type: 'run-started' });
  };

  const openPauseMenu = (): void => {
    menuSelected = 0;
    changeScreen('paused');
  };

  const openVerdict = (): void => {
    if (!run) return;
    const { stats } = run.view();
    verdict = createVerdict(stats, highScoreRank(highScores, stats.score), lastInitials);
    signedAt = null;
    changeScreen('verdict');
  };

  const leaveVerdict = (): void => {
    run = null;
    verdict = null;
    changeScreen('title');
  };

  const verdictReady = (): boolean => screen === 'verdict' && screenAge() >= VERDICT_GUARD_TICKS;

  const startReady = (): boolean => {
    if (screen === 'title' || screen === 'how-to-play') return screenAge() >= START_GUARD_TICKS;
    if (!verdictReady() || verdict?.signing !== false) return false;
    return signedAt === null || tickCount - signedAt >= START_GUARD_TICKS;
  };

  const stepVerdict = (input: InputFrame): void => {
    if (!verdict || !verdictReady()) return;
    if (!verdict.signing) {
      if (input.start && startReady()) leaveVerdict();
      return;
    }
    const before = verdict.view().initials;
    const entry = verdict.input(input.menu);
    // Only a Run with a rank signs, so `rank` is set whenever an entry comes back.
    const { rank, initials } = verdict.view();
    if (
      !entry &&
      initials &&
      (initials.letters !== before?.letters || initials.cursor !== before.cursor)
    ) {
      emit({ type: 'menu-moved', selected: initials.cursor });
    }
    if (!entry || rank === null) return;
    highScores = insertHighScore(highScores, entry);
    saveHighScores(storage, highScores);
    lastInitials = entry.initials;
    signedAt = tickCount;
    emit({ type: 'high-score-recorded', initials: entry.initials, score: entry.score, rank });
  };

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
        if (run?.ended) {
          if (++endedTicks >= secondsToTicks(DEFEAT_BEAT)) openVerdict();
        } else if (input.pause) openPauseMenu();
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
          emit({ type: 'menu-moved', selected: menuSelected });
        }
        if (input.menu.confirm) choose(PAUSE_MENU_ITEMS[menuSelected] ?? 'resume');
        return;
      case 'verdict':
        stepVerdict(input);
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
      if (screen === 'run' && !run?.ended) openPauseMenu();
    },

    get view() {
      cachedView ??= {
        tick: tickCount,
        device,
        screen: screen ?? 'title',
        screenAge: screenAge(),
        startReady: startReady(),
        run: run?.view() ?? null,
        defeatAge: screen === 'run' && run?.ended ? endedTicks : null,
        verdict: screen === 'verdict' ? (verdict?.view() ?? null) : null,
        highScores,
        pauseMenu: screen === 'paused' ? { items: PAUSE_MENU_ITEMS, selected: menuSelected } : null,
        musicMuted,
      };
      return cachedView;
    },
  };
}
