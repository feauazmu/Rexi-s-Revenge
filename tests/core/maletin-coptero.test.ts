/** Maletín-cóptero movement: drifts between random points in the Arena, hovering with a bob. */
import { describe, expect, it } from 'vitest';
import {
  defaultTuning,
  SCREEN_WIDTH,
  secondsToTicks,
  type EnemyView,
  type TuningOverrides,
} from '../../src/core';
import { drive, runOf, type Driver } from '../support/driver';

const maletin = defaultTuning.enemies['maletin-coptero'];
const invincible: TuningOverrides = { rexi: { maxHealth: 1_000_000_000 } };

function maletinAt(x: number, y: number, tuning: TuningOverrides = {}, seed = 1): Driver {
  return drive({
    seed,
    overrides: {
      spawns: [{ kind: 'maletin-coptero', x, y }],
      tuning: { ...invincible, ...tuning },
    },
  });
}

/** Samples the only Enemy's view once per tick for `seconds`. */
function track(game: Driver, seconds: number): EnemyView[] {
  const samples: EnemyView[] = [];
  for (let t = 0; t < secondsToTicks(seconds); t++) {
    game.ticks(1);
    const enemy = runOf(game.view).enemies[0];
    if (enemy) samples.push(enemy);
  }
  return samples;
}

describe('Maletín-cóptero drift', () => {
  it('drifts around the Arena instead of staying put', () => {
    const path = track(maletinAt(200, 80), 30);
    const xs = path.map((e) => e.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(60);
  });

  it('stays inside its roaming area once there', () => {
    const path = track(maletinAt(200, 80), 60);
    for (const e of path) {
      expect(e.x).toBeGreaterThanOrEqual(maletin.roamMarginX - 1e-9);
      expect(e.x + e.w).toBeLessThanOrEqual(SCREEN_WIDTH - maletin.roamMarginX + 1e-9);
      expect(e.y).toBeGreaterThanOrEqual(maletin.roamMinY - maletin.hoverAmplitude - 1e-9);
      expect(e.y).toBeLessThanOrEqual(maletin.roamMaxY + maletin.hoverAmplitude + 1e-9);
    }
  });

  it('never moves faster than its drift speed (plus the hover bob)', () => {
    const path = track(maletinAt(200, 80), 20);
    const bobPerTick = (2 * Math.PI * maletin.hoverAmplitude) / maletin.hoverPeriod / 60;
    path.slice(1).forEach((e, i) => {
      const previous = path[i] ?? expect.unreachable();
      expect(Math.abs(e.x - previous.x)).toBeLessThanOrEqual(maletin.driftSpeed / 60 + 1e-9);
      expect(Math.abs(e.y - previous.y)).toBeLessThanOrEqual(
        maletin.driftSpeed / 60 + bobPerTick + 1e-9,
      );
    });
  });

  it('flies in from just outside the Arena edge', () => {
    const game = maletinAt(-maletin.width, 60);
    game.seconds(4);
    const enemy = runOf(game.view).enemies[0];
    expect(enemy?.x).toBeGreaterThanOrEqual(maletin.roamMarginX - 1e-9);
  });

  it('only hovers in place when its drift speed is zero', () => {
    const path = track(
      maletinAt(200, 80, { enemies: { 'maletin-coptero': { driftSpeed: 0 } } }),
      5,
    );
    expect(new Set(path.map((e) => e.x))).toEqual(new Set([200]));
    const ys = path.map((e) => e.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(maletin.hoverAmplitude);
    expect(Math.max(...ys)).toBeLessThanOrEqual(80 + maletin.hoverAmplitude + 1e-9);
  });

  it('takes a different path with a different seed', () => {
    const a = track(maletinAt(200, 80, {}, 1), 10).map((e) => e.x);
    const b = track(maletinAt(200, 80, {}, 2), 10).map((e) => e.x);
    expect(a).not.toEqual(b);
  });
});
