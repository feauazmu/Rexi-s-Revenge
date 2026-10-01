/**
 * Golden images of the Dialogue Box, driven through the real Game core: a Quip triggered by
 * destroying a Maletín-cóptero, caught mid-typewriter and fully revealed.
 */
import { describe, expect, it } from 'vitest';
import { DIALOGUE_TEXT_WIDTH, fonts } from '../../src/render';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const AIM = { x: 312, y: 159 };

/** A Run where the first shot destroys a Maletín-cóptero and Rexi always talks. */
function talkingGame(seed: number): Driver {
  const game = drive({
    seed,
    overrides: {
      spawns: [{ kind: 'maletin-coptero', x: 300, y: 150 }],
      tuning: { quips: { chance: 1 }, enemies: { 'maletin-coptero': { health: 1 } } },
    },
  });
  for (let i = 0; i < 120; i++) {
    if (eventsOf(game.ticks(1, { aim: AIM, fire: true }), 'quip-started').length > 0) return game;
  }
  throw new Error('No Quip started');
}

describe('Dialogue Box goldens', () => {
  it('dialogue-typing: portrait, name and a Quip halfway through the typewriter', async () => {
    const game = talkingGame(5);
    game.seconds(1, { aim: AIM });
    const dialogue = runOf(game.view).dialogue;
    expect(dialogue?.complete).toBe(false);
    expect(dialogue?.revealed).toBeGreaterThan(10);
    await expectGolden('dialogue-typing', renderView(game.view));
  });

  it('dialogue-complete: the whole Quip on two lines with the blinking cursor', async () => {
    const game = talkingGame(12);
    while (runOf(game.view).dialogue?.complete !== true) game.ticks(1, { aim: AIM });
    // Wait until the cursor's blink is in its visible half.
    while (Math.floor((runOf(game.view).dialogue?.age ?? 0) / 16) % 2 !== 0) {
      game.ticks(1, { aim: AIM });
    }
    const dialogue = runOf(game.view).dialogue;
    expect(dialogue?.openness).toBe(1);
    expect(fonts.regular.wrap(dialogue?.text ?? '', DIALOGUE_TEXT_WIDTH)).toHaveLength(2);
    await expectGolden('dialogue-complete', renderView(game.view));
  });
});
