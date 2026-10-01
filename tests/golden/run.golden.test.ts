/**
 * Golden images of the Run. Views come from driving the real Game core with fixed seeds and
 * scripted spawns, never from hand-built view objects.
 */
import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn } from '../../src/core';
import { drive, ON_REXI, powerUpCrate, runOf, weaponCrate } from '../support/driver';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const maletin: ScriptedSpawn = { kind: 'maletin-coptero', x: 320, y: 70 };
const atMaletin = { x: 332, y: 79 };

describe('Run goldens', () => {
  it('run-idle: Rexi standing, aiming at a hovering Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    game.seconds(0.5, { aim: atMaletin });
    await expectGolden('run-idle', renderView(game.view));
  });

  it('run-firing: Mazo Automático gavels in flight toward the Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    game.seconds(0.3, { move: 1, aim: atMaletin });
    game.holdFireToward(atMaletin, 0.45);
    await expectGolden('run-firing', renderView(game.view));
  });

  it('arena-platform: the Arena with drifted clouds, Rexi standing on the left ledge', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [] } });
    const aim = { x: 300, y: 100 };
    game.ticks(1, { aim });
    game.seconds(0.45, { aim, move: -1, jump: true });
    game.seconds(4, { aim });
    const { rexi, arena } = game.view.run ?? expect.unreachable('no Run');
    expect(rexi.grounded).toBe(true);
    expect(rexi.y + rexi.h).toBe(arena.platforms[0]?.y);
    await expectGolden('arena-platform', renderView(game.view));
  });

  it('run-jump-aim-left: Rexi airborne, aiming up and to the left', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin] } });
    const aim = { x: 40, y: 30 };
    game.ticks(1, { jump: true, aim });
    game.seconds(0.25, { aim, move: -1, fire: true, jump: true });
    await expectGolden('run-jump-aim-left', renderView(game.view));
  });

  it('run-hud: HUD after destroying a Maletín-cóptero, a minute into the Run', async () => {
    const game = drive({
      seed: 1,
      overrides: { spawns: [maletin, { kind: 'maletin-coptero', x: 200, y: 50, atTick: 600 }] },
    });
    game.holdFireToward(atMaletin, 3);
    game.seconds(62.25, { aim: { x: 212, y: 59 } });
    await expectGolden('run-hud', renderView(game.view));
  });

  it('run-hurt: papers flying at a hurt Rexi, health bar down by the hits taken', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin],
        tuning: { enemies: { 'maletin-coptero': { fireIntervalMin: 0.7, fireIntervalMax: 0.9 } } },
      },
    });
    game.seconds(6.4, { aim: atMaletin });
    const { rexi } = game.view.run ?? {};
    expect(rexi?.health).toBeLessThan(rexi?.maxHealth ?? 0);
    expect(rexi?.invulnerableTicks).toBeGreaterThan(0);
    await expectGolden('run-hurt', renderView(game.view));
  });
});

describe('Crate goldens', () => {
  const groundY = defaultTuning.arena.groundY;
  const crateSize = defaultTuning.crates.size;

  it('crate-falling: a Lluvia de Sellos Crate under its parachute', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [weaponCrate('lluvia-de-sellos', 300)] } });
    game.seconds(2, { aim: { x: 309, y: 110 } });
    await expectGolden('crate-falling', renderView(game.view));
  });

  it('crate-blinking: two landed Crates near expiry, one in a flash frame', async () => {
    const onGround = { y: groundY - crateSize };
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [
          weaponCrate('lluvia-de-sellos', 260, onGround),
          weaponCrate('lluvia-de-sellos', 320, { ...onGround, atTick: 6 }),
        ],
      },
    });
    game.ticks(451, { aim: { x: 300, y: 200 } });
    const [flashing, steady] = runOf(game.view).crates;
    expect(flashing).toMatchObject({ blinking: true, ticksLeft: 150 });
    expect(steady).toMatchObject({ blinking: true, ticksLeft: 156 });
    await expectGolden('crate-blinking', renderView(game.view));
  });

  it('run-hud-sellos: HUD with the Lluvia de Sellos selected, stamps in flight', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [weaponCrate('lluvia-de-sellos', ON_REXI.x, { y: ON_REXI.y }), maletin],
      },
    });
    const aim = { x: 190, y: 150 };
    game.ticks(1, { aim });
    game.holdFireToward(aim, 1.6);
    game.ticks(6, { aim });
    expect(runOf(game.view).rexi.weapon).toEqual({ id: 'lluvia-de-sellos', ammo: 17 });
    await expectGolden('run-hud-sellos', renderView(game.view));
  });
});

describe('Power-up goldens', () => {
  const onRexi = { y: ON_REXI.y };

  it('run-power-ups: Inmunidad Judicial glow, papers passing through, two HUD timers', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [
          maletin,
          powerUpCrate('inmunidad-judicial', ON_REXI.x, onRexi),
          powerUpCrate('creatina', ON_REXI.x, { ...onRexi, atTick: 90 }),
        ],
        tuning: {
          enemies: {
            'maletin-coptero': { fireIntervalMin: 0.6, fireIntervalMax: 0.6, aimError: 0 },
          },
        },
      },
    });
    game.seconds(3.1, { aim: atMaletin });
    const { rexi } = runOf(game.view);
    expect(rexi.health).toBe(rexi.maxHealth);
    expect(rexi.powerUps.map((p) => p.id)).toEqual(['inmunidad-judicial', 'creatina']);
    expect(runOf(game.view).projectiles.some((p) => p.owner === 'enemy')).toBe(true);
    await expectGolden('run-power-ups', renderView(game.view));
  });

  it('crate-power-ups: a Crate for each Power-up, falling', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [
          powerUpCrate('receso', 200),
          powerUpCrate('inmunidad-judicial', 270),
          powerUpCrate('creatina', 340),
        ],
      },
    });
    game.seconds(2, { aim: { x: 300, y: 200 } });
    await expectGolden('crate-power-ups', renderView(game.view));
  });
});
