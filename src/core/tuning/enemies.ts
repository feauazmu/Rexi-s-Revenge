import type { EnemyKind } from '../ids';
import type { ExplosionSize } from './effects';

/** Numbers every Enemy has, whatever its behavior. */
export interface EnemyTuningBase {
  /** Hitbox size, px. */
  readonly width: number;
  readonly height: number;
  readonly health: number;
  /** Score awarded when destroyed. Heavier Enemies are worth more. */
  readonly points: number;
  /** Explosion preset played when destroyed (see `tuning.effects.explosions`). */
  readonly explosion: ExplosionSize;
  /** Chunks of debris it breaks into when destroyed (the renderer draws each chunk). */
  readonly debrisPieces: number;
}

export interface MaletinCopteroTuning extends EnemyTuningBase {
  /** Vertical hover amplitude, px. */
  readonly hoverAmplitude: number;
  /** Duration of one hover cycle, seconds. */
  readonly hoverPeriod: number;
}

/** One entry per Enemy (keyed by EnemyKind). */
export interface EnemiesTuning {
  readonly 'maletin-coptero': MaletinCopteroTuning;
}

export const enemiesTuning = {
  'maletin-coptero': {
    width: 24,
    height: 18,
    health: 12,
    points: 100,
    explosion: 'small',
    debrisPieces: 4,
    hoverAmplitude: 6,
    hoverPeriod: 2,
  },
} as const satisfies EnemiesTuning & Record<EnemyKind, EnemyTuningBase>;
