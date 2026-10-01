import type { EnemyKind } from '../ids';

/**
 * One row of the ramp table: the difficulty from `from` seconds of ramp clock until the next
 * stage starts. The ramp clock counts Run time excluding pause and Hit-stop.
 */
export interface RampStage {
  /** Ramp clock time at which this stage starts, seconds. The first stage starts at 0. */
  readonly from: number;
  /** Most Enemies allowed on screen at once. */
  readonly onScreenCap: number;
  /** Time between spawns, seconds (a spawn due while at the cap is skipped). */
  readonly spawnInterval: number;
  /** Multiplier on every Enemy's fire rate: their attack cooldowns run this much faster. */
  readonly fireRate: number;
}

/**
 * How the ramp keeps creeping up after the last stage: every `every` seconds past its start,
 * each value moves by its step, clamped to its limit.
 */
export interface RampGrowth {
  /** Seconds between growth steps. */
  readonly every: number;
  /** Added to the on-screen cap per step, up to `onScreenCapMax`. */
  readonly onScreenCap: number;
  readonly onScreenCapMax: number;
  /** Added to the spawn interval per step (negative = faster), down to `spawnIntervalMin`. */
  readonly spawnInterval: number;
  readonly spawnIntervalMin: number;
  /** Added to the fire-rate multiplier per step, up to `fireRateMax`. */
  readonly fireRate: number;
  readonly fireRateMax: number;
}

/** Where an Enemy enters the Arena: just outside the left or right edge, or above the top. */
export type SpawnEdge = 'left' | 'right' | 'top';

/** One Enemy kind's place in the ramp. Every Enemy has exactly one entry. */
export interface RosterEntry {
  /** Ramp clock time from which the Director may send this kind, seconds. */
  readonly from: number;
  /** Relative chance of being picked among the kinds currently allowed. */
  readonly weight: number;
  /** Most of this kind on screen at once (on top of the global cap), or null for no limit. */
  readonly maxOnScreen: number | null;
  /** Edges it may enter from, picked uniformly. */
  readonly edges: readonly SpawnEdge[];
  /** Altitude band (top of the hitbox) when entering from a side, px. */
  readonly minY: number;
  readonly maxY: number;
}

/**
 * The roster: one entry per Enemy, keyed by EnemyKind. Adding an Enemy kind fails the
 * typecheck until its entry is added here.
 */
export type DirectorRoster = Readonly<Record<EnemyKind, RosterEntry>>;

export interface DirectorTuning {
  /** Ramp clock time of the first spawn, seconds. */
  readonly firstSpawnDelay: number;
  /** The ramp table, ordered by `from`. */
  readonly stages: readonly RampStage[];
  readonly growth: RampGrowth;
  readonly roster: DirectorRoster;
}

export const directorTuning = {
  firstSpawnDelay: 1,
  // Maletín-cóptero only for the first minute (max 3 on screen), then the cap, pace and fire
  // rate climb; later Enemy kinds join through the roster below.
  stages: [
    { from: 0, onScreenCap: 3, spawnInterval: 3, fireRate: 1 },
    { from: 60, onScreenCap: 4, spawnInterval: 2.6, fireRate: 1.1 },
    { from: 120, onScreenCap: 5, spawnInterval: 2.3, fireRate: 1.2 },
    { from: 180, onScreenCap: 6, spawnInterval: 2, fireRate: 1.3 },
    { from: 240, onScreenCap: 7, spawnInterval: 2, fireRate: 1.45 },
  ],
  growth: {
    every: 60,
    onScreenCap: 1,
    onScreenCapMax: 10,
    spawnInterval: -0.1,
    spawnIntervalMin: 1.2,
    fireRate: 0.1,
    fireRateMax: 2,
  },
  // Weights are relative to the kinds allowed at the time.
  roster: {
    'maletin-coptero': {
      from: 0,
      weight: 60,
      maxOnScreen: null,
      edges: ['left', 'right'],
      minY: 40,
      maxY: 187,
    },
    // Patrols high, so it enters within its patrol band (tuning.enemies, 32..80).
    'archivador-artillado': {
      from: 60,
      weight: 20,
      maxOnScreen: 2,
      edges: ['left', 'right'],
      minY: 32,
      maxY: 75,
    },
    'caminadora-a-reaccion': {
      from: 60,
      weight: 20,
      maxOnScreen: null,
      edges: ['left', 'right'],
      minY: 93,
      maxY: 173,
    },
    // The heavy set piece: from two minutes in, and never two at once.
    'banca-artillada': {
      from: 120,
      weight: 15,
      maxOnScreen: 1,
      edges: ['left', 'right'],
      minY: 48,
      maxY: 107,
    },
  },
} as const satisfies DirectorTuning;
