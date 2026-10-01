/**
 * Golden images of the explosive Weapons (Mancuernas, Código Penal): Rexi's held look, the
 * projectiles in flight, their blasts and their Crate icons. Views come from driving the real
 * Game core with fixed seeds and scripted spawns.
 */
import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn } from '../../src/core';
import { drive, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const onRexi = { y: ON_REXI.y };

describe('Explosive Weapon goldens', () => {
  it('run-mancuernas: one dumbbell bouncing, the next one lobbed', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [weaponCrate('mancuernas', ON_REXI.x, onRexi)] },
    });
    const aim = { x: 230, y: 120 };
    game.ticks(1, { aim });
    game.holdFireToward(aim, 1.2);
    game.ticks(8, { aim });
    const run = runOf(game.view);
    expect(run.rexi.weapon).toEqual({
      id: 'mancuernas',
      ammo: defaultTuning.weapons.mancuernas.pickupAmmo - 2,
    });
    expect(run.projectiles.filter((p) => p.kind === 'dumbbell')).toHaveLength(2);
    await expectGolden('run-mancuernas', renderView(game.view));
  });

  it('run-mancuernas-blast: a dumbbell exploding on the ground', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [weaponCrate('mancuernas', ON_REXI.x, onRexi)] },
    });
    const aim = { x: 230, y: 120 };
    game.ticks(1, { aim });
    const events = game.ticks(1, { aim, fire: true });
    for (let i = 0; i < 240 && eventsOf(events, 'explosion').length === 0; i++) {
      events.push(...game.ticks(1, { aim }));
    }
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
    game.ticks(4, { aim });
    await expectGolden('run-mancuernas-blast', renderView(game.view));
  });

  const target: ScriptedSpawn = { kind: 'maletin-coptero', x: 360, y: 120 };
  const atTarget = { x: 372, y: 129 };

  it('run-codigo-penal: a law book rocket trailing smoke toward a Maletín-cóptero', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [weaponCrate('codigo-penal', ON_REXI.x, onRexi), target] },
    });
    game.ticks(1, { aim: atTarget });
    game.ticks(1, { aim: atTarget, fire: true });
    game.ticks(26, { aim: atTarget });
    const run = runOf(game.view);
    expect(run.rexi.weapon.id).toBe('codigo-penal');
    expect(run.projectiles.filter((p) => p.kind === 'law-book')).toHaveLength(1);
    await expectGolden('run-codigo-penal', renderView(game.view));
  });

  it('run-codigo-penal-blast: the law book blowing up its target', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [weaponCrate('codigo-penal', ON_REXI.x, onRexi), target] },
    });
    game.ticks(1, { aim: atTarget });
    const events = game.ticks(1, { aim: atTarget, fire: true });
    for (let i = 0; i < 120 && eventsOf(events, 'explosion').length === 0; i++) {
      events.push(...game.ticks(1, { aim: atTarget }));
    }
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
    game.ticks(3, { aim: atTarget });
    await expectGolden('run-codigo-penal-blast', renderView(game.view));
  });

  it('crates-explosive-weapons: Mancuernas and Código Penal Crates on the ground', async () => {
    const onGround = { y: defaultTuning.arena.groundY - defaultTuning.crates.size };
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [
          weaponCrate('mancuernas', 260, onGround),
          weaponCrate('codigo-penal', 320, onGround),
        ],
      },
    });
    game.seconds(1, { aim: { x: 300, y: 150 } });
    expect(runOf(game.view).crates.every((c) => c.landed)).toBe(true);
    await expectGolden('crates-explosive-weapons', renderView(game.view));
  });
});
