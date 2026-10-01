/**
 * Golden images of the Run. Views come from driving the real Game core with fixed seeds and
 * scripted spawns, never from hand-built view objects.
 */
import { describe, expect, it } from 'vitest';
import type { ScriptedSpawn } from '../../src/core';
import { drive } from '../support/driver';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const maletin: ScriptedSpawn = { kind: 'maletin-coptero', x: 320, y: 70 };
const atMaletin = { x: 332, y: 79 };

describe('Run goldens', () => {
  it('run-idle: Rexi standing, aiming at a hovering Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    game.seconds(0.5, { aim: atMaletin });
    await expectGolden('run-idle', renderView(game.view));
  });

  it('run-firing: Mazo Automático gavels in flight toward the Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    game.seconds(0.3, { move: 1, aim: atMaletin });
    game.holdFireToward(atMaletin, 0.45);
    await expectGolden('run-firing', renderView(game.view));
  });

  it('run-jump-aim-left: Rexi airborne, aiming up and to the left', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    const aim = { x: 40, y: 30 };
    game.ticks(1, { jump: true, aim });
    game.seconds(0.25, { aim, move: -1, fire: true, jump: true });
    await expectGolden('run-jump-aim-left', renderView(game.view));
  });

  it('run-hud: HUD after destroying a Maletín-cóptero, a minute into the Run', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [maletin, { kind: 'maletin-coptero', x: 200, y: 50, atTick: 600 }] },
    });
    game.holdFireToward(atMaletin, 3);
    game.seconds(62.25, { aim: { x: 212, y: 59 } });
    await expectGolden('run-hud', renderView(game.view));
  });

  it('run-hurt: papers flying at a hurt Rexi, health bar down by the hits taken', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin],
        tuning: { enemies: { 'maletin-coptero': { fireIntervalMin: 0.7, fireIntervalMax: 0.9 } } },
      },
    });
    game.seconds(6.4, { aim: atMaletin });
    const { rexi } = game.view.run ?? {};
    expect(rexi?.health).toBeLessThan(rexi?.maxHealth ?? 0);
    expect(rexi?.invulnerableTicks).toBeGreaterThan(0);
    await expectGolden('run-hurt', renderView(game.view));
  });
});
