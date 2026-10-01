/** Mancuernas: lobbed dumbbells that bounce once and explode with splash damage. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  DT,
  WEAPON_IDS,
  type GameEvent,
  type ProjectileView,
  type ScriptedSpawn,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import { driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';

const mancuernas = defaultTuning.weapons.mancuernas;
const maletin = defaultTuning.enemies['maletin-coptero'];
const groundY = defaultTuning.arena.groundY;
const mancuernasCrate = weaponCrate('mancuernas', ON_REXI.x, { y: ON_REXI.y });

/** Rexi holding the Mancuernas, plus any Enemies. */
const armed = (enemies: readonly ScriptedSpawn[] = [], tuning?: TuningOverrides) => {
  const game = driveEmptyArena({ overrides: { spawns: [mancuernasCrate, ...enemies], tuning } });
  game.ticks(1);
  expect(runOf(game.view).rexi.weapon.id).toBe('mancuernas');
  return game;
};

const dumbbells = (game: ReturnType<typeof armed>): ProjectileView[] =>
  runOf(game.view).projectiles.filter((p) => p.kind === 'dumbbell');

/** An aim point 45° above the horizontal, to the right of Rexi's shoulder. */
const aimUpRight = (game: ReturnType<typeof armed>): Vec2 => {
  const { shoulder } = runOf(game.view).rexi;
  return { x: shoulder.x + 100, y: shoulder.y - 100 };
};

/** Fires one dumbbell and follows it tick by tick until it is gone (at most `seconds`). */
function followThrow(game: ReturnType<typeof armed>, aim: Vec2, seconds = 4) {
  const events: GameEvent[] = [...game.ticks(1, { aim, fire: true })];
  const path: ProjectileView[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    const [dumbbell] = dumbbells(game);
    if (!dumbbell) break;
    path.push(dumbbell);
    events.push(...game.ticks(1, { aim }));
  }
  return { events, path };
}

/** Number of times the dumbbell turned from falling to rising: its bounces. */
const bouncesIn = (path: readonly ProjectileView[]) =>
  path.slice(1).filter((p, i) => (path[i]?.vy ?? 0) > 0 && p.vy < 0).length;

