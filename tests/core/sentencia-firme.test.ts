/** Sentencia Firme: an instant beam that pierces every Enemy along its line. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  SCREEN_WIDTH,
  SPECIAL_WEAPON_IDS,
  secondsToTicks,
  type ScriptedSpawn,
  type TuningOverrides,
  type Vec2,
} from '../../src/core';
import { drive, driveEmptyArena, eventsOf, ON_REXI, runOf, weaponCrate } from '../support/driver';
import { holdStill } from '../support/fixtures';

const sentencia = defaultTuning.weapons['sentencia-firme'];
const maletin = defaultTuning.enemies['maletin-coptero'];
const beamEffect = defaultTuning.effects.beam;
const groundY = defaultTuning.arena.groundY;
const sentenciaCrate = weaponCrate('sentencia-firme', ON_REXI.x, { y: ON_REXI.y });

/** Rexi holding the Sentencia Firme, plus any Enemies (held still unless `tuning` says otherwise). */
const armed = (enemies: readonly ScriptedSpawn[] = [], tuning: TuningOverrides = holdStill()) => {
  const game = driveEmptyArena({ overrides: { spawns: [sentenciaCrate, ...enemies], tuning } });
  game.ticks(1);
  expect(runOf(game.view).rexi.weapon).toEqual({
    id: 'sentencia-firme',
    ammo: sentencia.pickupAmmo,
  });
  return game;
};

/** Where Rexi's muzzle is when he aims at `aim` (from a probe Run with the same setup). */
function muzzleAiming(aim: Vec2): Vec2 {
  const probe = armed();
  probe.ticks(1, { aim });
  return runOf(probe.view).rexi.muzzle;
}

/** Maletín-cópteros centered on the line from the muzzle toward `aim`, at these distances. */
function onTheLine(aim: Vec2, distances: readonly number[]): ScriptedSpawn[] {
  const muzzle = muzzleAiming(aim);
  const length = Math.hypot(aim.x - muzzle.x, aim.y - muzzle.y);
  const d = { x: (aim.x - muzzle.x) / length, y: (aim.y - muzzle.y) / length };
  return distances.map((distance) => ({
    kind: 'maletin-coptero',
    x: muzzle.x + d.x * distance - maletin.width / 2,
    y: muzzle.y + d.y * distance - maletin.height / 2,
  }));
}

