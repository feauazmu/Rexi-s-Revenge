import { describe, expect, it } from 'vitest';
import { createGame, type InputFramePatch } from '../../src/core';
import { drive, driveFromTitle, eventsOf, runOf } from '../support/driver';

/** A varied, reproducible input script: run, jump, aim around and fire. */
function scriptedInput(tick: number): InputFramePatch {
  return {
    move: Math.sin(tick / 23) > 0 ? 1 : -1,
    jump: tick % 50 < 3,
    aim: { x: 240 + 200 * Math.cos(tick / 40), y: 60 + 40 * Math.sin(tick / 17) },
    fire: tick % 90 < 60,
  };
}

function playScript(seed: number, ticks: number) {
  const game = drive({
    seed,
    overrides: {
      spawns: [
        { kind: 'maletin-coptero', x: 300, y: 60 },
        { kind: 'maletin-coptero', x: 100, y: 40, atTick: 120 },
      ],
    },
  });
  for (let t = 0; t < ticks; t++) game.ticks(1, scriptedInput(t));
  return { log: game.log, view: game.view };
}

describe('Game core', () => {
  it('opens on the Title and announces it on the first tick', () => {
    const game = driveFromTitle();
    expect(game.ticks(1)).toEqual([{ type: 'screen-changed', from: null, to: 'title' }]);
    expect(game.view.screen).toBe('title');
  });

  it('counts game ticks and Run ticks in the view', () => {
    const game = driveFromTitle();
    game.ticks(5);
    expect(game.view.tick).toBe(5);
    const run = drive();
    const before = run.view.tick;
    run.ticks(5);
    expect(run.view.tick).toBe(before + 5);
    expect(runOf(run.view).tick).toBe(5);
  });

  it('reports the device kind it was created with', () => {
    expect(drive({ device: 'touch' }).view.device).toBe('touch');
    expect(drive().view.device).toBe('desktop');
  });

  it('is deterministic: same seed and inputs give the same event log and final view', () => {
    const a = playScript(42, 900);
    const b = playScript(42, 900);
    expect(eventsOf(a.log, 'enemy-hit').length).toBeGreaterThan(0);
    expect(b.log).toEqual(a.log);
    expect(b.view).toEqual(a.view);
  });

  it('gives a different Run for a different seed', () => {
    const a = playScript(1, 300);
    const b = playScript(2, 300);
    expect(b.view).not.toEqual(a.view);
  });

  it('rejects unknown tuning keys', () => {
    expect(() =>
      createGame({ seed: 1, overrides: { tuning: { rexi: { nope: 1 } as never } } }),
    ).toThrow(/Unknown tuning key: nope/);
  });
});
