/**
 * Golden images of combat feedback: hit flash, explosions, debris and screen shake. Views come
 * from driving the real Game core with fixed seeds and scripted spawns.
 */
import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn, type TuningOverrides } from '../../src/core';
import { drive, eventsOf, runOf, type Driver } from '../support/driver';
import { holdStill } from '../support/fixtures';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const maletinTuning = defaultTuning.enemies['maletin-coptero'];
const maletin: ScriptedSpawn = { kind: 'maletin-coptero', x: 320, y: 70 };
const atMaletin = { x: 332, y: 79 };
const oneShotKills: TuningOverrides = holdStill({
  weapons: { 'mazo-automatico': { damage: maletinTuning.health } },
});

/** Fires one gavel at the Maletín-cóptero and advances to the tick it lands. */
function fireUntil(game: Driver, type: 'enemy-hit' | 'enemy-destroyed'): void {
  let events = game.ticks(1, { aim: atMaletin, fire: true });
  for (let t = 0; eventsOf(events, type).length === 0; t++) {
    if (t > 120) throw new Error(`No ${type} event`);
    events = game.ticks(1, { aim: atMaletin });
  }
}

describe('Combat feedback goldens', () => {
  it('effects-hit-flash: a hit Maletín-cóptero drawn as a white silhouette', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: holdStill() } });
    game.seconds(0.3, { aim: atMaletin });
    fireUntil(game, 'enemy-hit');
    expect(runOf(game.view).enemies[0]?.hitFlash).toBe(true);
    await expectGolden('effects-hit-flash', renderView(game.view));
  });

  it('effects-explosion: fireballs, smoke, sparks and debris mid-explosion', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: oneShotKills } });
    game.seconds(0.3, { aim: atMaletin });
    fireUntil(game, 'enemy-destroyed');
    game.ticks(6, { aim: atMaletin });
    await expectGolden('effects-explosion', renderView(game.view));
  });

  it('effects-debris-landed: chunks of the Maletín-cóptero resting on the plaza', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: oneShotKills } });
    game.seconds(0.3, { aim: atMaletin });
    fireUntil(game, 'enemy-destroyed');
    game.seconds(2, { aim: atMaletin });
    await expectGolden('effects-debris-landed', renderView(game.view));
  });

  it('effects-screen-shake: the world offset by a large explosion, crosshair fixed', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin],
        tuning: holdStill({
          ...oneShotKills,
          enemies: { 'maletin-coptero': { explosion: 'large' } },
        }),
      },
    });
    game.seconds(0.3, { aim: atMaletin });
    fireUntil(game, 'enemy-destroyed');
    game.ticks(4, { aim: atMaletin });
    const { shake } = runOf(game.view).effects;
    expect(Math.abs(shake.x) + Math.abs(shake.y)).toBeGreaterThanOrEqual(2);
    await expectGolden('effects-screen-shake', renderView(game.view));
  });
});
