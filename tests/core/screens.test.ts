import { describe, expect, it } from 'vitest';
import { memoryStorage, PAUSE_MENU_ITEMS, type StoragePort } from '../../src/core';
import { drive, driveFromTitle, eventsOf, runOf, type Driver } from '../support/driver';

/** Storage that throws on every access, like a browser that blocks storage outright. */
const throwingStorage = (): StoragePort => ({
  get: () => {
    throw new Error('SecurityError: storage is blocked');
  },
  set: () => {
    throw new Error('SecurityError: storage is blocked');
  },
});

/** Waits until the current screen accepts a start input, then presses start once. */
function pressStart(game: Driver) {
  for (let i = 0; i < 600 && !game.view.startReady; i++) game.ticks(1);
  expect(game.view.startReady).toBe(true);
  return game.ticks(1, { start: true });
}

/** Opens the pause menu, selects `item` and confirms it. */
function choose(game: Driver, item: (typeof PAUSE_MENU_ITEMS)[number]) {
  if (game.view.screen === 'run') game.ticks(1, { pause: true });
  const menu = game.view.pauseMenu;
  if (!menu) throw new Error(`Expected the pause menu, screen is "${game.view.screen}"`);
  const steps = (PAUSE_MENU_ITEMS.indexOf(item) - menu.selected + menu.items.length) % 3;
  for (let i = 0; i < steps; i++) game.ticks(1, { menu: { down: true } });
  return game.ticks(1, { menu: { confirm: true } });
}

describe('Title screen', () => {
  it('is the first screen, without a Run', () => {
    const game = driveFromTitle();
    const events = game.ticks(1);
    expect(events).toContainEqual({ type: 'screen-changed', from: null, to: 'title' });
    expect(game.view.screen).toBe('title');
    expect(game.view.run).toBeNull();
    expect(game.view.pauseMenu).toBeNull();
  });

  it('waits for a start input', () => {
    const game = driveFromTitle();
    game.seconds(5, { move: 1, fire: true, pause: true, menu: { confirm: true } });
    expect(game.view.screen).toBe('title');
  });

  it('counts how long the current screen has been shown', () => {
    const game = driveFromTitle();
    game.ticks(11); // the Title appears on the first tick
    expect(game.view.screenAge).toBe(10);
    pressStart(game);
    expect(game.view.screenAge).toBe(0);
  });
});

describe('Cómo jugar', () => {
  it('is shown after the Title before the first Run ever, then starts the Run', () => {
    const game = driveFromTitle();
    pressStart(game);
    expect(eventsOf(game.log, 'screen-changed')).toEqual([
      { type: 'screen-changed', from: null, to: 'title' },
      { type: 'screen-changed', from: 'title', to: 'how-to-play' },
    ]);
    expect(game.view.run).toBeNull();

    const events = pressStart(game);
    expect(events).toEqual([
      { type: 'screen-changed', from: 'how-to-play', to: 'run' },
      { type: 'run-started' },
    ]);
    expect(game.view.screen).toBe('run');
    expect(runOf(game.view).tick).toBe(0);
  });

  it('ignores start for a moment so a double press does not skip it', () => {
    const game = driveFromTitle();
    pressStart(game);
    expect(game.view.startReady).toBe(false);
    game.ticks(1, { start: true });
    expect(game.view.screen).toBe('how-to-play');
  });

  it('is skipped once it has been seen, across sessions sharing the storage', () => {
    const storage = memoryStorage();
    const first = driveFromTitle({ storage });
    pressStart(first);
    pressStart(first);
    expect(first.view.screen).toBe('run');

    const second = driveFromTitle({ storage });
    const events = pressStart(second);
    expect(eventsOf(events, 'screen-changed').at(-1)).toEqual({
      type: 'screen-changed',
      from: 'title',
      to: 'run',
    });
    expect(second.view.screen).toBe('run');
  });

  it('is not marked as seen if the player never got past it', () => {
    const storage = memoryStorage();
    const first = driveFromTitle({ storage });
    pressStart(first);
    first.seconds(3);

    const second = driveFromTitle({ storage });
    pressStart(second);
    expect(second.view.screen).toBe('how-to-play');
  });

  it('is skipped on later Runs of the same session', () => {
    const game = driveFromTitle();
    pressStart(game);
    pressStart(game);
    choose(game, 'quit');
    expect(game.view.screen).toBe('title');
    pressStart(game);
    expect(game.view.screen).toBe('run');
  });

  it('still works when storage throws, remembering the flag in memory', () => {
    const game = driveFromTitle({ storage: throwingStorage() });
    pressStart(game);
    expect(game.view.screen).toBe('how-to-play');
    pressStart(game);
    expect(game.view.screen).toBe('run');
    choose(game, 'mute-music');
    expect(game.view.musicMuted).toBe(true);
    choose(game, 'quit');
    pressStart(game);
    expect(game.view.screen).toBe('run');
  });

  it('follows the device kind it was created with', () => {
    const game = driveFromTitle({ device: 'touch' });
    pressStart(game);
    expect(game.view).toMatchObject({ screen: 'how-to-play', device: 'touch' });
  });
});

