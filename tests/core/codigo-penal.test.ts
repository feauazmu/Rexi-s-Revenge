/** Código Penal: a law book fired as a straight rocket with splash damage. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  WEAPON_IDS,
  type GameEvent,
  type ProjectileView,
  type ScriptedSpawn,
  type Vec2,
} from '../../src/core';
import { driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';

const codigo = defaultTuning.weapons['codigo-penal'];
const maletin = defaultTuning.enemies['maletin-coptero'];
const groundY = defaultTuning.arena.groundY;
const codigoCrate = weaponCrate('codigo-penal', ON_REXI.x, { y: ON_REXI.y });

/** Rexi holding the Código Penal, plus any Enemies. */
const armed = (enemies: readonly ScriptedSpawn[] = []) => {
  const game = driveEmptyArena({ overrides: { spawns: [codigoCrate, ...enemies] } });
  game.ticks(1);
  expect(runOf(game.view).rexi.weapon.id).toBe('codigo-penal');
  return game;
};

type Armed = ReturnType<typeof armed>;

const books = (game: Armed): ProjectileView[] =>
  runOf(game.view).projectiles.filter((p) => p.kind === 'law-book');

const speedOf = (p: ProjectileView) => Math.hypot(p.vx, p.vy);
const centerOf = (p: ProjectileView): Vec2 => ({ x: p.x + p.w / 2, y: p.y + p.h / 2 });

/** Fires one book and follows it tick by tick until it is gone (at most `seconds`). */
function followShot(game: Armed, aim: Vec2, seconds = 4) {
  const events: GameEvent[] = [...game.ticks(1, { aim, fire: true })];
  const path: ProjectileView[] = [];
  for (let i = 0; i < seconds * 60; i++) {
    const [book] = books(game);
    if (!book) break;
    path.push(book);
    events.push(...game.ticks(1, { aim }));
  }
  return { events, path };
}

/** Level to the right, at shoulder height. */
const aimRight = (game: Armed): Vec2 => {
  const { shoulder } = runOf(game.view).rexi;
  return { x: shoulder.x + 200, y: shoulder.y };
};

describe('Código Penal', () => {
  it('fires one law book per trigger pull, leaving slowly along the aim', () => {
    const game = armed();
    const aim = { x: 400, y: 60 };
    const events = game.ticks(1, { aim, fire: true });
    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'codigo-penal' },
    ]);
    const [book, ...others] = books(game);
    if (!book) throw new Error('No law book');
    expect(others).toHaveLength(0);
    expect(book.owner).toBe('rexi');
    expect(speedOf(book)).toBeCloseTo(codigo.launchSpeed + codigo.acceleration / 60, 6);
    const { aimDirection } = runOf(game.view).rexi;
    expect(book.vx / speedOf(book)).toBeCloseTo(aimDirection.x, 6);
    expect(book.vy / speedOf(book)).toBeCloseTo(aimDirection.y, 6);
    expect(runOf(game.view).rexi.weapon.ammo).toBe(codigo.pickupAmmo - 1);
  });

  it('flies in a straight line, accelerating up to its top speed', () => {
    const game = armed();
    const aim = { x: 400, y: 60 };
    const { path } = followShot(game, aim);
    const first = path[0];
    if (!first || path.length < 60) throw new Error('The law book vanished too soon');

    // Every position lies on the line of the first velocity (no gravity, no drift).
    const start = centerOf(first);
    const heading = { x: first.vx / speedOf(first), y: first.vy / speedOf(first) };
    for (const p of path) {
      const c = centerOf(p);
      const across = (c.x - start.x) * heading.y - (c.y - start.y) * heading.x;
      expect(Math.abs(across)).toBeLessThan(1e-6);
    }

    const quarter = path[15];
    expect(quarter && speedOf(quarter)).toBeCloseTo(
      codigo.launchSpeed + codigo.acceleration * (16 / 60),
      6,
    );
    for (const [i, p] of path.entries()) {
      if (i > 0) expect(speedOf(p)).toBeGreaterThanOrEqual(speedOf(path[i - 1] ?? p) - 1e-9);
      expect(speedOf(p)).toBeLessThanOrEqual(codigo.maxSpeed + 1e-9);
    }
    expect(speedOf(path[59] ?? first)).toBeCloseTo(codigo.maxSpeed, 6);
  });

  it('leaves a smoke trail', () => {
    const game = armed();
    followShot(game, { x: 400, y: 60 }, 0.5);
    expect(runOf(game.view).effects.particles.some((p) => p.kind === 'smoke')).toBe(true);
  });

  it('explodes on the first Enemy it hits, with splash on its neighbors only', () => {
    const probe = armed();
    // Aiming level, the book flies at shoulder height.
    const { shoulder } = runOf(probe.view).rexi;
    const line = shoulder.y;
    // A target on the line of fire, a neighbor just above it, and one well out of reach.
    const target: ScriptedSpawn = {
      kind: 'maletin-coptero',
      x: shoulder.x + 160,
      y: line - maletin.height / 2,
    };
    const neighbor: ScriptedSpawn = { ...target, y: target.y - maletin.height - 6 };
    const distant: ScriptedSpawn = { ...target, y: target.y - maletin.height - 60 };

    const game = armed([target, neighbor, distant]);
    const [targetId, neighborId] = eventsOf(game.log, 'enemy-spawned').map((e) => e.enemyId);
    const { events } = followShot(game, { x: shoulder.x + 200, y: line });

    const hits = eventsOf(events, 'enemy-hit');
    expect(hits.filter((h) => h.enemyId === targetId).map((h) => h.damage)).toEqual([
      codigo.damage,
      codigo.splashDamage,
    ]);
    const neighborHits = hits.filter((h) => h.enemyId === neighborId);
    expect(neighborHits).toHaveLength(1);
    const splash = neighborHits[0]?.damage ?? 0;
    expect(splash).toBeGreaterThanOrEqual(codigo.splashDamage * codigo.splashEdge);
    expect(splash).toBeLessThanOrEqual(codigo.splashDamage);
    expect(hits).toHaveLength(3);

    const explosions = eventsOf(events, 'explosion');
    expect(explosions).toHaveLength(1);
    expect(explosions[0]).toMatchObject({ weapon: 'codigo-penal', radius: codigo.splashRadius });
    expect(explosions[0]?.x).toBeLessThan(target.x + maletin.width / 2);
    expect(books(game)).toHaveLength(0);
  });

  it('explodes where it hits the ground, without hurting Rexi', () => {
    const game = armed();
    const { rexi } = runOf(game.view);
    const { events } = followShot(game, { x: rexi.muzzle.x + 40, y: groundY + 20 });
    const [explosion, ...more] = eventsOf(events, 'explosion');
    expect(more).toHaveLength(0);
    expect(explosion?.y).toBeCloseTo(groundY - codigo.projectileSize / 2, 6);
    expect(eventsOf(events, 'rexi-hit')).toHaveLength(0);
    expect(runOf(game.view).rexi.health).toBe(rexi.maxHealth);
  });

  it('leaves the screen quietly when it hits nothing', () => {
    const game = armed();
    const { events, path } = followShot(game, aimRight(game));
    expect(path.length).toBeGreaterThan(10);
    expect(books(game)).toHaveLength(0);
    expect(eventsOf(events, 'explosion')).toHaveLength(0);
  });

  it('comes in Crates and takes inventory slot 4', () => {
    expect(defaultTuning.crates.weights.weapons['codigo-penal']).toBeGreaterThan(0);
    expect(WEAPON_IDS.indexOf('codigo-penal') + 1).toBe(4);
  });
});
