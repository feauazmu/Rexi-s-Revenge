import type { CrateContents, EnemyKind } from './ids';
import type { StoragePort } from './storage';
import type { TuningOverrides } from './tuning';

/** Only affects UI prompts and "Cómo jugar" content, never gameplay. */
export type DeviceKind = 'desktop' | 'touch';

/** Something placed at an exact Run tick and position, for tests and the dev sandbox. */
export type ScriptedSpawn = ScriptedEnemySpawn | ScriptedCrateSpawn;

/** An Enemy placed at an exact Run tick and position. */
export interface ScriptedEnemySpawn {
  readonly kind: EnemyKind;
  /** Run tick at which the Enemy appears (default 0: on the first tick of the Run). */
  readonly atTick?: number;
  /** Top-left of the Enemy's hitbox, game coordinates. */
  readonly x: number;
  readonly y: number;
}

/** A Crate dropped at an exact Run tick and position. */
export interface ScriptedCrateSpawn {
  readonly kind: 'crate';
  readonly contents: CrateContents;
  /** Run tick at which the Crate appears (default 0: on the first tick of the Run). */
  readonly atTick?: number;
  /** Left edge of the Crate. */
  readonly x: number;
  /** Top edge of the Crate. Default: just above the top of the screen, as automatic drops. */
  readonly y?: number;
}

export interface GameOverrides {
  /** Deep-merged over the default tuning catalog. */
  readonly tuning?: TuningOverrides;
  /**
   * When present, these spawns replace automatic spawning entirely: the Run contains exactly
   * these Enemies and Crates (an empty list means none at all).
   */
  readonly spawns?: readonly ScriptedSpawn[];
}

export interface GameOptions {
  /** Seed for the core's only random generator. Same seed + same inputs = same Run. */
  readonly seed: number;
  /** Default: 'desktop'. */
  readonly device?: DeviceKind;
  /** Where the core persists its data. Default: in-memory (nothing survives a reload). */
  readonly storage?: StoragePort;
  readonly overrides?: GameOverrides;
}