describe('Pause', () => {
  const staged = () =>
    drive({ overrides: { spawns: [{ kind: 'maletin-coptero', x: 300, y: 60 }] } });

  it('opens the pause menu on Continuar', () => {
    const game = staged();
    game.seconds(1);
    const events = game.ticks(1, { pause: true });
    expect(events).toEqual([{ type: 'screen-changed', from: 'run', to: 'paused' }]);
    expect(game.view.pauseMenu).toEqual({ items: PAUSE_MENU_ITEMS, selected: 0 });
    expect(PAUSE_MENU_ITEMS).toEqual(['resume', 'mute-music', 'quit']);
  });

  it('freezes the Run simulation entirely while the menu is open', () => {
    const game = staged();
    game.seconds(1, { move: 1 });
    game.ticks(1, { pause: true });
    const frozen = runOf(game.view);

    const events = game.seconds(10, { move: -1, jump: true, fire: true, aim: { x: 300, y: 60 } });
    expect(events).toEqual([]);
    expect(runOf(game.view)).toEqual(frozen);
    expect(game.view.screen).toBe('paused');
  });

  it('keeps the animation clock running for the menu', () => {
    const game = staged();
    game.ticks(1, { pause: true });
    const before = game.view.tick;
    game.ticks(30);
    expect(game.view.tick).toBe(before + 30);
  });

  it.each([
    ['Continuar', { menu: { confirm: true } }],
    ['the pause key', { pause: true }],
    ['back', { menu: { back: true } }],
  ] as const)('resumes the Run with %s', (_, input) => {
    const game = staged();
    game.seconds(1);
    game.ticks(1, { pause: true });
    const tickAtPause = runOf(game.view).tick;

    expect(game.ticks(1, input)).toEqual([{ type: 'screen-changed', from: 'paused', to: 'run' }]);
    expect(game.view.pauseMenu).toBeNull();
    game.ticks(10);
    expect(runOf(game.view).tick).toBe(tickAtPause + 10);
  });

  it('moves the selection up and down, wrapping around', () => {
    const game = staged();
    game.ticks(1, { pause: true });
    const selected = () => game.view.pauseMenu?.selected;
    game.ticks(1, { menu: { down: true } });
    expect(selected()).toBe(1);
    game.ticks(1, { menu: { down: true } });
    game.ticks(1, { menu: { down: true } });
    expect(selected()).toBe(0);
    game.ticks(1, { menu: { up: true } });
    expect(selected()).toBe(2);
  });

  it('emits menu-moved when the selection moves (for the navigation sound)', () => {
    const game = staged();
    game.ticks(1, { pause: true });
    expect(game.ticks(1, { menu: { down: true } })).toEqual([{ type: 'menu-moved', selected: 1 }]);
    expect(game.ticks(1, { menu: { up: true } })).toEqual([{ type: 'menu-moved', selected: 0 }]);
    expect(eventsOf(game.ticks(1, { menu: { up: true, down: true } }), 'menu-moved')).toEqual([]);
  });

  it('applies a move and a confirm that land in the same tick in that order', () => {
    const game = staged();
    game.ticks(1, { pause: true });
    game.ticks(1, { menu: { up: true, confirm: true } });
    expect(game.view.screen).toBe('title');
  });

  it('opens on Continuar every time', () => {
    const game = staged();
    game.ticks(1, { pause: true });
    game.ticks(1, { menu: { down: true } });
    game.ticks(1, { pause: true });
    game.ticks(1, { pause: true });
    expect(game.view.pauseMenu?.selected).toBe(0);
  });

  it('Salir ends the Run and returns to the Title', () => {
    const game = staged();
    game.seconds(1);
    const events = choose(game, 'quit');
    expect(events).toEqual([{ type: 'screen-changed', from: 'paused', to: 'title' }]);
    expect(game.view.screen).toBe('title');
    expect(game.view.run).toBeNull();
  });

  it('a new Run after Salir starts fresh', () => {
    const game = staged();
    game.seconds(2, { move: 1 });
    choose(game, 'quit');
    const events = pressStart(game);
    expect(events).toContainEqual({ type: 'run-started' });
    expect(runOf(game.view).tick).toBe(0);
  });

  it('cannot be opened outside a Run', () => {
    const game = driveFromTitle();
    game.ticks(1, { pause: true });
    expect(game.view.screen).toBe('title');
  });
});

