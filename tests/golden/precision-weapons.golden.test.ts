/**
 * Golden images of the aimed Weapons: Citaciones Teledirigidas and Sentencia Firme, and the
 * Lluvia de Sellos' fan up close.
 */
import { describe, expect, it } from 'vitest';
import { drive, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';
import { holdStill } from '../support/fixtures';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

describe('Precision Weapon goldens', () => {
  it('citaciones-homing: subpoenas curving toward a Maletín-cóptero they were not aimed at', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        tuning: holdStill(),
        spawns: [
          weaponCrate('citaciones-teledirigidas', ON_REXI.x, { y: ON_REXI.y }),
          { kind: 'maletin-coptero', x: 400, y: 48 },
        ],
      },
    });
    const aim = { x: 560, y: 267 };
    game.ticks(1, { aim });
    game.holdFireToward(aim, 0.93);
    game.ticks(4, { aim });
    expect(runOf(game.view).projectiles.filter((p) => p.kind === 'subpoena')).toHaveLength(2);
    await expectGolden('citaciones-homing', renderView(game.view));
  });

  it('sentencia-beam: one beam destroying two Maletín-cópteros on its line', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        tuning: holdStill(),
        spawns: [
          weaponCrate('sentencia-firme', ON_REXI.x, { y: ON_REXI.y }),
          { kind: 'maletin-coptero', x: 293, y: 187 },
          { kind: 'maletin-coptero', x: 480, y: 99 },
        ],
      },
    });
    const aim = { x: 496, y: 111 };
    game.ticks(4, { aim });
    game.ticks(1, { aim, fire: true });
    game.ticks(2, { aim });
    const run = runOf(game.view);
    expect(run.effects.beams).toHaveLength(1);
    expect(run.stats.enemiesDestroyed).toBe(2);
    await expectGolden('sentencia-beam', renderView(game.view));
  });

  it('sellos-fan: one Lluvia de Sellos fan hitting three close Maletín-cópteros', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        tuning: holdStill(),
        spawns: [
          weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y }),
          { kind: 'maletin-coptero', x: 279, y: 184 },
          { kind: 'maletin-coptero', x: 293, y: 209 },
          { kind: 'maletin-coptero', x: 338, y: 236 },
        ],
      },
    });
    const aim = { x: 400, y: 190 };
    game.ticks(4, { aim });
    const fired = game.ticks(1, { aim, fire: true });
    expect(eventsOf(fired, 'weapon-fired')).toHaveLength(1);
    // Capture the fan mid-flight, on the first tick it has hit two of them.
    const hit = new Set<number>();
    const fly = () => {
      for (const e of eventsOf(game.ticks(1, { aim }), 'enemy-hit')) hit.add(e.enemyId);
    };
    for (let i = 0; i < 20 && hit.size < 2; i++) fly();
    const stamps = runOf(game.view).projectiles.filter((p) => p.kind === 'stamp');
    expect(stamps.length).toBeGreaterThan(0);
    expect(runOf(game.view).enemies.filter((e) => e.hitFlash).length).toBeGreaterThanOrEqual(2);
    await expectGolden('sellos-fan', renderView(game.view));
    // The rest of the same fan reaches the third.
    for (let i = 0; i < 10 && hit.size < 3; i++) fly();
    expect(hit.size).toBe(3);
  });
});
