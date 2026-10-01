/** The Run numbers the HUD shows: score, elapsed time, Rexi's health and the current Weapon. */
import { describe, expect, it } from 'vitest';
import { defaultTuning, TICKS_PER_SECOND, type ScriptedSpawn } from '../../src/core';
import { drive, driveEmptyArena, eventsOf, runOf } from '../support/driver';
import { holdStill } from '../support/fixtures';

const maletin = defaultTuning.enemies['maletin-coptero'];

const maletinAt = (x: number, y: number, atTick = 0): ScriptedSpawn => ({
  kind: 'maletin-coptero',
  x,
  y,
  atTick,
});
const centerOf = (x: number, y: number) => ({
  x: x + maletin.width / 2,
  y: y + maletin.height / 2,
});

describe('HUD score', () => {
  it('starts at zero', () => {
    expect(runOf(driveEmptyArena().view).stats.score).toBe(0);
  });

  it("increases by the Maletín-cóptero's configured points when one is destroyed", () => {
    const game = drive({
      overrides: {
        spawns: [maletinAt(300, 60)],
        tuning: holdStill({ enemies: { 'maletin-coptero': { points: 275 } } }),
      },
    });
    const events = game.holdFireToward(centerOf(300, 60), 5);
    expect(eventsOf(events, 'enemy-destroyed')).toEqual([expect.objectContaining({ points: 275 })]);
    expect(runOf(game.view).stats.score).toBe(275);
  });

  it('adds up the points of every Enemy destroyed', () => {
    const game = drive({
      overrides: { spawns: [maletinAt(300, 60), maletinAt(100, 40, 240)], tuning: holdStill() },
    });
    game.holdFireToward(centerOf(300, 60), 3);
    expect(runOf(game.view).stats.score).toBe(maletin.points);
    game.holdFireToward(centerOf(100, 40), 3);
    expect(runOf(game.view).stats.score).toBe(2 * maletin.points);
  });
});

describe('HUD elapsed time', () => {
  it('advances with Run time', () => {
    const game = driveEmptyArena();
    expect(runOf(game.view).stats.ticksSurvived).toBe(0);
    game.seconds(1);
    expect(runOf(game.view).stats.ticksSurvived).toBe(TICKS_PER_SECOND);
    game.seconds(61.5);
    expect(runOf(game.view).stats.ticksSurvived).toBe(62.5 * TICKS_PER_SECOND);
  });
});

describe('HUD health', () => {
  it('shows Rexi at full health when a Run starts', () => {
    const { rexi } = runOf(driveEmptyArena().view);
    expect(rexi.maxHealth).toBe(defaultTuning.rexi.maxHealth);
    expect(rexi.health).toBe(rexi.maxHealth);
  });

  it('uses the tuned maximum health', () => {
    const { rexi } = runOf(
      driveEmptyArena({ overrides: { tuning: { rexi: { maxHealth: 7 } } } }).view,
    );
    expect(rexi).toMatchObject({ health: 7, maxHealth: 7 });
  });
});

describe('HUD Weapon', () => {
  it('shows the Mazo Automático with unlimited ammo', () => {
    expect(runOf(driveEmptyArena().view).rexi.weapon).toEqual({
      id: 'mazo-automatico',
      ammo: null,
    });
  });
});