describe('Auto-pause', () => {
  it('pauses a Run in progress when the platform asks (tab hidden, focus lost)', () => {
    const game = drive();
    game.seconds(1);
    game.pause();
    expect(game.view.screen).toBe('paused');
    const tick = runOf(game.view).tick;
    expect(game.ticks(1)).toEqual([{ type: 'screen-changed', from: 'run', to: 'paused' }]);
    game.seconds(2);
    expect(runOf(game.view).tick).toBe(tick);
  });

  it('is idempotent and never unpauses', () => {
    const game = drive();
    game.pause();
    game.pause();
    game.ticks(1);
    game.pause();
    expect(eventsOf(game.ticks(1), 'screen-changed')).toEqual([]);
    expect(game.view.screen).toBe('paused');
  });

  it('does nothing outside a Run', () => {
    const game = driveFromTitle();
    game.ticks(1);
    game.pause();
    expect(game.ticks(1)).toEqual([]);
    expect(game.view.screen).toBe('title');
  });
});

describe('Silenciar música', () => {
  it('toggles the mute flag, emits an event and keeps the menu open', () => {
    const game = drive();
    expect(game.view.musicMuted).toBe(false);

    expect(choose(game, 'mute-music')).toEqual([{ type: 'mute-toggled', muted: true }]);
    expect(game.view.musicMuted).toBe(true);
    expect(game.view.screen).toBe('paused');
    expect(game.view.pauseMenu?.selected).toBe(1);

    expect(game.ticks(1, { menu: { confirm: true } })).toEqual([
      { type: 'mute-toggled', muted: false },
    ]);
    expect(game.view.musicMuted).toBe(false);
  });

  it('is remembered across sessions', () => {
    const storage = memoryStorage();
    choose(drive({ storage }), 'mute-music');
    expect(driveFromTitle({ storage }).view.musicMuted).toBe(true);
  });

  it('defaults to music on when the stored value is unreadable', () => {
    const game = driveFromTitle({ storage: throwingStorage() });
    expect(game.view.musicMuted).toBe(false);
  });
});

describe('Start input during a Run', () => {
  it('does not change the screen', () => {
    const game = drive();
    game.seconds(1, { start: true });
    expect(game.view.screen).toBe('run');
  });
});
