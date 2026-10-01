import { describe, expect, it } from 'vitest';
import { defaultTuning, SCREEN_WIDTH } from '../../src/core';
import { driveEmptyArena, runOf } from '../support/driver';

const groundY = defaultTuning.arena.groundY;

describe('Rexi movement', () => {
  it('starts standing on the ground', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    const { rexi } = runOf(game.view);
    expect(rexi.grounded).toBe(true);
    expect(rexi.y + rexi.h).toBe(groundY);
  });

  it('runs right and left at the tuned speed', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    const startX = runOf(game.view).rexi.x;

    game.seconds(0.5, { move: 1 });
    const afterRight = runOf(game.view).rexi.x;
    expect(afterRight - startX).toBeCloseTo(defaultTuning.rexi.runSpeed * 0.5, 0);

    game.seconds(0.25, { move: -1 });
    expect(afterRight - runOf(game.view).rexi.x).toBeCloseTo(defaultTuning.rexi.runSpeed * 0.25, 0);
  });

  it('stops when there is no movement input', () => {
    const game = driveEmptyArena();
    game.seconds(0.2, { move: 1 });
    const x = runOf(game.view).rexi.x;
    game.seconds(0.5);
    expect(runOf(game.view).rexi.x).toBe(x);
  });

  it('respects the run speed from tuning overrides', () => {
    const game = driveEmptyArena({ overrides: { tuning: { rexi: { runSpeed: 60 } } } });
    game.ticks(1);
    const startX = runOf(game.view).rexi.x;
    game.seconds(1, { move: 1 });
    expect(runOf(game.view).rexi.x - startX).toBeCloseTo(60, 0);
  });

  it('cannot leave the Arena on either side', () => {
    const game = driveEmptyArena();
    game.seconds(10, { move: -1 });
    expect(runOf(game.view).rexi.x).toBe(0);

    game.seconds(10, { move: 1 });
    const { rexi } = runOf(game.view);
    expect(rexi.x + rexi.w).toBe(SCREEN_WIDTH);
  });

  it('jumps, rises, falls and lands back on the ground', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    const groundedY = runOf(game.view).rexi.y;

    game.ticks(1, { jump: true });
    expect(runOf(game.view).rexi.grounded).toBe(false);

    // Hold jump through the rise for a full-height jump.
    let peakY = groundedY;
    for (let i = 0; i < 30; i++) {
      game.ticks(1, { jump: true });
      peakY = Math.min(peakY, runOf(game.view).rexi.y);
    }
    const { jumpSpeed } = defaultTuning.rexi;
    const expectedHeight = (jumpSpeed * jumpSpeed) / (2 * defaultTuning.arena.gravity);
    expect(groundedY - peakY).toBeGreaterThan(expectedHeight * 0.9);
    expect(groundedY - peakY).toBeLessThan(expectedHeight * 1.1);

    game.seconds(1);
    const landed = runOf(game.view).rexi;
    expect(landed.grounded).toBe(true);
    expect(landed.y).toBe(groundedY);
    expect(landed.vy).toBe(0);
  });

  it('jumps lower when the jump button is tapped instead of held', () => {
    const peakHeight = (holdTicks: number) => {
      const game = driveEmptyArena();
      game.ticks(1);
      const groundedY = runOf(game.view).rexi.y;
      game.ticks(holdTicks, { jump: true });
      let peak = groundedY;
      for (let i = 0; i < 60; i++) {
        game.ticks(1);
        peak = Math.min(peak, runOf(game.view).rexi.y);
      }
      return groundedY - peak;
    };
    expect(peakHeight(2)).toBeLessThan(peakHeight(30) * 0.6);
  });

  it('cannot jump again while airborne', () => {
    const game = driveEmptyArena();
    game.ticks(1, { jump: true });
    game.ticks(5);
    const risingVy = runOf(game.view).rexi.vy;
    game.ticks(1, { jump: true });
    expect(runOf(game.view).rexi.vy).toBeGreaterThan(risingVy);
  });

  it('can move horizontally while airborne', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    const startX = runOf(game.view).rexi.x;
    game.ticks(1, { jump: true, move: 1 });
    game.seconds(0.3, { move: 1 });
    const { rexi } = runOf(game.view);
    expect(rexi.grounded).toBe(false);
    expect(rexi.x).toBeGreaterThan(startX);
  });

  it('faces the side it aims at', () => {
    const game = driveEmptyArena();
    game.ticks(1, { aim: { x: 0, y: 133 } });
    expect(runOf(game.view).rexi.facing).toBe(-1);
    game.ticks(1, { aim: { x: 639, y: 133 } });
    expect(runOf(game.view).rexi.facing).toBe(1);
  });
});
