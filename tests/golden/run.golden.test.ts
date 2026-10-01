/**
 * Golden images of the Run. Views come from driving the real Game core with fixed seeds and
 * scripted spawns, never from hand-built view objects.
 */
import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn } from '../../src/core';
import { drive, ON_REXI, powerUpCrate, runOf, weaponCrate } from '../support/driver';
import { holdStill } from '../support/fixtures';
import { renderView } from '../support/render-node';
import { expectGolden } from './golden';

const maletin: ScriptedSpawn = { kind: 'maletin-coptero', x: 320, y: 70 };
const atMaletin = { x: 332, y: 79 };

describe('Run goldens', () => {
  it('run-idle: Rexi standing, aiming at a hovering Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: holdStill() } });
    game.seconds(0.5, { aim: atMaletin });
    await expectGolden('run-idle', renderView(game.view));
  });

  it('run-firing: Mazo Automático gavels in flight toward the Maletín-cóptero', async () => {
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: holdStill() } });
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
    const game = drive({ seed: 1, overrides: { spawns: [maletin], tuning: holdStill() } });
    const aim = { x: 40, y: 30 };
    game.ticks(1, { jump: true, aim });
    game.seconds(0.25, { aim, move: -1, fire: true, jump: true });
    await expectGolden('run-jump-aim-left', renderView(game.view));
  });

  it('run-hud: HUD after destroying a Maletín-cóptero, a minute into the Run', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin, { kind: 'maletin-coptero', x: 200, y: 50, atTick: 600 }],
        tuning: holdStill(),
      },
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
        tuning: holdStill({
          enemies: { 'maletin-coptero': { fireIntervalMin: 0.7, fireIntervalMax: 0.9 } },
        }),
      },
    });
    game.seconds(5, { aim: atMaletin });
    // Catch Rexi just after his next hit, while he still flickers.
    for (let t = 0; !game.ticks(1, { aim: atMaletin }).some((e) => e.type === 'rexi-hit'); t++) {
      if (t > 600) throw new Error('Rexi was never hit');
    }
    game.ticks(10, { aim: atMaletin });
    const { rexi } = game.view.run ?? {};
    expect(rexi?.health).toBeLessThan(rexi?.maxHealth ?? 0);
    expect(rexi?.invulnerableTicks).toBeGreaterThan(0);
    await expectGolden('run-hurt', renderView(game.view));
  });

  it('enemy-maletin-coptero: final sprite facing Rexi from both sides, rotors spinning', async () => {
    const game = drive({
      seed: 2,
      overrides: {
        spawns: [
          { kind: 'maletin-coptero', x: 60, y: 120 },
          { kind: 'maletin-coptero', x: 250, y: 90 },
          { kind: 'maletin-coptero', x: 380, y: 50, atTick: 1 },
        ],
        tuning: holdStill({
          enemies: { 'maletin-coptero': { fireIntervalMin: 9, fireIntervalMax: 9 } },
        }),
      },
    });
    game.seconds(0.5, { aim: { x: 262, y: 99 } });
    await expectGolden('enemy-maletin-coptero', renderView(game.view));
  });

  it('enemy-archivador-artillado: patrolling, arming a drop, and a drawer bomb falling', async () => {
    const game = drive({
      seed: 3,
      overrides: {
        spawns: [
          // Dropped its drawer 30 ticks before the snapshot.
          { kind: 'archivador-artillado', x: 150, y: 40 },
          // Most of the way through lowering its drawer out of the bomb bay.
          { kind: 'archivador-artillado', x: 300, y: 30, atTick: 35 },
          // Still waiting for its first drop.
          { kind: 'archivador-artillado', x: 56, y: 50, atTick: 70 },
          // Next to the Maletín-cóptero, for scale.
          { kind: 'maletin-coptero', x: 400, y: 96 },
        ],
        tuning: holdStill({
          rexi: { maxHealth: 1_000_000 },
          enemies: {
            'archivador-artillado': { dropRange: 480 },
            'maletin-coptero': { fireIntervalMin: 9, fireIntervalMax: 9 },
          },
        }),
      },
    });
    game.ticks(111, { aim: { x: 412, y: 105 } });
    const [falling, arming, waiting] = runOf(game.view).enemies.filter(
      (e) => e.kind === 'archivador-artillado',
    );
    expect(falling?.pose).toEqual({ facing: null, attack: 'idle', windup: 0 });
    expect(arming?.pose.attack).toBe('windup');
    expect(arming?.pose.windup).toBeGreaterThan(0.6);
    expect(arming?.pose.windup).toBeLessThan(0.9);
    expect(waiting?.pose.windup).toBe(0);
    expect(runOf(game.view).projectiles.filter((p) => p.kind === 'drawer')).toHaveLength(1);
    await expectGolden('enemy-archivador-artillado', renderView(game.view));
  });

  it('enemy-caminadora-a-reaccion: strafing both ways, winding up, and firing a burst', async () => {
    const kind = 'caminadora-a-reaccion';
    const game = drive({
      seed: 2,
      overrides: {
        spawns: [
          { kind, x: 40, y: 60 },
          { kind, x: 400, y: 128, atTick: 10 },
          { kind, x: 20, y: 96, atTick: 40 },
        ],
        tuning: { enemies: { [kind]: { fireIntervalMin: 1, fireIntervalMax: 1 } } },
      },
    });
    // Rexi runs right, so the first one turns toward him and the second keeps facing him.
    game.ticks(86, { move: 1, aim: { x: 360, y: 80 } });
    const poses = runOf(game.view).enemies.map((e) => e.pose);
    expect(poses).toMatchObject([
      { facing: 1, attack: 'firing', windup: 0 },
      { facing: -1, attack: 'windup' },
      { facing: 1, attack: 'idle', windup: 0 },
    ]);
    expect(poses[1]?.windup).toBeGreaterThan(0);
    await expectGolden('enemy-caminadora-a-reaccion', renderView(game.view));
  });

  it('enemy-banca-artillada: the gunship facing Rexi from both sides, rotors turning', async () => {
    const game = drive({
      seed: 2,
      overrides: {
        spawns: [
          { kind: 'banca-artillada', x: 24, y: 40 },
          { kind: 'banca-artillada', x: 300, y: 64, atTick: 1 },
        ],
        tuning: holdStill({ enemies: { 'banca-artillada': { firstVolleyDelay: 99 } } }),
      },
    });
    game.seconds(0.5, { aim: { x: 328, y: 79 } });
    await expectGolden('enemy-banca-artillada', renderView(game.view));
  });

  it('banca-windup: the pods glowing white-hot just before a volley', async () => {
    const banca = defaultTuning.enemies['banca-artillada'];
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [{ kind: 'banca-artillada', x: 300, y: 50 }],
        tuning: holdStill({ enemies: { 'banca-artillada': { firstVolleyDelay: 0.5 } } }),
      },
    });
    const aim = { x: 328, y: 65 };
    game.seconds(0.5 + banca.volleyWindup * 0.9, { aim });
    const pose = runOf(game.view).enemies[0]?.pose;
    expect(pose?.attack).toBe('windup');
    expect(pose?.windup).toBeGreaterThan(0.8);
    await expectGolden('banca-windup', renderView(game.view));
  });

  it('banca-volley: a rocket volley fanning out of the pods, flames and smoke trails', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [{ kind: 'banca-artillada', x: 300, y: 50 }],
        tuning: holdStill({ enemies: { 'banca-artillada': { firstVolleyDelay: 0.5 } } }),
      },
    });
    const aim = { x: 328, y: 65 };
    // Past the windup (the pods glowing), most of the way through the volley.
    game.seconds(0.5 + defaultTuning.enemies['banca-artillada'].volleyWindup, { aim });
    game.ticks(32, { aim });
    const rockets = runOf(game.view).projectiles.filter((p) => p.kind === 'rocket');
    expect(rockets).toHaveLength(defaultTuning.enemies['banca-artillada'].volleySize);
    await expectGolden('banca-volley', renderView(game.view));
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
        tuning: holdStill(),
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
          powerUpCrate('receso', 180),
          powerUpCrate('inmunidad-judicial', 235),
          powerUpCrate('creatina', 290),
          powerUpCrate('pre-entreno', 345),
          powerUpCrate('dia-de-pierna', 400),
        ],
      },
    });
    game.seconds(2, { aim: { x: 300, y: 200 } });
    await expectGolden('crate-power-ups', renderView(game.view));
  });

  it('run-pre-entreno: the slowed world tinted, speed lines behind a running Rexi', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin, powerUpCrate('pre-entreno', ON_REXI.x, onRexi)],
        tuning: holdStill({
          enemies: {
            'maletin-coptero': { fireIntervalMin: 0.4, fireIntervalMax: 0.4, aimError: 0 },
          },
        }),
      },
    });
    game.seconds(2.5, { aim: atMaletin });
    game.seconds(0.4, { move: 1, aim: atMaletin });
    const { rexi, projectiles } = runOf(game.view);
    expect(rexi.powerUps.map((p) => p.id)).toEqual(['pre-entreno']);
    expect(projectiles.some((p) => p.owner === 'enemy')).toBe(true);
    await expectGolden('run-pre-entreno', renderView(game.view));
  });

  it('run-dia-de-pierna: Rexi flying on a jet trail from his legs', async () => {
    const game = drive({
      seed: 1,
      overrides: {
        spawns: [maletin, powerUpCrate('dia-de-pierna', ON_REXI.x, onRexi)],
        tuning: holdStill(),
      },
    });
    game.seconds(0.6, { jump: true, move: 1, aim: atMaletin });
    const { rexi } = runOf(game.view);
    expect(rexi.flying).toBe(true);
    expect(rexi.powerUps.map((p) => p.id)).toEqual(['dia-de-pierna']);
    await expectGolden('run-dia-de-pierna', renderView(game.view));
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
        tuning: holdStill(),
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
