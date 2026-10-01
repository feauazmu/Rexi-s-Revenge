/** Crates: timed drops with weighted seeded contents, falling, landing, blinking, expiry, pickup. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  POWER_UP_IDS,
  SCREEN_WIDTH,
  SPECIAL_WEAPON_IDS,
  secondsToTicks,
  TICKS_PER_SECOND,
  type CrateView,
} from '../../src/core';
import { drive, driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';

const crates = defaultTuning.crates;
const groundY = defaultTuning.arena.groundY;
const sellosCrate = (x: number, options?: Parameters<typeof weaponCrate>[2]) =>
  weaponCrate('lluvia-de-sellos', x, options);

/** Far from Rexi's spawn point, so he never touches it unless he walks there. */
const FAR_X = 480;

function onlyCrate(game: { readonly view: Parameters<typeof runOf>[0] }): CrateView {
  const list = runOf(game.view).crates;
  expect(list).toHaveLength(1);
  const [crate] = list;
  if (!crate) throw new Error('unreachable');
  return crate;
}

describe('Automatic Crate drops', () => {
  it('drops the first Crate at the tuned time, above the top of the screen', () => {
    const game = drive({ seed: 3 });
    expect(eventsOf(game.ticks(secondsToTicks(crates.firstDrop)), 'crate-spawned')).toHaveLength(0);

    const spawned = eventsOf(game.ticks(1), 'crate-spawned');
    expect(spawned).toHaveLength(1);
    const crate = onlyCrate(game);
    expect(crate.id).toBe(spawned[0]?.crateId);
    expect(crate.y + crate.h).toBeLessThanOrEqual(crates.fallSpeed / TICKS_PER_SECOND + 1e-9);
    expect(crate.x).toBeGreaterThanOrEqual(crates.spawnMargin);
    expect(crate.x + crate.w).toBeLessThanOrEqual(SCREEN_WIDTH - crates.spawnMargin);
    expect(crate.landed).toBe(false);
  });

  it('keeps dropping Crates every interval ± jitter', () => {
    // Rexi must survive the Director's Enemies for the whole two minutes.
    const game = drive({ seed: 5, overrides: { tuning: { rexi: { maxHealth: 1_000_000_000 } } } });
    const ticks: number[] = [];
    for (let t = 0; t < 120 * TICKS_PER_SECOND; t++) {
      if (eventsOf(game.ticks(1), 'crate-spawned').length > 0) ticks.push(t);
    }
    const gaps = ticks.slice(1).map((t, i) => t - (ticks[i] ?? 0));
    expect(gaps.length).toBeGreaterThanOrEqual(8);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(
        secondsToTicks(crates.dropInterval - crates.dropIntervalJitter),
      );
      expect(gap).toBeLessThanOrEqual(
        secondsToTicks(crates.dropInterval + crates.dropIntervalJitter),
      );
    }
    expect(new Set(gaps).size).toBeGreaterThan(1);
  });

  it('is reproducible for a seed and varies between seeds', () => {
    const dropsFor = (seed: number) => eventsOf(drive({ seed }).seconds(60), 'crate-spawned');

    expect(dropsFor(7).length).toBeGreaterThan(2);
    expect(dropsFor(7)).toEqual(dropsFor(7));
    const variants = new Set([1, 2, 3, 4].map((seed) => JSON.stringify(dropsFor(seed))));
    expect(variants.size).toBe(4);
  });

  it('fills Crates from the content weights (Weapons other than the Mazo, Power-ups)', () => {
    const contents = eventsOf(drive({ seed: 9 }).seconds(90), 'crate-spawned').map(
      (e) => e.contents,
    );
    expect(contents.length).toBeGreaterThan(0);
    for (const c of contents) {
      const weight =
        c.kind === 'weapon' ? crates.weights.weapons[c.weapon] : crates.weights.powerUps[c.powerUp];
      expect(weight).toBeGreaterThan(0);
    }
  });

  it('never drops contents whose weight is 0', () => {
    const game = drive({
      seed: 9,
      overrides: {
        tuning: {
          crates: { weights: { powerUps: { creatina: 0 } } },
          rexi: { maxHealth: 1_000_000 }, // survives the Director for the whole stretch
        },
      },
    });
    const contents = eventsOf(game.seconds(300), 'crate-spawned').map((e) => e.contents);
    expect(contents.length).toBeGreaterThan(15);
    expect(contents).not.toContainEqual({ kind: 'power-up', powerUp: 'creatina' });
  });

  it('drops every Weapon that has a positive weight', () => {
    const fast = { firstDrop: 0, dropInterval: 0.5, dropIntervalJitter: 0 };
    const game = drive({ seed: 3, overrides: { tuning: { crates: fast } } });
    const dropped = new Set(
      eventsOf(game.seconds(40), 'crate-spawned').map((e) =>
        e.contents.kind === 'weapon' ? e.contents.weapon : null,
      ),
    );
    const weighted = SPECIAL_WEAPON_IDS.filter((id) => crates.weights.weapons[id] > 0);
    expect(weighted).toContain('mancuernas');
    expect(weighted).toContain('codigo-penal');
    for (const id of weighted) expect(dropped).toContain(id);
  });

  it('refuses a catalog where no content has a positive weight', () => {
    const noWeapons = Object.fromEntries(SPECIAL_WEAPON_IDS.map((id) => [id, 0]));
    const game = drive({
      overrides: {
        tuning: {
          crates: {
            firstDrop: 0,
            weights: {
              weapons: noWeapons,
              powerUps: Object.fromEntries(POWER_UP_IDS.map((id) => [id, 0])),
            },
          },
        },
      },
    });
    expect(() => game.ticks(1)).toThrow(/positive weight/);
  });

  it('does not drop Crates on its own when spawns are scripted', () => {
    const game = driveEmptyArena();
    expect(eventsOf(game.seconds(40), 'crate-spawned')).toHaveLength(0);
  });
});

