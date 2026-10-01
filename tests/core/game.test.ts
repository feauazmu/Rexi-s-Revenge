import { describe, expect, it } from 'vitest';
import { createGame, inputFrame, type InputFramePatch } from '../../src/core';
import { drive, eventsOf, runOf } from '../support/driver';

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
  const game = createGame({
    seed,
    overrides: {
      spawns: [
        { kind: 'maletin-coptero', x: 300, y: 60 },
        { kind: 'maletin-coptero', x: 100, y: 40, atTick: 120 },
      ],
    },
  });
  const log = [];
  for (let t = 0; t < ticks; t++) log.push(...game.tick(inputFrame(scriptedInput(t))));
  return { log, view: game.view };
}

describe('Game core', () => {
  it('opens in a Run and announces it on the first tick', () => {
    const game = drive();
    const events = game.ticks(1);
    expect(events.slice(0, 2)).toEqual([
      { type: 'screen-changed', from: null, to: 'run' },
      { type: 'run-started' },
    ]);
    expect(game.view.screen).toBe('run');
  });

  it('counts ticks in the view', () => {
    const game = drive();
    game.ticks(5);
    expect(game.view.tick).toBe(5);
    expect(runOf(game.view).tick).toBe(5);
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
