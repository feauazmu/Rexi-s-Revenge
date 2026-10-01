/** The end of a Run: defeat beat, Veredicto, initials entry and the way back to the Title. */
import { describe, expect, it } from 'vitest';
import {
  HIGH_SCORE_LIMIT,
  memoryStorage,
  saveHighScores,
  type HighScoreEntry,
  type StoragePort,
  type VerdictView,
} from '../../src/core';
import { driveFromTitle, eventsOf, runOf, type Driver } from '../support/driver';
import { driveToRunEnd, playToRunEnd, type RunEndOptions } from '../support/run-end';

const throwingStorage = (): StoragePort => ({
  get: () => {
    throw new Error('SecurityError');
  },
  set: () => {
    throw new Error('SecurityError');
  },
});

const seeded = (entries: readonly HighScoreEntry[]): StoragePort => {
  const storage = memoryStorage();
  saveHighScores(storage, entries);
  return storage;
};

/** Ten entries scoring 10000, 9000, …, 1000. */
const strongTable = (): HighScoreEntry[] =>
  Array.from({ length: HIGH_SCORE_LIMIT }, (_, i) => ({
    initials: 'ZZZ',
    score: 10000 - i * 1000,
    enemiesDestroyed: 50,
    ticksSurvived: 36000,
  }));

/** Ticks one at a time until the screen is `screen`; returns how many ticks it took. */
function untilScreen(game: Driver, screen: string, maxTicks = 60 * 10): number {
  for (let tick = 1; tick <= maxTicks; tick++) {
    game.ticks(1);
    if (game.view.screen === screen) return tick;
  }
  throw new Error(`Never reached "${screen}" (still on "${game.view.screen}")`);
}

function verdictOf(game: Driver): VerdictView {
  const { verdict } = game.view;
  if (!verdict) throw new Error(`Expected the Veredicto, but the screen is "${game.view.screen}"`);
  return verdict;
}

/** A game on the Veredicto, past the moment it starts accepting input. */
function onVerdict(options: RunEndOptions = {}): Driver {
  const game = driveToRunEnd(options);
  untilScreen(game, 'verdict');
  game.seconds(2);
  return game;
}

/** Types `initials` with up/down/right presses and confirms each letter. */
function sign(game: Driver, initials: string) {
  const events = [];
  for (const char of initials) {
    const entry = verdictOf(game).initials;
    if (!entry) throw new Error('No initials entry');
    const current = entry.letters.charCodeAt(entry.cursor);
    const steps = char.charCodeAt(0) - current;
    for (let i = 0; i < Math.abs(steps); i++) {
      events.push(...game.ticks(1, { menu: steps > 0 ? { up: true } : { down: true } }));
    }
    events.push(...game.ticks(1, { menu: { confirm: true }, start: true }));
  }
  return events;
}

/** Waits until the screen accepts start, then presses it once. */
function pressStart(game: Driver) {
  for (let i = 0; i < 600 && !game.view.startReady; i++) game.ticks(1);
  expect(game.view.startReady).toBe(true);
  return game.ticks(1, { start: true });
}

describe('Defeat beat', () => {
  it('holds the defeated, frozen Run on screen for a moment before the Veredicto', () => {
    const game = driveToRunEnd();
    expect(game.view).toMatchObject({ screen: 'run', defeatAge: 0 });
    game.ticks(10);
    expect(game.view.defeatAge).toBe(10);

    const ticks = untilScreen(game, 'verdict') + 10;
    expect(ticks).toBeGreaterThanOrEqual(60);
    expect(ticks).toBeLessThanOrEqual(150);
    expect(eventsOf(game.log, 'screen-changed').at(-1)).toEqual({
      type: 'screen-changed',
      from: 'run',
      to: 'verdict',
    });
  });

  it('has no defeat age while the Run is going', () => {
    const game = driveFromTitle();
    game.ticks(1);
    expect(game.view.defeatAge).toBeNull();
  });
});

