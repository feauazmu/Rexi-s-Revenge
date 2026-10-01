/** Lluvia de Sellos: a short-range spread of rubber stamps. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  secondsToTicks,
  type ScriptedSpawn,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import { driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';

const sellos = defaultTuning.weapons['lluvia-de-sellos'];
const maletin = defaultTuning.enemies['maletin-coptero'];
const sellosCrate = weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y });

/** Rexi holding the Lluvia de Sellos, plus any Enemies. */
const armed = (enemies: readonly ScriptedSpawn[] = [], tuning?: TuningOverrides) => {
  const game = driveEmptyArena({ overrides: { spawns: [sellosCrate, ...enemies], tuning } });
  game.ticks(1);
  expect(runOf(game.view).rexi.weapon.id).toBe('lluvia-de-sellos');
  return game;
};

const degrees = (radians: number) => (radians * 180) / Math.PI;
const angleOf = (v: Vec2) => degrees(Math.atan2(v.y, v.x));

describe('Lluvia de Sellos', () => {
  it('fires a fan of stamps from the muzzle, centered on the aim point', () => {
    const game = armed();
    const aim = { x: 533, y: 133 };
    const events = game.ticks(1, { aim, fire: true });
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'lluvia-de-sellos' },
    ]);

    const run = runOf(game.view);
    const stamps = run.projectiles.filter((p) => p.kind === 'stamp');
    expect(stamps).toHaveLength(sellos.pellets);
    expect(stamps.every((p) => p.owner === 'rexi')).toBe(true);
    for (const p of stamps) expect(Math.hypot(p.vx, p.vy)).toBeCloseTo(sellos.projectileSpeed, 6);

    const aimAngle = angleOf(run.rexi.aimDirection);
    const offsets = stamps
      .map((p) => angleOf({ x: p.vx, y: p.vy }) - aimAngle)
      .sort((a, b) => a - b);
    expect(offsets[0]).toBeCloseTo(-sellos.spreadAngle / 2, 6);
    expect(offsets.at(-1)).toBeCloseTo(sellos.spreadAngle / 2, 6);
    const gaps = offsets.slice(1).map((o, i) => o - (offsets[i] ?? 0));
    for (const gap of gaps) expect(gap).toBeCloseTo(sellos.spreadAngle / (sellos.pellets - 1), 6);
  });

  it('has a short range: stamps vanish after their lifetime', () => {
    const game = armed();
    game.ticks(1, { aim: { x: 533, y: 133 }, fire: true });
    game.seconds(sellos.projectileLifetime - 2 / 60);
    expect(runOf(game.view).projectiles.length).toBe(sellos.pellets);
    game.seconds(3 / 60);
    expect(runOf(game.view).projectiles).toHaveLength(0);
  });

  it('respects its fire interval while the trigger is held', () => {
    const game = armed();
    const shots = eventsOf(game.holdFireToward({ x: 533, y: 133 }, 3), 'weapon-fired');
    expect(shots.length).toBe(Math.ceil((3 * 60) / secondsToTicks(sellos.fireInterval)));
  });

  /** Maletín-cópteros that hold still, so only the fan decides what is hit. */
  const still: TuningOverrides = {
    enemies: { 'maletin-coptero': { driftSpeed: 0, hoverAmplitude: 0 } },
  };

  /**
   * Three Maletín-cópteros at `distance` px from the muzzle, one per edge and center of the fan.
   * The muzzle is at arm's reach from the shoulder along the aim, where the shot leaves.
   */
  function fanOfEnemies(distance: number) {
    const probe = armed();
    const { shoulder } = runOf(probe.view).rexi;
    const aimAngle = -40;
    const toAim = (aimAngle * Math.PI) / 180;
    const reach = defaultTuning.rexi.muzzleReach;
    const muzzle = {
      x: shoulder.x + Math.cos(toAim) * reach,
      y: shoulder.y + Math.sin(toAim) * reach,
    };
    const spawns = [-sellos.spreadAngle / 2, 0, sellos.spreadAngle / 2].map(
      (offset): ScriptedSpawn => {
        const a = ((aimAngle + offset) * Math.PI) / 180;
        return {
          kind: 'maletin-coptero',
          x: muzzle.x + Math.cos(a) * distance - maletin.width / 2,
          y: muzzle.y + Math.sin(a) * distance - maletin.height / 2,
        };
      },
    );
    const rad = (aimAngle * Math.PI) / 180;
    const aim = { x: muzzle.x + Math.cos(rad) * 133, y: muzzle.y + Math.sin(rad) * 133 };
    return { spawns, aim };
  }

  it('hits several close Enemies with one shot', () => {
    const { spawns, aim } = fanOfEnemies(110);
    const game = armed(spawns, still);
    const events = [...game.ticks(1, { aim, fire: true }), ...game.seconds(1, { aim })];
    expect(eventsOf(events, 'weapon-fired')).toHaveLength(1);
    const hitEnemies = new Set(eventsOf(events, 'enemy-hit').map((e) => e.enemyId));
    expect(hitEnemies.size).toBe(3);
    for (const hit of eventsOf(events, 'enemy-hit')) expect(hit.damage).toBe(sellos.damage);
  });

  it('does not reach Enemies far away', () => {
    const { spawns, aim } = fanOfEnemies(sellos.projectileSpeed * sellos.projectileLifetime + 53);
    const game = armed(spawns, still);
    const events = [...game.ticks(1, { aim, fire: true }), ...game.seconds(1, { aim })];
    expect(eventsOf(events, 'enemy-hit')).toHaveLength(0);
  });
});