describe('Mancuernas', () => {
  it('lobs one dumbbell per trigger pull along the aim', () => {
    const game = armed();
    const aim = aimUpRight(game);
    const events = game.ticks(1, { aim, fire: true });
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'mancuernas' },
    ]);

    const [dumbbell, ...others] = dumbbells(game);
    expect(others).toHaveLength(0);
    expect(dumbbell?.owner).toBe('rexi');
    const { aimDirection } = runOf(game.view).rexi;
    expect(dumbbell?.vx).toBeCloseTo(aimDirection.x * mancuernas.launchSpeed, 6);
    // One tick of its own gravity has already pulled it down.
    expect(dumbbell?.vy).toBeCloseTo(
      aimDirection.y * mancuernas.launchSpeed + mancuernas.gravity * DT,
      6,
    );
    expect(runOf(game.view).rexi.weapon.ammo).toBe(mancuernas.pickupAmmo - 1);
  });

  it('flies on an arc: it rises, slows down under gravity and falls', () => {
    const game = armed();
    const { path } = followThrow(game, aimUpRight(game));
    const first = path[0];
    const later = path[30];
    if (!first || !later) throw new Error('The dumbbell landed too soon');

    // Horizontal speed is constant in the air; vertical speed grows by its gravity.
    expect(later.vx).toBeCloseTo(first.vx, 6);
    expect(later.vy - first.vy).toBeCloseTo(mancuernas.gravity * 0.5, 6);

    const apex = Math.min(...path.map((p) => p.y));
    expect(apex).toBeLessThan(first.y - 20);
    const apexIndex = path.findIndex((p) => p.y === apex);
    expect(path[apexIndex - 1]?.vy).toBeLessThan(0);
    expect(path[apexIndex + 1]?.vy).toBeGreaterThan(0);
  });

  it('bounces once on the ground, then explodes when it lands again', () => {
    const game = armed();
    const { events, path } = followThrow(game, aimUpRight(game));

    expect(bouncesIn(path)).toBe(1);
    const bounce = path.findIndex((p, i) => (path[i - 1]?.vy ?? 0) > 0 && p.vy < 0);
    const before = path[bounce - 1];
    const after = path[bounce];
    if (!before || !after) throw new Error('No bounce');
    expect(after.y + after.h).toBeCloseTo(groundY, 6);
    expect(-after.vy).toBeCloseTo(
      (before.vy + mancuernas.gravity * DT) * mancuernas.restitution,
      6,
    );

    const explosions = eventsOf(events, 'explosion');
    expect(explosions).toHaveLength(1);
    expect(explosions[0]).toMatchObject({ weapon: 'mancuernas', radius: mancuernas.splashRadius });
    expect(explosions[0]?.y).toBeCloseTo(groundY - mancuernas.projectileSize / 2, 6);
    expect(explosions[0]?.x).toBeGreaterThan(after.x);
    expect(dumbbells(game)).toHaveLength(0);
  });

  it('bounces off a platform it falls onto', () => {
    const ledge = defaultTuning.arena.platforms[0];
    if (!ledge) throw new Error('Expected the low left ledge');
    const game = armed();
    // Turn left, then lob steeply (75° up) so it comes down on the low left ledge.
    game.ticks(1, { aim: { x: 0, y: 100 } });
    const { shoulder } = runOf(game.view).rexi;
    const angle = (75 * Math.PI) / 180;
    const aim = { x: shoulder.x - Math.cos(angle) * 100, y: shoulder.y - Math.sin(angle) * 100 };
    const { path, events } = followThrow(game, aim);

    const firstBounce = path.find((p, i) => (path[i - 1]?.vy ?? 0) > 0 && p.vy < 0);
    expect(firstBounce?.y).toBeCloseTo(ledge.y - mancuernas.projectileSize, 6);
    expect(firstBounce?.x).toBeGreaterThan(ledge.x - mancuernas.projectileSize);
    expect(firstBounce?.x).toBeLessThan(ledge.x + ledge.w);
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
  });

  it('explodes in the air when its fuse runs out', () => {
    const fuse = 0.25;
    const game = armed([], { weapons: { mancuernas: { fuse } } });
    const { events, path } = followThrow(game, aimUpRight(game));
    expect(path).toHaveLength(Math.round(fuse * 60) - 1);
    expect(bouncesIn(path)).toBe(0);
    const [explosion] = eventsOf(events, 'explosion');
    expect(explosion?.y).toBeLessThan(groundY - 20);
  });

  it('explodes on an Enemy it hits: impact damage plus full splash', () => {
    const probe = armed();
    // Aiming level, the dumbbell leaves at shoulder height.
    const { shoulder } = runOf(probe.view).rexi;
    const target: ScriptedSpawn = {
      kind: 'maletin-coptero',
      x: shoulder.x + 40,
      y: shoulder.y - maletin.height / 2,
    };
    const game = armed([target]);
    const { events } = followThrow(game, { x: shoulder.x + 100, y: shoulder.y });

    const hits = eventsOf(events, 'enemy-hit').map((e) => e.damage);
    expect(hits).toEqual([mancuernas.damage, mancuernas.splashDamage]);
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
    expect(eventsOf(events, 'enemy-destroyed')).toHaveLength(1);
    expect(dumbbells(game)).toHaveLength(0);
  });

  it('hurts Enemies near the blast, less at the edge, and spares those outside it', () => {
    // Where does an undisturbed throw explode?
    const probe = armed();
    const aim = aimUpRight(probe);
    const [blast] = eventsOf(followThrow(probe, aim).events, 'explosion');
    if (!blast) throw new Error('The probe throw did not explode');

    // One Enemy just beside the blast (never in the dumbbell's way), one far away.
    const near: ScriptedSpawn = { kind: 'maletin-coptero', x: blast.x + 6, y: blast.y - 26 };
    const far: ScriptedSpawn = { kind: 'maletin-coptero', x: blast.x + 80, y: blast.y - 26 };
    const game = armed([near, far]);
    const ids = eventsOf(game.log, 'enemy-spawned').map((e) => e.enemyId);
    const { events } = followThrow(game, aim);

    expect(eventsOf(events, 'explosion')).toEqual([blast]);
    const hits = eventsOf(events, 'enemy-hit');
    expect(hits.map((e) => e.enemyId)).toEqual([ids[0]]);
    const damage = hits[0]?.damage ?? 0;
    expect(damage).toBeGreaterThanOrEqual(mancuernas.splashDamage * mancuernas.splashEdge);
    expect(damage).toBeLessThanOrEqual(mancuernas.splashDamage);
  });

  it('never hurts Rexi, even exploding at his feet', () => {
    const game = armed();
    const { rexi } = runOf(game.view);
    const { events } = followThrow(game, { x: rexi.muzzle.x + 4, y: groundY + 40 });
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(0);
    expect(runOf(game.view).rexi.health).toBe(rexi.maxHealth);
  });

  it('blows up with an explosion effect', () => {
    const game = armed();
    const { events } = followThrow(game, aimUpRight(game));
    expect(eventsOf(events, 'explosion')).toHaveLength(1);
    expect(runOf(game.view).effects.particles.some((p) => p.kind === 'flash')).toBe(true);
  });

  it('comes in Crates and takes inventory slot 3', () => {
    expect(defaultTuning.crates.weights.weapons.mancuernas).toBeGreaterThan(0);
    expect(WEAPON_IDS.indexOf('mancuernas') + 1).toBe(3);
  });
});
