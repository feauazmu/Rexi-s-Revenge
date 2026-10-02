import { describe, expect, it } from 'vitest';
import { defaultTuning, DT, SCREEN_WIDTH } from '../../src/core';
import { driveEmptyArena, runOf, type Driver } from '../support/driver';

const { groundY, gravity } = defaultTuning.arena;
const { jumpSpeed, runSpeed, spawnX, width: rexiWidth } = defaultTuning.rexi;
/** Height of a full (held) jump, in pixels. */
const fullJumpHeight = (jumpSpeed * jumpSpeed) / (2 * gravity);

/** Something Rexi stands on: the ground or a Ledge. */
interface Surface {
  readonly x: number;
  readonly y: number;
  readonly w: number;
}

/**
 * How far sideways a full running jump carries Rexi before his feet fall back below a surface
 * `rise` px above the one he jumped from, px; or -Infinity when the jump is not that high.
 */
function runningJumpReach(rise: number): number {
  const lift = jumpSpeed * jumpSpeed - 2 * gravity * rise;
  if (lift < 0) return -Infinity;
  return (runSpeed * (jumpSpeed + Math.sqrt(lift))) / gravity;
}

/**
 * How far sideways Rexi's hitbox has to travel, from the last spot on `from` he can jump from,
 * until it overlaps `to`; 0 when he can jump straight up into it.
 */
function sidewaysGap(from: Surface, to: Surface): number {
  const rightward = to.x - (from.x + from.w) - rexiWidth;
  const leftward = from.x - (to.x + to.w) - rexiWidth;
  return Math.max(0, rightward, leftward);
}

/** A one-way platform 53 px above the ground, right over Rexi's spawn point. */
const overhead = { x: spawnX - 40, y: groundY - 53, w: 107 };

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
    const lower = { x: spawnX - 40, y: groundY - 53, w: 107 };
    const upper = { x: spawnX - 40, y: groundY - 107, w: 107 };
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
    const lower = { x: spawnX - 40, y: groundY - 53, w: 107 };
    const upper = { x: spawnX - 40, y: groundY - 107, w: 107 };
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
      expect(p.x + p.w).toBeLessThanOrEqual(SCREEN_WIDTH);
      expect(p.w).toBeGreaterThanOrEqual(rexiWidth * 3);
      expect(p.y).toBeGreaterThan(53);
      expect(p.y).toBeLessThan(groundY);
    }
  });

  it('makes every Ledge reachable with running jumps from the ground, up and across', () => {
    // A few px of slack, for the tick-by-tick physics and for the player's timing.
    const slack = 4;
    const ground = { x: 0, y: groundY, w: SCREEN_WIDTH };
    const reached: Surface[] = [ground];
    let left = [...platforms];
    for (let found = true; found;) {
      found = false;
      for (const to of left) {
        const reachable = reached.some(
          (from) =>
            from.y > to.y &&
            from.y - to.y < fullJumpHeight - slack &&
            sidewaysGap(from, to) < runningJumpReach(from.y - to.y) - slack,
        );
        if (reachable) {
          reached.push(to);
          left = left.filter((p) => p !== to);
          found = true;
        }
      }
    }
    expect(left).toEqual([]);
  });

  it('lets Rexi land on the high middle Ledge with a running jump from either side Ledge', () => {
    const [low, , high] = [...platforms].sort((a, b) => b.y - a.y);
    if (!low || !high) throw new Error('Expected low side Ledges and a high middle one');
    const sides = platforms.filter((p) => p.y === low.y);
    expect(sides).toHaveLength(2);

    for (const side of sides) {
      const towardMiddle = side.x < high.x ? 1 : -1;
      // Spawn under the side Ledge, jump onto it, then run toward the middle.
      const game = driveEmptyArena({
        overrides: { tuning: { rexi: { spawnX: side.x + side.w / 2 - rexiWidth / 2 } } },
      });
      game.ticks(1);
      jumpAndSettle(game);
      expect(feetOf(game)).toBe(side.y);

      // Run to the edge and jump on the last tick before running off it.
      const step = runSpeed * DT;
      const atEdge = () => {
        const { x } = rexiOf(game);
        return towardMiddle > 0 ? x + step >= side.x + side.w : x + rexiWidth - step <= side.x;
      };
      for (let i = 0; i < 120 && !atEdge(); i++) game.ticks(1, { move: towardMiddle });
      expect(rexiOf(game).grounded).toBe(true);
      // Keep running and holding jump until he lands.
      game.ticks(1, { move: towardMiddle, jump: true });
      for (let i = 0; i < 120 && !rexiOf(game).grounded; i++) {
        game.ticks(1, { move: towardMiddle, jump: true });
      }
      expect(feetOf(game), `from the Ledge at x ${side.x}`).toBe(high.y);
    }
  });

  it('keeps Rexi spawn point clear, so a standing jump lands back on the ground', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    jumpAndSettle(game);
    expect(feetOf(game)).toBe(groundY);
  });
});
