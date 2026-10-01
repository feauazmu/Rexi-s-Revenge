import { describe, expect, it } from 'vitest';
import { defaultTuning } from '../../src/core';
import { driveEmptyArena, runOf, type Driver } from '../support/driver';

const { groundY, gravity } = defaultTuning.arena;
const { jumpSpeed, spawnX, width: rexiWidth } = defaultTuning.rexi;
/** Height of a full (held) jump, in pixels. */
const fullJumpHeight = (jumpSpeed * jumpSpeed) / (2 * gravity);

/** A one-way platform 40 px above the ground, right over Rexi's spawn point. */
const overhead = { x: spawnX - 30, y: groundY - 40, w: 80 };

const withPlatforms = (platforms: readonly { x: number; y: number; w: number }[]): Driver =>
  driveEmptyArena({ overrides: { tuning: { arena: { platforms } } } });

const rexiOf = (game: Driver) => runOf(game.view).rexi;
const feetOf = (game: Driver) => rexiOf(game).y + rexiOf(game).h;

/** Jumps (holding jump through the rise) and waits until Rexi has landed somewhere. */
function jumpAndSettle(game: Driver, input: { move?: number } = {}): number {
  let highestFeet = feetOf(game);
  for (let i = 0; i < 40; i++) {
    game.ticks(1, { ...input, jump: true });
    highestFeet = Math.min(highestFeet, feetOf(game));
  }
  game.seconds(1);
  return highestFeet;
}

describe('one-way platforms', () => {
  it('come from the tuning catalog and are exposed in the Arena view', () => {
    const game = withPlatforms([overhead]);
    game.ticks(1);
    expect(runOf(game.view).arena.platforms).toEqual([overhead]);

    const defaults = driveEmptyArena();
    defaults.ticks(1);
    expect(runOf(defaults.view).arena.platforms).toEqual(defaultTuning.arena.platforms);
  });

  it('let Rexi jump up through them from below and land on top', () => {
    const game = withPlatforms([overhead]);
    game.ticks(1);
    const highestFeet = jumpAndSettle(game);

    expect(highestFeet).toBeLessThan(overhead.y); // passed through the platform
    const rexi = rexiOf(game);
    expect(rexi.grounded).toBe(true);
    expect(rexi.y + rexi.h).toBe(overhead.y);
    expect(rexi.vy).toBe(0);
  });

  it('catch Rexi when he falls onto them fast, without tunneling through', () => {
    // A huge jump and fall speed: Rexi moves ~25 px per tick, far more than a platform's depth.
    const game = driveEmptyArena({
      overrides: {
        tuning: {
          rexi: { jumpSpeed: 1500 },
          arena: { maxFallSpeed: 1500, gravity: 4000, platforms: [overhead] },
        },
      },
    });
    game.ticks(1);
    let sawFastFall = false;
    for (let i = 0; i < 120; i++) {
      game.ticks(1, { jump: i < 30 });
      if (rexiOf(game).vy > 1000) sawFastFall = true;
    }
    expect(sawFastFall).toBe(true);
    expect(rexiOf(game).grounded).toBe(true);
    expect(feetOf(game)).toBe(overhead.y);
  });

  it('do not stop Rexi when he only passes beside them', () => {
    const offToTheSide = { x: spawnX + rexiWidth + 4, y: groundY - 40, w: 40 };
    const game = withPlatforms([offToTheSide]);
    game.ticks(1);
    jumpAndSettle(game);
    expect(feetOf(game)).toBe(groundY);
  });

  it('let Rexi drop down through them', () => {
    const game = withPlatforms([overhead]);
    game.ticks(1);
    jumpAndSettle(game);
    expect(feetOf(game)).toBe(overhead.y);

    game.ticks(1, { drop: true });
    expect(rexiOf(game).grounded).toBe(false);
    game.seconds(1);
    expect(rexiOf(game).grounded).toBe(true);
    expect(feetOf(game)).toBe(groundY);
  });

  it('dropping down only falls through one platform per press when released', () => {
    const lower = { x: spawnX - 30, y: groundY - 40, w: 80 };
    const upper = { x: spawnX - 30, y: groundY - 80, w: 80 };
    const game = withPlatforms([lower, upper]);
    game.ticks(1);
    jumpAndSettle(game);
    jumpAndSettle(game);
    expect(feetOf(game)).toBe(upper.y);

    game.ticks(1, { drop: true });
    game.seconds(1);
    expect(feetOf(game)).toBe(lower.y);
  });

  it('holding drop keeps Rexi falling through every platform below', () => {
    const lower = { x: spawnX - 30, y: groundY - 40, w: 80 };
    const upper = { x: spawnX - 30, y: groundY - 80, w: 80 };
    const game = withPlatforms([lower, upper]);
    game.ticks(1);
    jumpAndSettle(game);
    jumpAndSettle(game);

    game.seconds(1, { drop: true });
    expect(feetOf(game)).toBe(groundY);
  });

  it('cannot drop through the ground floor', () => {
    const game = withPlatforms([]);
    game.ticks(1);
    game.seconds(0.5, { drop: true });
    expect(rexiOf(game).grounded).toBe(true);
    expect(feetOf(game)).toBe(groundY);
  });

  it('let Rexi jump again from a platform and walk off its edge', () => {
    const game = withPlatforms([overhead]);
    game.ticks(1);
    jumpAndSettle(game);

    const highestFeet = jumpAndSettle(game);
    expect(overhead.y - highestFeet).toBeGreaterThan(fullJumpHeight * 0.9);
    expect(feetOf(game)).toBe(overhead.y);

    game.seconds(1.5, { move: 1 });
    expect(rexiOf(game).grounded).toBe(true);
    expect(feetOf(game)).toBe(groundY);
  });
});

describe('default Arena layout', () => {
  const platforms = defaultTuning.arena.platforms;

  it('has a few platforms for vertical play', () => {
    expect(platforms.length).toBeGreaterThanOrEqual(2);
    expect(platforms.length).toBeLessThanOrEqual(5);
  });

  it('places every platform inside the Arena, between the HUD strip and the ground', () => {
    for (const p of platforms) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(480);
      expect(p.w).toBeGreaterThanOrEqual(rexiWidth * 3);
      expect(p.y).toBeGreaterThan(40);
      expect(p.y).toBeLessThan(groundY);
    }
  });

  it('makes every platform reachable with one jump from the ground or a lower platform', () => {
    const surfaces = [groundY, ...platforms.map((p) => p.y)];
    for (const p of platforms) {
      const below = surfaces.filter((y) => y > p.y);
      const closest = Math.min(...below);
      expect(closest - p.y).toBeLessThan(fullJumpHeight - 4);
    }
  });

  it('keeps Rexi spawn point clear, so a standing jump lands back on the ground', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    jumpAndSettle(game);
    expect(feetOf(game)).toBe(groundY);
  });
});