describe('Sentencia Firme', () => {
  const aim = { x: 420, y: 60 };

  it('damages every Enemy on its line in the tick it fires', () => {
    const game = armed(onTheLine(aim, [60, 160, 300]));
    game.ticks(1, { aim });
    const events = game.ticks(1, { aim, fire: true });

    expect(eventsOf(events, 'weapon-fired')).toEqual([
      { type: 'weapon-fired', weapon: 'sentencia-firme' },
    ]);
    const hits = eventsOf(events, 'enemy-hit');
    expect(new Set(hits.map((h) => h.enemyId)).size).toBe(3);
    for (const hit of hits) expect(hit.damage).toBe(sentencia.damage);
    // Instant: nothing is left flying.
    expect(runOf(game.view).projectiles).toHaveLength(0);
  });

  it('spares Enemies off its line', () => {
    const [onLine] = onTheLine(aim, [120]);
    const offLine: ScriptedSpawn = { kind: 'maletin-coptero', x: 300, y: 180 };
    const game = armed([onLine ?? expect.unreachable(), offLine]);
    const offId = eventsOf(game.log, 'enemy-spawned')[1]?.enemyId;
    game.ticks(1, { aim });
    const hits = eventsOf(game.ticks(1, { aim, fire: true }), 'enemy-hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.enemyId).not.toBe(offId);
  });

  it('leaves a beam from the muzzle to the edge of the screen that fades out', () => {
    const game = armed();
    game.ticks(1, { aim: { x: 400, y: 150 } });
    game.ticks(1, { aim: { x: 400, y: 150 }, fire: true });
    const run = runOf(game.view);
    const [beam, ...rest] = run.effects.beams;
    expect(rest).toHaveLength(0);
    expect(beam?.from.x).toBeCloseTo(run.rexi.muzzle.x, 6);
    expect(beam?.from.y).toBeCloseTo(run.rexi.muzzle.y, 6);
    expect(beam?.to.x).toBeCloseTo(SCREEN_WIDTH, 6);
    expect(beam?.intensity).toBe(1);

    game.seconds(beamEffect.duration);
    const fading = runOf(game.view).effects.beams[0];
    expect(fading?.intensity).toBeGreaterThan(0);
    expect(fading?.intensity).toBeLessThan(1);
    game.seconds(beamEffect.fade);
    expect(runOf(game.view).effects.beams).toHaveLength(0);
  });

  it('hits a drifting Enemy where it is when the beam fires', () => {
    const game = armed([{ kind: 'maletin-coptero', x: 380, y: 40 }], {});
    const spawnedAt = { x: 380, y: 40 };
    game.seconds(1);
    const enemy = runOf(game.view).enemies[0] ?? expect.unreachable('no Enemy');
    expect(Math.hypot(enemy.x - spawnedAt.x, enemy.y - spawnedAt.y)).toBeGreaterThan(maletin.width);
    const now = { x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2 };
    game.ticks(1, { aim: now });
    const hits = eventsOf(game.ticks(1, { aim: now, fire: true }), 'enemy-hit');
    expect(hits).toHaveLength(1);
  });

  it('holds its trace still during a Hit-stop and while paused', () => {
    const tuning = holdStill({
      quips: { chance: 1 },
      enemies: { 'maletin-coptero': { health: 1 } },
    });
    const game = armed(onTheLine(aim, [120]), tuning);
    game.ticks(1, { aim });
    const events = game.ticks(1, { aim, fire: true });
    expect(eventsOf(events, 'quip-started')).toHaveLength(1);
    const traced = runOf(game.view).effects.beams;
    expect(traced).toHaveLength(1);

    const hitStopTicks = runOf(game.view).hitStop;
    expect(hitStopTicks).toBeGreaterThan(secondsToTicks(beamEffect.duration + beamEffect.fade));
    game.ticks(hitStopTicks - 1, { aim });
    expect(runOf(game.view).effects.beams).toEqual(traced);

    game.pause();
    game.ticks(120, { aim });
    expect(runOf(game.view).effects.beams).toEqual(traced);
    game.ticks(1, { pause: true });

    game.ticks(1, { aim }); // the last Hit-stop tick
    expect(runOf(game.view).effects.beams).toEqual(traced);
    game.ticks(1, { aim });
    expect(runOf(game.view).effects.beams[0]?.age).toBe((traced[0]?.age ?? 0) + 1);
  });

  it('stops at the ground', () => {
    const game = armed();
    const down = { x: 300, y: 250 };
    game.ticks(1, { aim: down });
    game.ticks(1, { aim: down, fire: true });
    expect(runOf(game.view).effects.beams[0]?.to.y).toBeCloseTo(groundY, 6);
  });

  it('spends one ammo per shot and respects its fire interval', () => {
    const game = armed();
    const shots = eventsOf(game.holdFireToward(aim, 5), 'weapon-fired');
    expect(shots).toHaveLength(Math.ceil((5 * 60) / secondsToTicks(sentencia.fireInterval)));
    expect(runOf(game.view).rexi.weapon.ammo).toBe(sentencia.pickupAmmo - shots.length);
  });

  it('comes in Crates', () => {
    expect(defaultTuning.crates.weights.weapons['sentencia-firme']).toBeGreaterThan(0);
    const onlySentencia = Object.fromEntries(
      SPECIAL_WEAPON_IDS.map((id) => [id, id === 'sentencia-firme' ? 1 : 0]),
    );
    const game = drive({
      overrides: { tuning: { crates: { firstDrop: 0, weights: { weapons: onlySentencia } } } },
    });
    expect(eventsOf(game.ticks(1), 'crate-spawned')[0]?.contents).toEqual({
      kind: 'weapon',
      weapon: 'sentencia-firme',
    });
  });
});
