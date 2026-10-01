import type { EnemyKind } from './ids';
import type { StoragePort } from './storage';
import type { TuningOverrides } from './tuning';

/** Only affects UI prompts and "Cómo jugar" content, never gameplay. */
export type DeviceKind = 'desktop' | 'touch';

/** An Enemy placed at an exact Run tick and position, for tests and the dev sandbox. */
export interface ScriptedSpawn {
  readonly kind: EnemyKind;
  /** Run tick at which the Enemy appears (default 0: on the first tick of the Run). */
  readonly atTick?: number;
  /** Top-left of the Enemy's hitbox, game coordinates. */
  readonly x: number;
  readonly y: number;
}

export interface GameOverrides {
  /** Deep-merged over the default tuning catalog. */
  readonly tuning?: TuningOverrides;
  /**
   * When present, these spawns replace automatic spawning entirely: the Run contains exactly
   * these Enemies (an empty list means no Enemies at all).
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
