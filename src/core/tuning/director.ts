import type { EnemyKind } from '../ids';

/**
 * One ramp step, a row of the ramp table: the difficulty from `from` seconds of ramp clock until
 * the next ramp step starts. The ramp clock counts Run time excluding pause and Hit-stop.
 */
export interface RampStep {
  /** Ramp clock time at which this ramp step starts, seconds. The first one starts at 0. */
  readonly from: number;
  /** Most Enemies allowed on screen at once. */
  readonly onScreenCap: number;
  /** Time between spawns, seconds (a spawn due while at the cap is skipped). */
  readonly spawnInterval: number;
  /** Multiplier on every Enemy's fire rate: their attack cooldowns run this much faster. */
  readonly fireRate: number;
}

/**
 * Endless escalation after the last ramp step. With `t` the seconds since it started and
 * `p = ln(1 + t / timeScale)`, the fire rate becomes `fireRate + growth.fireRate × p`, the spawn
 * interval `spawnInterval / (1 + growth.spawnPace × p)` and the on-screen cap
 * `floor(onScreenCap + growth.onScreenCap × p)`. `p` grows forever but ever more slowly: no
 * plateau, no cliff, and the cap is a soft one that keeps creeping up.
 */
export interface RampGrowth {
  /** Seconds after the last ramp step over which `p` reaches ln 2 (sets how fast it bends). */
  readonly timeScale: number;
  /** Added to the fire-rate multiplier per unit of `p`. */
  readonly fireRate: number;
  /** How much the spawn interval shrinks per unit of `p` (it is divided by 1 + spawnPace × p). */
  readonly spawnPace: number;
  /** Added to the on-screen cap per unit of `p` (rounded down). */
  readonly onScreenCap: number;
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
  /** The ramp table: its ramp steps, ordered by `from`. */
  readonly steps: readonly RampStep[];
  readonly growth: RampGrowth;
  readonly roster: DirectorRoster;
}

export const directorTuning = {
  firstSpawnDelay: 1,
  // Maletín-cóptero only for the first minute (max 3 on screen), then the cap, pace and fire
  // rate climb; later Enemy kinds join through the roster below. Balance pass (#30): the
  // middle ramp steps climb more gently (fire rate 1.05 → 1.3 rather than 1.1 → 1.45), so the
  // two- to four-minute stretch is a climb and not a cliff; `growth` then escalates without end.
  steps: [
    { from: 0, onScreenCap: 3, spawnInterval: 3, fireRate: 1 },
    { from: 60, onScreenCap: 4, spawnInterval: 2.6, fireRate: 1.05 },
    { from: 120, onScreenCap: 5, spawnInterval: 2.4, fireRate: 1.1 },
    { from: 180, onScreenCap: 6, spawnInterval: 2.2, fireRate: 1.2 },
    { from: 240, onScreenCap: 7, spawnInterval: 2, fireRate: 1.3 },
  ],
  // From 4:00: about +0.1 fire rate, -0.1 s interval and +1 cap in the first minute (as the
  // ramp steps did), then ever more slowly: at 10 min fire rate ~1.65, interval ~1.65 s, cap 11.
  growth: {
    timeScale: 120,
    fireRate: 0.25,
    spawnPace: 0.15,
    onScreenCap: 3,
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
    // Patrols high, so it enters within its patrol band (tuning.enemies, 32..80), or drops in
    // from above and descends to it.
    'archivador-artillado': {
      from: 60,
      weight: 20,
      maxOnScreen: 2,
      edges: ['left', 'right', 'top'],
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

/** The ramp's values at one moment of the ramp clock. */
export type RampValues = Omit<RampStep, 'from'>;

/**
 * Looks up the ramp table at `seconds` of ramp clock: the ramp step whose `from` last passed,
 * and past the last one, its values escalated by `growth` (logarithmic, so it never plateaus).
 */
export function rampAt(director: DirectorTuning, seconds: number): RampValues {
  const { steps, growth } = director;
  let step = steps[0];
  if (!step) throw new Error('The ramp table needs at least one ramp step');
  for (const candidate of steps) if (candidate.from <= seconds) step = candidate;

  if (step !== steps[steps.length - 1] || growth.timeScale <= 0) return step;
  const p = Math.log1p(Math.max(0, seconds - step.from) / growth.timeScale);
  return {
    onScreenCap: Math.floor(step.onScreenCap + growth.onScreenCap * p),
    spawnInterval: step.spawnInterval / (1 + growth.spawnPace * p),
    fireRate: step.fireRate + growth.fireRate * p,
  };
}
