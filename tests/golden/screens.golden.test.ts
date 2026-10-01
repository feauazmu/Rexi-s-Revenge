/**
 * Golden images of the menu screens: Title (empty and with a top 10), Cómo jugar (desktop and
 * touch), the pause menu, the defeat beat and the Veredicto.
 * Views come from driving the real Game core; frames are picked where the prompts are visible.
 */
import { describe, expect, it } from 'vitest';
import { memoryStorage, saveHighScores, type DeviceKind } from '../../src/core';
import { drive, driveFromTitle, type Driver } from '../support/driver';
import { driveToRunEnd } from '../support/run-end';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

/** Advances until the screen accepts start, then to the start of a blink-on phase. */
function untilPromptShows(game: Driver): void {
  while (!game.view.startReady) game.ticks(1);
  while (game.view.tick % 60 !== 0) game.ticks(1);
  game.ticks(5);
}

function howToPlay(device: DeviceKind): Driver {
  const game = driveFromTitle({ device });
  untilPromptShows(game);
  game.ticks(1, { start: true });
  untilPromptShows(game);
  expect(game.view.screen).toBe('how-to-play');
  return game;
}

describe('Screen goldens', () => {
  it('title: logo, empty top 10, start prompt and credits over the code-drawn backdrop', async () => {
    const game = driveFromTitle();
    untilPromptShows(game);
    expect(game.view.screen).toBe('title');
    await expectGolden('title', renderView(game.view));
  });

  it('how-to-play-desktop: keyboard and mouse controls', async () => {
    await expectGolden('how-to-play-desktop', renderView(howToPlay('desktop').view));
  });

  it('how-to-play-touch: on-screen controls', async () => {
    await expectGolden('how-to-play-touch', renderView(howToPlay('touch').view));
  });

  it('pause-menu: music muted, Silenciar música selected, over the frozen Run', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [{ kind: 'maletin-coptero', x: 320, y: 70 }] },
    });
    game.seconds(0.5, { aim: { x: 332, y: 79 } });
    game.ticks(1, { pause: true });
    game.ticks(1, { menu: { down: true } });
    game.ticks(1, { menu: { confirm: true } });
    while (game.view.tick % 60 !== 5) game.ticks(1);
    expect(game.view.musicMuted).toBe(true);
    await expectGolden('pause-menu', renderView(game.view));
  });

  it('title-high-scores: a full top 10 next to the logo', async () => {
    const storage = memoryStorage();
    const names = ['REX', 'FIL', 'JUZ', 'MAR', 'LEN', 'GYM', 'ABC', 'PIE', 'SOS', 'ZZZ'];
    saveHighScores(
      storage,
      names.map((initials, i) => ({
        initials,
        score: [128450, 96300, 74100, 52000, 41250, 30900, 18400, 9600, 2500, 100][i] ?? 0,
        enemiesDestroyed: 40 - i * 4,
        ticksSurvived: 60 * (600 - i * 50),
      })),
    );
    const game = driveFromTitle({ storage });
    untilPromptShows(game);
    expect(game.view.highScores).toHaveLength(10);
    await expectGolden('title-high-scores', renderView(game.view));
  });

  it('defeat-beat: the frozen, dimming Run with the adjournment banner', async () => {
    const game = driveToRunEnd({ kills: 1 });
    game.ticks(45);
    expect(game.view.defeatAge).toBe(45);
    await expectGolden('defeat-beat', renderView(game.view));
  });

  it('verdict-initials: a new record, signing the second letter', async () => {
    const game = driveToRunEnd({ kills: 3 });
    while (game.view.screen !== 'verdict') game.ticks(1);
    game.seconds(2);
    for (let i = 0; i < 17; i++) game.ticks(1, { menu: { up: true } }); // R
    game.ticks(1, { menu: { confirm: true } });
    for (let i = 0; i < 4; i++) game.ticks(1, { menu: { up: true } }); // E
    while (game.view.tick % 60 !== 5) game.ticks(1);
    expect(game.view.verdict).toMatchObject({ rank: 1, initials: { letters: 'REA', cursor: 1 } });
    await expectGolden('verdict-initials', renderView(game.view));
  });

  it('verdict-signed: initials signed, waiting for a key', async () => {
    const game = driveToRunEnd({ kills: 2 });
    while (game.view.screen !== 'verdict') game.ticks(1);
    game.seconds(2);
    for (const ups of [17, 4, 23]) {
      for (let i = 0; i < ups; i++) game.ticks(1, { menu: { up: true } });
      game.ticks(1, { menu: { confirm: true } });
    }
    untilPromptShows(game);
    expect(game.view.verdict).toMatchObject({ recorded: true, initials: { letters: 'REX' } });
    await expectGolden('verdict-signed', renderView(game.view));
  });

  it('verdict-closed: no top-10 score, the record to beat, waiting for a key', async () => {
    const storage = memoryStorage();
    const record = { initials: 'REX', score: 128450, enemiesDestroyed: 300, ticksSurvived: 36000 };
    saveHighScores(storage, [record]);
    const game = driveToRunEnd({ kills: 0, storage });
    while (game.view.screen !== 'verdict') game.ticks(1);
    untilPromptShows(game);
    expect(game.view.verdict).toMatchObject({ rank: null });
    await expectGolden('verdict-closed', renderView(game.view));
  });
});
