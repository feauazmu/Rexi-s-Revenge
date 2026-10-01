/** Golden images of the precision Weapons: Citaciones Teledirigidas and Sentencia Firme. */
import { describe, expect, it } from 'vitest';
import { drive, ON_REXI, runOf, weaponCrate } from '../support/driver';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

describe('Precision Weapon goldens', () => {
  it('citaciones-homing: subpoenas curving toward a Maletín-cóptero they were not aimed at', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [
          weaponCrate('citaciones-teledirigidas', ON_REXI.x, { y: ON_REXI.y }),
          { kind: 'maletin-coptero', x: 300, y: 36 },
        ],
      },
    });
    const aim = { x: 420, y: 200 };
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
        spawns: [
          weaponCrate('sentencia-firme', ON_REXI.x, { y: ON_REXI.y }),
          { kind: 'maletin-coptero', x: 220, y: 140 },
          { kind: 'maletin-coptero', x: 360, y: 74 },
        ],
      },
    });
    const aim = { x: 372, y: 83 };
    game.ticks(4, { aim });
    game.ticks(1, { aim, fire: true });
    game.ticks(2, { aim });
    const run = runOf(game.view);
    expect(run.effects.beams).toHaveLength(1);
    expect(run.stats.enemiesDestroyed).toBe(2);
    await expectGolden('sentencia-beam', renderView(game.view));
  });
});
