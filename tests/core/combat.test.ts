import { describe, expect, it } from 'vitest';
import { defaultTuning, type ScriptedSpawn } from '../../src/core';
import { drive, driveEmptyArena, eventsOf, runOf } from '../support/driver';

const mazo = defaultTuning.weapons['mazo-automatico'];
const maletin = defaultTuning.enemies['maletin-coptero'];

const maletinAt = (x: number, y: number, atTick = 0): ScriptedSpawn => ({
  kind: 'maletin-coptero',
  x,
  y,
  atTick,
});

/** Aim point at the center of a Maletín-cóptero spawned at (x, y). */
const centerOf = (x: number, y: number) => ({
  x: x + maletin.width / 2,
  y: y + maletin.height / 2,
});

describe('Firing the Mazo Automático', () => {
  it('fires while the trigger is held, at the tuned fire rate', () => {
    const game = driveEmptyArena();
    const events = game.holdFireToward({ x: 400, y: 50 }, 3);
    const shots = eventsOf(events, 'weapon-fired');
    expect(shots.length).toBeGreaterThanOrEqual(Math.floor(3 / mazo.fireInterval) - 1);
    expect(shots.length).toBeLessThanOrEqual(Math.ceil(3 / mazo.fireInterval) + 1);
    expect(new Set(shots.map((s) => s.weapon))).toEqual(new Set(['mazo-automatico']));
  });

  it('fires immediately on the first tick of a trigger pull', () => {
    const game = driveEmptyArena();
    expect(eventsOf(game.ticks(1, { fire: true }), 'weapon-fired')).toHaveLength(1);
  });

  it('does not fire without the trigger', () => {
    const game = driveEmptyArena();
    expect(eventsOf(game.seconds(2, { aim: { x: 400, y: 50 } }), 'weapon-fired')).toHaveLength(0);
    expect(runOf(game.view).projectiles).toHaveLength(0);
  });

  it('has unlimited ammo', () => {
    const game = driveEmptyArena();
    const shots = eventsOf(game.holdFireToward({ x: 400, y: 50 }, 60), 'weapon-fired');
    expect(shots.length).toBeGreaterThan(400);
    expect(runOf(game.view).rexi.weapon).toEqual({ id: 'mazo-automatico', ammo: null });
  });

  it('sends gavels from the muzzle toward the aim point', () => {
    const game = driveEmptyArena();
    const target = { x: 400, y: 40 };
    game.ticks(1, { aim: target, fire: true });
    game.ticks(10, { aim: target });

    const run = runOf(game.view);
    expect(run.projectiles).toHaveLength(1);
    const gavel = run.projectiles[0];
    expect(gavel?.kind).toBe('gavel');
    expect(gavel?.owner).toBe('rexi');

    const { muzzle } = run.rexi;
    const toTarget = { x: target.x - muzzle.x, y: target.y - muzzle.y };
    const velocity = { x: gavel?.vx ?? 0, y: gavel?.vy ?? 0 };
    // Parallel and same direction: zero cross product, positive dot product.
    expect(toTarget.x * velocity.y - toTarget.y * velocity.x).toBeCloseTo(0, 3);
    expect(toTarget.x * velocity.x + toTarget.y * velocity.y).toBeGreaterThan(0);
    expect(Math.hypot(velocity.x, velocity.y)).toBeCloseTo(mazo.projectileSpeed, 3);
  });

  it('removes gavels once they leave the screen', () => {
    const game = driveEmptyArena();
    game.ticks(1, { aim: { x: 479, y: 0 }, fire: true });
    game.seconds(3);
    expect(runOf(game.view).projectiles).toHaveLength(0);
  });
});

describe('Destroying the Maletín-cóptero', () => {
  it('spawns scripted Enemies at their tick and position', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60, 30)] } });
    game.ticks(30);
    expect(runOf(game.view).enemies).toHaveLength(0);

    const spawned = eventsOf(game.ticks(1), 'enemy-spawned');
    expect(spawned).toEqual([expect.objectContaining({ kind: 'maletin-coptero' })]);
    const [enemy] = runOf(game.view).enemies;
    expect(enemy).toMatchObject({ kind: 'maletin-coptero', craft: 'lawyer', x: 300 });
    expect(enemy?.health).toBe(maletin.health);
  });

  it('hovers in place', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)] } });
    const ys: number[] = [];
    for (let i = 0; i < 120; i++) {
      game.ticks(1);
      ys.push(runOf(game.view).enemies[0]?.y ?? NaN);
    }
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(maletin.hoverAmplitude);
    expect(Math.max(...ys)).toBeLessThanOrEqual(60 + maletin.hoverAmplitude + 1e-9);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(60 - maletin.hoverAmplitude - 1e-9);
    expect(runOf(game.view).enemies[0]?.x).toBe(300);
  });

  it('takes damage from each gavel that hits it', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)] } });
    const events = game.holdFireToward(centerOf(300, 60), 1);
    const hits = eventsOf(events, 'enemy-hit');
    expect(hits.length).toBeGreaterThan(0);
    expect(new Set(hits.map((h) => `${h.kind}:${h.damage}`))).toEqual(
      new Set([`maletin-coptero:${mazo.damage}`]),
    );
    expect(runOf(game.view).enemies[0]?.health).toBe(maletin.health - hits.length * mazo.damage);
  });

  it('is destroyed after enough hits, emitting enemy-destroyed once', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)] } });
    const events = game.holdFireToward(centerOf(300, 60), 5);

    const hits = eventsOf(events, 'enemy-hit');
    expect(hits).toHaveLength(Math.ceil(maletin.health / mazo.damage));
    const destroyed = eventsOf(events, 'enemy-destroyed');
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({
      kind: 'maletin-coptero',
      craft: 'lawyer',
      points: maletin.points,
    });
    expect(destroyed[0]?.x).toBeCloseTo(300 + maletin.width / 2, 0);

    const run = runOf(game.view);
    expect(run.enemies).toHaveLength(0);
    expect(run.stats.score).toBe(maletin.points);
    expect(run.stats.enemiesDestroyed).toBe(1);
  });

  it('needs fewer hits when the Weapon damage is tuned up', () => {
    const game = drive({
      overrides: {
        spawns: [maletinAt(300, 60)],
        tuning: { weapons: { 'mazo-automatico': { damage: 4 } } },
      },
    });
    const events = game.holdFireToward(centerOf(300, 60), 5);
    expect(eventsOf(events, 'enemy-hit')).toHaveLength(Math.ceil(maletin.health / 4));
    expect(eventsOf(events, 'enemy-destroyed')).toHaveLength(1);
  });

  it('is not hurt by shots that miss', () => {
    const game = drive({ overrides: { spawns: [maletinAt(300, 60)] } });
    const events = game.holdFireToward({ x: 0, y: 0 }, 3);
    expect(eventsOf(events, 'enemy-hit')).toHaveLength(0);
    expect(runOf(game.view).enemies[0]?.health).toBe(maletin.health);
  });

  it('appears on its own in a default Run (before the spawn Director exists)', () => {
    const game = drive();
    const events = game.ticks(1);
    expect(eventsOf(events, 'enemy-spawned')).toHaveLength(1);
    expect(runOf(game.view).enemies.map((e) => e.kind)).toEqual(['maletin-coptero']);
  });
});