describe('Veredicto', () => {
  it('shows the score, demandas desestimadas and time survived of the Run', () => {
    const game = driveToRunEnd({ kills: 2 });
    const [ended] = eventsOf(game.log, 'run-ended');
    expect(ended?.enemiesDestroyed).toBe(2);
    untilScreen(game, 'verdict');
    expect(verdictOf(game).stats).toEqual({
      score: ended?.score,
      enemiesDestroyed: ended?.enemiesDestroyed,
      ticksSurvived: ended?.ticksSurvived,
    });
  });

  it('keeps the frozen, ended Run as its backdrop', () => {
    const game = driveToRunEnd();
    const atEnd = runOf(game.view);
    untilScreen(game, 'verdict');
    game.seconds(3, { move: 1, fire: true });
    expect(runOf(game.view)).toEqual(atEnd);
  });

  it('cannot be paused', () => {
    const game = onVerdict();
    game.ticks(1, { pause: true });
    game.pause();
    game.ticks(1);
    expect(game.view.screen).toBe('verdict');
  });

  describe('without a high score', () => {
    it('asks for no initials and records nothing', () => {
      const storage = seeded(strongTable());
      const game = onVerdict({ kills: 1, storage });
      expect(verdictOf(game)).toMatchObject({ rank: null, initials: null, recorded: false });
      expect(game.view.highScores).toEqual(strongTable());
    });

    it('never records a Run that scored nothing', () => {
      expect(verdictOf(onVerdict({ kills: 0 })).rank).toBeNull();
    });

    it('returns to the Title on start, and the next Run starts fresh', () => {
      const game = onVerdict();
      const events = pressStart(game);
      expect(events).toEqual([{ type: 'screen-changed', from: 'verdict', to: 'title' }]);
      expect(game.view).toMatchObject({ screen: 'title', run: null, verdict: null });

      expect(pressStart(game)).toContainEqual({ type: 'run-started' });
      expect(runOf(game.view)).toMatchObject({ tick: 0, ended: false, stats: { score: 0 } });
    });

    it('ignores start while the verdict is being read out, so a held trigger does not skip it', () => {
      const game = driveToRunEnd();
      untilScreen(game, 'verdict');
      expect(game.view.startReady).toBe(false);
      game.seconds(0.5, { start: true, fire: true });
      expect(game.view.screen).toBe('verdict');
    });
  });

  describe('with a high score', () => {
    it('gives the place earned and opens the initials entry on the first letter', () => {
      const game = onVerdict({ kills: 1 });
      expect(verdictOf(game)).toMatchObject({
        rank: 1,
        initials: { letters: 'AAA', cursor: 0 },
        recorded: false,
      });
      expect(game.view.startReady).toBe(false);
    });

    it('ranks the Run against the stored table', () => {
      const storage = seeded(strongTable().slice(0, 4));
      expect(verdictOf(onVerdict({ kills: 1, storage })).rank).toBe(5);
    });

    it('changes the letter with up and down, wrapping around the alphabet', () => {
      const game = onVerdict({ kills: 1 });
      const letters = () => verdictOf(game).initials?.letters;
      game.ticks(1, { menu: { up: true } });
      expect(letters()).toBe('BAA');
      game.ticks(1, { menu: { down: true } });
      game.ticks(1, { menu: { down: true } });
      expect(letters()).toBe('ZAA');
      game.ticks(1, { menu: { up: true } });
      expect(letters()).toBe('AAA');
    });

    it('moves between letters with left and right, stopping at both ends', () => {
      const game = onVerdict({ kills: 1 });
      const cursor = () => verdictOf(game).initials?.cursor;
      game.ticks(1, { menu: { left: true } });
      expect(cursor()).toBe(0);
      game.ticks(1, { menu: { right: true } });
      game.ticks(1, { menu: { up: true } });
      expect(verdictOf(game).initials).toEqual({ letters: 'ABA', cursor: 1 });
      game.ticks(3, { menu: { right: true } });
      expect(cursor()).toBe(2);
      game.ticks(1, { menu: { back: true } });
      expect(cursor()).toBe(1);
    });

    it('reports every letter change and cursor move as a menu move (for its tick sound)', () => {
      const game = onVerdict({ kills: 1 });
      const moved = () => eventsOf(game.ticks(1, { menu: { left: true } }), 'menu-moved');
      expect(moved()).toEqual([]); // already on the first letter: nothing moved
      expect(eventsOf(game.ticks(1, { menu: { up: true } }), 'menu-moved')).toEqual([
        { type: 'menu-moved', selected: 0 },
      ]);
      expect(eventsOf(game.ticks(1, { menu: { right: true } }), 'menu-moved')).toEqual([
        { type: 'menu-moved', selected: 1 },
      ]);
    });

    it('confirm moves to the next letter, and on the last one records the entry', () => {
      const storage = memoryStorage();
      const game = onVerdict({ kills: 3, storage });
      const { stats } = verdictOf(game);
      const events = sign(game, 'REX');

      expect(eventsOf(events, 'high-score-recorded')).toEqual([
        { type: 'high-score-recorded', initials: 'REX', score: stats.score, rank: 1 },
      ]);
      expect(verdictOf(game)).toMatchObject({
        recorded: true,
        initials: { letters: 'REX' },
        rank: 1,
      });
      expect(game.view.highScores).toEqual([{ initials: 'REX', ...stats }]);
      expect(game.view.screen).toBe('verdict');
    });

    it('ignores letter input before the verdict accepts input and after signing', () => {
      const game = driveToRunEnd({ kills: 1 });
      untilScreen(game, 'verdict');
      game.ticks(1, { menu: { up: true } });
      expect(verdictOf(game).initials?.letters).toBe('AAA');

      game.seconds(2);
      sign(game, 'BOB');
      game.ticks(1, { menu: { up: true } });
      game.ticks(1, { menu: { confirm: true } });
      expect(verdictOf(game).initials?.letters).toBe('BOB');
      expect(eventsOf(game.log, 'high-score-recorded')).toHaveLength(1);
    });

    it('waits a moment after signing before start returns to the Title', () => {
      const game = onVerdict({ kills: 1 });
      sign(game, 'AAA');
      expect(game.view.startReady).toBe(false);
      game.ticks(1, { start: true });
      expect(game.view.screen).toBe('verdict');
      expect(pressStart(game)).toEqual([{ type: 'screen-changed', from: 'verdict', to: 'title' }]);
      expect(game.view.highScores).toHaveLength(1);
    });

    it('does not return to the Title before the initials are signed', () => {
      const game = onVerdict({ kills: 1 });
      game.seconds(5, { start: true });
      expect(game.view.screen).toBe('verdict');
    });

    it('persists the table: a later session shows it on the Title', () => {
      const storage = memoryStorage();
      sign(onVerdict({ kills: 2, storage }), 'FIL');
      const later = driveFromTitle({ storage });
      later.ticks(1);
      expect(later.view.screen).toBe('title');
      expect(later.view.highScores.map((e) => e.initials)).toEqual(['FIL']);
    });

    it('starts the next entry from the initials signed last in this session', () => {
      const storage = memoryStorage();
      const game = onVerdict({ kills: 1, storage });
      sign(game, 'JUZ');
      pressStart(game);
      pressStart(game);
      expect(game.view.screen).toBe('run');
      playToRunEnd(game, 1);
      untilScreen(game, 'verdict');
      expect(verdictOf(game).initials?.letters).toBe('JUZ');
      // A fresh session with the same storage starts again from AAA.
      expect(verdictOf(onVerdict({ kills: 1, storage })).initials?.letters).toBe('AAA');
    });

    it('keeps the entry for the session when storage throws', () => {
      const game = onVerdict({ kills: 1, storage: throwingStorage() });
      sign(game, 'TOP');
      expect(game.view.highScores.map((e) => e.initials)).toEqual(['TOP']);
      pressStart(game);
      expect(game.view.highScores.map((e) => e.initials)).toEqual(['TOP']);
    });
  });
});

describe('Title high scores', () => {
  it('shows the stored top 10 from the first tick', () => {
    const game = driveFromTitle({ storage: seeded(strongTable()) });
    game.ticks(1);
    expect(game.view.highScores).toEqual(strongTable());
  });

  it('shows an empty table when the stored one is unreadable', () => {
    const game = driveFromTitle({ storage: throwingStorage() });
    game.ticks(1);
    expect(game.view.highScores).toEqual([]);
  });
});
