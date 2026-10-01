import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn } from '../../src/core';
import { drive, driveEmptyArena, eventsOf, runOf } from '../support/driver';

const tuning = defaultTuning.rexi;
const maletin = defaultTuning.enemies['maletin-coptero'];

describe("Rexi's aiming arm", () => {
  it('pivots at the shoulder on the facing side, mirrored when facing left', () => {
    const game = driveEmptyArena();
    game.ticks(1, { aim: { x: 400, y: 100 } });
    const right = runOf(game.view).rexi;
    expect(right.shoulder).toEqual({
      x: right.x + tuning.shoulderOffsetX,
      y: right.y + tuning.shoulderOffsetY,
    });

    game.ticks(1, { aim: { x: 10, y: 100 } });
    const left = runOf(game.view).rexi;
    expect(left.facing).toBe(-1);
    expect(left.shoulder).toEqual({
      x: left.x + left.w - tuning.shoulderOffsetX,
      y: left.y + tuning.shoulderOffsetY,
    });
  });

  it('puts the muzzle at arm’s reach from the shoulder, toward the aim point', () => {
    const game = driveEmptyArena();
    const aim = { x: 300, y: 60 };
    game.ticks(1, { aim });
    const { shoulder, muzzle, aimDirection } = runOf(game.view).rexi;
    expect(Math.hypot(muzzle.x - shoulder.x, muzzle.y - shoulder.y)).toBeCloseTo(
      tuning.muzzleReach,
      6,
    );
    const toAim = { x: aim.x - shoulder.x, y: aim.y - shoulder.y };
    const length = Math.hypot(toAim.x, toAim.y);
    expect(aimDirection.x).toBeCloseTo(toAim.x / length, 6);
    expect(aimDirection.y).toBeCloseTo(toAim.y / length, 6);
  });

  it('counts ticks since the last shot for the recoil animation', () => {
    const game = driveEmptyArena();
    game.ticks(1, { fire: true });
    expect(runOf(game.view).rexi.shotAge).toBe(0);
    game.ticks(5);
    expect(runOf(game.view).rexi.shotAge).toBe(5);
  });
});

describe("Rexi's hurt reaction", () => {
  // A Maletín-cóptero hovering low, overlapping Rexi's back, that never fires.
  const bump: ScriptedSpawn = {
    kind: 'maletin-coptero',
    x: tuning.spawnX - maletin.width + 2,
    y: defaultTuning.arena.groundY - maletin.height - 2,
  };
  const holdFire = { enemies: { 'maletin-coptero': { fireIntervalMin: 60, fireIntervalMax: 60 } } };

  it('is not hurt at the start of a Run', () => {
    const game = driveEmptyArena();
    game.ticks(1);
    expect(runOf(game.view).rexi.hurtTicks).toBe(0);
  });

  it('is not hurt by touching an Enemy, only by Enemy projectiles', () => {
    const game = drive({ overrides: { spawns: [bump], tuning: holdFire } });
    expect(eventsOf(game.seconds(2), 'rexi-hit')).toHaveLength(0);
    const { rexi } = runOf(game.view);
    expect(rexi).toMatchObject({ hurtTicks: 0, health: rexi.maxHealth });
  });
});
