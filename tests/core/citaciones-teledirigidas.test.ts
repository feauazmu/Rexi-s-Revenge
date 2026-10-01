/** Citaciones Teledirigidas: homing subpoenas that steer toward the nearest Enemy. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  SPECIAL_WEAPON_IDS,
  secondsToTicks,
  type ScriptedSpawn,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import { drive, driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';
import { holdStill } from '../support/fixtures';

const citaciones = defaultTuning.weapons['citaciones-teledirigidas'];
const citacionesCrate = weaponCrate('citaciones-teledirigidas', ON_REXI.x, { y: ON_REXI.y });

/** Rexi holding the Citaciones Teledirigidas, plus any Enemies. */
const armed = (enemies: readonly ScriptedSpawn[] = [], tuning?: TuningOverrides) => {
  const game = driveEmptyArena({ overrides: { spawns: [citacionesCrate, ...enemies], tuning } });
  game.ticks(1);
  expect(runOf(game.view).rexi.weapon).toEqual({
    id: 'citaciones-teledirigidas',
    ammo: citaciones.pickupAmmo,
  });
  return game;
};

const subpoenasOf = (game: ReturnType<typeof armed>) =>
  runOf(game.view).projectiles.filter((p) => p.kind === 'subpoena');
const headingOf = (v: { vx: number; vy: number }) => Math.atan2(v.vy, v.vx);
const angleOf = (v: Vec2) => Math.atan2(v.y, v.x);

describe('Citaciones Teledirigidas', () => {
  it('fires one subpoena from the muzzle along the aim', () => {
    const game = armed();
    const events = game.ticks(1, { aim: { x: 400, y: 120 }, fire: true });
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'citaciones-teledirigidas' },
    ]);
    const run = runOf(game.view);
    const [subpoena, ...rest] = subpoenasOf(game);
    expect(rest).toHaveLength(0);
    expect(subpoena?.owner).toBe('rexi');
    expect(Math.hypot(subpoena?.vx ?? 0, subpoena?.vy ?? 0)).toBeCloseTo(
      citaciones.projectileSpeed,
      6,
    );
    expect(headingOf(subpoena ?? { vx: 0, vy: 0 })).toBeCloseTo(angleOf(run.rexi.aimDirection), 6);
  });

  it('flies straight when there is no Enemy to home onto', () => {
    const game = armed();
    game.ticks(1, { aim: { x: 400, y: 120 }, fire: true });
    const start = headingOf(subpoenasOf(game)[0] ?? expect.unreachable('no subpoena'));
    game.seconds(0.5);
    const later = subpoenasOf(game)[0] ?? expect.unreachable('subpoena gone');
    expect(headingOf(later)).toBeCloseTo(start, 9);
  });

  it('homes onto a moving Enemy it was not aimed at', () => {
    // A Maletín-cóptero bobbing a lot and drifting, up and to the left; the shot leaves low
    // to the right.
    const wobbly = { enemies: { 'maletin-coptero': { hoverAmplitude: 30, hoverPeriod: 1 } } };
    const game = armed([{ kind: 'maletin-coptero', x: 60, y: 80 }], wobbly);
    const enemyAt = () => runOf(game.view).enemies[0] ?? expect.unreachable('no Enemy');

    const before = { ...enemyAt() };
    const events = [
      ...game.ticks(1, { aim: { x: 400, y: 200 }, fire: true }),
      ...game.ticks(10, { aim: { x: 400, y: 200 } }),
    ];
    expect(enemyAt().y).not.toBeCloseTo(before.y, 0);
    expect(enemyAt().x).not.toBeCloseTo(before.x, 0);
    events.push(...game.seconds(citaciones.projectileLifetime, { aim: { x: 400, y: 200 } }));

    const hits = eventsOf(events, 'enemy-hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.damage).toBe(citaciones.damage);
    expect(subpoenasOf(game)).toHaveLength(0);
  });

  it('turns no faster than its turn rate', () => {
    const game = armed([{ kind: 'maletin-coptero', x: 60, y: 60 }]);
    game.ticks(1, { aim: { x: 400, y: 200 }, fire: true });
    const maxTurn = ((citaciones.turnRate * Math.PI) / 180) * (1 / 60);
    let heading = headingOf(subpoenasOf(game)[0] ?? expect.unreachable('no subpoena'));
    let turned = 0;
    for (let i = 0; i < 30; i++) {
      game.ticks(1);
      const subpoena = subpoenasOf(game)[0];
      if (!subpoena) break;
      const next = headingOf(subpoena);
      const delta = Math.abs(Math.atan2(Math.sin(next - heading), Math.cos(next - heading)));
      expect(delta).toBeLessThanOrEqual(maxTurn + 1e-9);
      expect(Math.hypot(subpoena.vx, subpoena.vy)).toBeCloseTo(citaciones.projectileSpeed, 6);
      turned += delta;
      heading = next;
    }
    expect(turned).toBeGreaterThan(maxTurn * 10);
  });

  it('steers toward the nearest Enemy', () => {
    const near: ScriptedSpawn = { kind: 'maletin-coptero', x: 70, y: 120 };
    const far: ScriptedSpawn = { kind: 'maletin-coptero', x: 420, y: 120 };
    const game = armed([far, near], holdStill());
    const nearId = eventsOf(game.log, 'enemy-spawned')[1]?.enemyId;
    const aim = { x: ON_REXI.x + 10, y: 0 }; // straight up, between the two
    const events = [...game.ticks(1, { aim, fire: true }), ...game.seconds(2, { aim })];
    const hits = eventsOf(events, 'enemy-hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.enemyId).toBe(nearId);
  });

  it('spends one ammo per subpoena and respects its fire interval', () => {
    const game = armed();
    const shots = eventsOf(game.holdFireToward({ x: 400, y: 100 }, 3), 'weapon-fired');
    expect(shots).toHaveLength(Math.ceil((3 * 60) / secondsToTicks(citaciones.fireInterval)));
    expect(runOf(game.view).rexi.weapon.ammo).toBe(citaciones.pickupAmmo - shots.length);
  });

  it('comes in Crates', () => {
    expect(defaultTuning.crates.weights.weapons['citaciones-teledirigidas']).toBeGreaterThan(0);
    const onlyCitaciones = Object.fromEntries(
      SPECIAL_WEAPON_IDS.map((id) => [id, id === 'citaciones-teledirigidas' ? 1 : 0]),
    );
    const game = drive({
      overrides: { tuning: { crates: { firstDrop: 0, weights: { weapons: onlyCitaciones } } } },
    });
    expect(eventsOf(game.ticks(1), 'crate-spawned')[0]?.contents).toEqual({
      kind: 'weapon',
      weapon: 'citaciones-teledirigidas',
    });
  });
});