describe('A falling Crate', () => {
  it('falls at the parachute speed', () => {
    const game = driveEmptyArena({ overrides: { spawns: [sellosCrate(FAR_X)] } });
    game.ticks(2);
    const before = onlyCrate(game);
    game.ticks(30);
    const after = onlyCrate(game);
    expect(after.x).toBe(before.x);
    expect(after.y - before.y).toBeCloseTo((crates.fallSpeed * 30) / TICKS_PER_SECOND, 6);
    expect(after.landed).toBe(false);
    expect(after.ticksLeft).toBeNull();
    expect(after.contents).toEqual({ kind: 'weapon', weapon: 'lluvia-de-sellos' });
  });

  it('lands on the ground, once, and starts its lifetime', () => {
    const game = driveEmptyArena({ overrides: { spawns: [sellosCrate(FAR_X)] } });
    const events = game.seconds((groundY + crates.size) / crates.fallSpeed + 0.5);
    expect(eventsOf(events, 'crate-landed')).toHaveLength(1);

    const crate = onlyCrate(game);
    expect(crate.landed).toBe(true);
    expect(crate.y + crate.h).toBe(groundY);
    expect(crate.ticksLeft).toBeGreaterThan(0);
    expect(crate.ticksLeft).toBeLessThanOrEqual(secondsToTicks(crates.lifetime));

    game.seconds(1);
    expect(onlyCrate(game).y + crates.size).toBe(groundY);
    expect(eventsOf(game.log, 'crate-landed')).toHaveLength(1);
  });

  it('lands on a one-way platform it falls onto, not the ground below', () => {
    const [platform] = [...defaultTuning.arena.platforms].sort((a, b) => a.y - b.y);
    if (!platform) throw new Error('the Arena has no platforms');
    const x = platform.x + (platform.w - crates.size) / 2;
    const game = driveEmptyArena({ overrides: { spawns: [sellosCrate(x)] } });
    const events = game.seconds((platform.y + crates.size) / crates.fallSpeed + 0.5);
    expect(eventsOf(events, 'crate-landed')).toHaveLength(1);

    const crate = onlyCrate(game);
    expect(crate.landed).toBe(true);
    expect(crate.y + crate.h).toBe(platform.y);
    game.seconds(1);
    expect(onlyCrate(game).y + crates.size).toBe(platform.y);
  });
});

