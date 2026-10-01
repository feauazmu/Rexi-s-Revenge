/**
 * Golden images of the menu screens: Title, Cómo jugar (desktop and touch) and the pause menu.
 * Views come from driving the real Game core; frames are picked where the prompts are visible.
 */
import { describe, expect, it } from 'vitest';
import type { DeviceKind } from '../../src/core';
import { drive, driveFromTitle, type Driver } from '../support/driver';
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
  it('title: logo, start prompt and credits over the code-drawn backdrop', async () => {
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
});
