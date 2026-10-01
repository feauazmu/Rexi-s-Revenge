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

  it('arena-platform: the Arena with drifted clouds, Rexi standing on the left ledge', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [] } });
    const aim = { x: 300, y: 100 };
    game.ticks(1, { aim });
    game.seconds(0.45, { aim, move: -1, jump: true });
    game.seconds(4, { aim });
    const { rexi, arena } = game.view.run ?? expect.unreachable('no Run');
    expect(rexi.grounded).toBe(true);
    expect(rexi.y + rexi.h).toBe(arena.platforms[0]?.y);
    await expectGolden('arena-platform', renderView(game.view));
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
});