describe('A landed Crate', () => {
  /** A Crate placed on the ground at tick 0 lands on the first tick. */
  const landedCrate = () =>
    driveEmptyArena({
      overrides: { spawns: [sellosCrate(FAR_X, { y: groundY - crates.size })] },
    });

  it('blinks during the last part of its lifetime', () => {
    const game = landedCrate();
    game.ticks(1);
    expect(onlyCrate(game)).toMatchObject({ landed: true, blinking: false });

    const steadyTicks = secondsToTicks(crates.lifetime) - secondsToTicks(crates.blinkTime);
    game.ticks(steadyTicks - 1);
    expect(onlyCrate(game).blinking).toBe(false);
    game.ticks(1);
    expect(onlyCrate(game)).toMatchObject({
      blinking: true,
      ticksLeft: secondsToTicks(crates.blinkTime),
    });
  });

  it('expires at the end of its lifetime', () => {
    const game = landedCrate();
    const lifetime = secondsToTicks(crates.lifetime);
    expect(eventsOf(game.ticks(lifetime), 'crate-expired')).toHaveLength(0);
    expect(runOf(game.view).crates).toHaveLength(1);

    const expired = eventsOf(game.ticks(1), 'crate-expired');
    expect(expired).toHaveLength(1);
    expect(runOf(game.view).crates).toHaveLength(0);
    expect(eventsOf(game.log, 'crate-picked')).toHaveLength(0);
  });

  it('uses the tuned lifetime', () => {
    const game = driveEmptyArena({
      overrides: {
        spawns: [sellosCrate(FAR_X, { y: groundY - crates.size })],
        tuning: { crates: { lifetime: 2 } },
      },
    });
    expect(eventsOf(game.seconds(2.1), 'crate-expired')).toHaveLength(1);
  });
});

describe('Picking up a Crate', () => {
  it('happens as soon as Rexi touches it, even mid-air', () => {
    const game = driveEmptyArena({ overrides: { spawns: [sellosCrate(ON_REXI.x)] } });
    const events = game.seconds(6);
    const picked = eventsOf(events, 'crate-picked');
    expect(picked).toHaveLength(1);
    expect(picked[0]?.contents).toEqual({ kind: 'weapon', weapon: 'lluvia-de-sellos' });
    expect(eventsOf(events, 'crate-landed')).toHaveLength(0);
    expect(runOf(game.view).crates).toHaveLength(0);
  });

  it('needs Rexi to touch it: he walks over to a landed Crate', () => {
    const game = driveEmptyArena({
      overrides: { spawns: [sellosCrate(FAR_X, { y: groundY - crates.size })] },
    });
    expect(eventsOf(game.seconds(1), 'crate-picked')).toHaveLength(0);

    const events = game.seconds(3, { move: 1 });
    expect(eventsOf(events, 'crate-picked')).toHaveLength(1);
    expect(eventsOf(events, 'crate-expired')).toHaveLength(0);
    expect(runOf(game.view).crates).toHaveLength(0);
  });

  it('delivers the contents: a Weapon Crate gives that Weapon', () => {
    const game = driveEmptyArena({
      overrides: { spawns: [sellosCrate(ON_REXI.x, { y: ON_REXI.y })] },
    });
    const events = game.ticks(1);
    expect(eventsOf(events, 'crate-picked')).toHaveLength(1);
    expect(eventsOf(events, 'weapon-collected')).toEqual([
      expect.objectContaining({ weapon: 'lluvia-de-sellos', added: true }),
    ]);
  });
});
