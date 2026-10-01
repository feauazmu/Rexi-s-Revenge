/**
 * Staged Run endings for Veredicto tests: Rexi shoots down `kills` Maletín-cópteros (one
 * gavel each), then a sharpshooter out of his reach defeats him.
 */
import { defaultTuning, type GameOptions, type ScriptedSpawn } from '../../src/core';
import { drive, type Driver } from './driver';

const maletin = defaultTuning.enemies['maletin-coptero'];
/** Ticks between two targets: plenty for one gavel to reach and destroy the previous one. */
const TARGET_EVERY = 30;
const TARGET = { x: 300, y: 60 } as const;

export interface RunEndOptions extends Partial<Omit<GameOptions, 'overrides'>> {
  /** Maletín-cópteros destroyed before the end (default 0). */
  readonly kills?: number;
  /** Points per Maletín-cóptero (default: its tuned points). */
  readonly points?: number;
}

/** A Run that has just ended: the driver stops on the tick `run-ended` was emitted. */
export function driveToRunEnd(options: RunEndOptions = {}): Driver {
  const { kills = 0, points = maletin.points, ...gameOptions } = options;
  const targets: ScriptedSpawn[] = Array.from({ length: kills }, (_, i) => ({
    kind: 'maletin-coptero',
    ...TARGET,
    atTick: i * TARGET_EVERY,
  }));
  const killer: ScriptedSpawn = {
    kind: 'maletin-coptero',
    x: 440,
    y: 20,
    atTick: kills * TARGET_EVERY,
  };
  const game = drive({
    ...gameOptions,
    overrides: {
      spawns: [...targets, killer],
      tuning: {
        rexi: { maxHealth: 10, invulnerability: 0.2 },
        weapons: { 'mazo-automatico': { damage: maletin.health } },
        enemies: {
          'maletin-coptero': {
            points,
            paperDamage: 5,
            fireIntervalMin: 0.4,
            fireIntervalMax: 0.4,
            aimError: 0,
          },
        },
      },
    },
  });
  return playToRunEnd(game, kills);
}

/**
 * Plays a Run staged by {@link driveToRunEnd} (also a later Run of the same game, which gets
 * the same scripted spawns) until it ends.
 */
export function playToRunEnd(game: Driver, kills: number): Driver {
  game.holdFireToward({ x: TARGET.x + 12, y: TARGET.y + 9 }, (kills * TARGET_EVERY) / 60);
  for (let i = 0; i < 60 * 60; i++) {
    if (game.ticks(1).some((e) => e.type === 'run-ended')) return game;
  }
  throw new Error('The staged Run did not end');
}
